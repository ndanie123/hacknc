import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

const SEED_TAG = "hacknc-volume-test";
const SEED_EMAIL_PREFIX = `synthetic-${SEED_TAG}-`;
const DEFAULTS = { patients: 25, providers: 5, logsPerPatient: 4 };
const LIMITS = { patients: 500, providers: 100, logsPerPatient: 25 };
const LOG_TYPES = ["general", "symptom", "medication", "psychiatric"];
const SYMPTOMS = [
  "Mild headache after a long day",
  "Intermittent muscle cramps",
  "Sleep has been less restful",
  "Occasional nausea after meals",
  "Seasonal congestion and sneezing",
  "Energy has been lower than usual",
  "Tracking a recurring skin irritation",
  "Mild stiffness after exercise",
];
const FIRST_NAMES = [
  "Alex",
  "Avery",
  "Casey",
  "Jordan",
  "Morgan",
  "Riley",
  "Sam",
  "Taylor",
  "Cameron",
  "Drew",
  "Jamie",
  "Kai",
  "Parker",
  "Quinn",
  "Reese",
  "Skyler",
  "Amara",
  "Diego",
  "Fatima",
  "Minh",
  "Noah",
  "Priya",
  "Sofia",
  "Yuki",
];
const LAST_NAMES = [
  "Adams",
  "Bennett",
  "Brooks",
  "Chen",
  "Diaz",
  "Ellis",
  "Foster",
  "Garcia",
  "Harris",
  "Ibrahim",
  "Johnson",
  "Kim",
  "Lee",
  "Martin",
  "Nguyen",
  "Patel",
  "Reed",
  "Rivera",
  "Shah",
  "Thompson",
  "Wilson",
  "Young",
];
const PROVIDER_TITLES = ["Primary Care Provider", "Nurse Practitioner", "Physician"];

function parseArgs(args) {
  const options = { ...DEFAULTS, apply: false, cleanup: false };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--apply") options.apply = true;
    else if (arg === "--cleanup") options.cleanup = true;
    else if (arg === "--dry-run") options.apply = false;
    else if (["--patients", "--providers", "--logs-per-patient"].includes(arg)) {
      const value = args[i + 1];
      if (!value || !/^\d+$/.test(value)) throw new Error(`${arg} requires a positive integer.`);
      const optionName = {
        "--patients": "patients",
        "--providers": "providers",
        "--logs-per-patient": "logsPerPatient",
      }[arg];
      options[optionName] = Number(value);
      i += 1;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  options.logsPerPatient ??= DEFAULTS.logsPerPatient;
  if (options.cleanup && !options.apply) {
    throw new Error("Cleanup changes remote data; run it with both --cleanup and --apply.");
  }
  if (options.patients < 1 || options.patients > LIMITS.patients) {
    throw new Error(`--patients must be between 1 and ${LIMITS.patients}.`);
  }
  if (options.providers < 1 || options.providers > LIMITS.providers) {
    throw new Error(`--providers must be between 1 and ${LIMITS.providers}.`);
  }
  if (options.logsPerPatient < 1 || options.logsPerPatient > LIMITS.logsPerPatient) {
    throw new Error(`--logs-per-patient must be between 1 and ${LIMITS.logsPerPatient}.`);
  }
  if (options.patients * options.logsPerPatient > 12500) {
    throw new Error("The requested run exceeds the 12,500-log safety limit.");
  }
  return options;
}

async function loadLocalEnv() {
  try {
    const contents = await readFile(".env.local", "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!match || process.env[match[1]]) continue;
      let value = match[2];
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[match[1]] = value;
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

function getConfig() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("Set SUPABASE_URL or VITE_SUPABASE_URL in .env.local.");
  if (!serviceKey) {
    throw new Error("Set SUPABASE_SERVICE_ROLE_KEY in .env.local before using --apply.");
  }
  return { url, serviceKey };
}

function apiClient({ url, serviceKey }) {
  return async (path, options = {}) => {
    const response = await fetch(`${url}${path}`, {
      ...options,
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(
        `Supabase request failed (${response.status} ${options.method || "GET"} ${path}): ${text}`,
      );
    }
    return text ? JSON.parse(text) : null;
  };
}

async function listSeedUsers(request) {
  const users = [];
  for (let page = 1; ; page += 1) {
    const result = await request(`/auth/v1/admin/users?page=${page}&per_page=1000`);
    const pageUsers = result.users || [];
    users.push(...pageUsers);
    if (pageUsers.length < 1000) break;
  }
  return users.filter(
    (user) =>
      user.user_metadata?.synthetic_seed === SEED_TAG && user.email?.startsWith(SEED_EMAIL_PREFIX),
  );
}

async function deleteInBatches(request, table, field, values, extraQuery = "") {
  for (let i = 0; i < values.length; i += 200) {
    const batch = values.slice(i, i + 200);
    if (batch.length === 0) continue;
    const params = new URLSearchParams({
      [field]: `in.(${batch.join(",")})`,
      ...Object.fromEntries(new URLSearchParams(extraQuery)),
    });
    await request(`/rest/v1/${table}?${params}`, { method: "DELETE" });
  }
}

async function cleanup(request) {
  const users = await listSeedUsers(request);
  if (users.length === 0) {
    console.log("No users tagged by this synthetic-data seeder were found.");
    return;
  }

  const userIds = users.map((user) => user.id);
  const logs = [];
  for (let offset = 0; ; offset += 1000) {
    const params = new URLSearchParams({
      select: "id,user_id,title",
      user_id: `in.(${userIds.join(",")})`,
      limit: "1000",
      offset: String(offset),
    });
    const page = await request(`/rest/v1/health_logs?${params}`);
    logs.push(...page);
    if (page.length < 1000) break;
  }
  const titlePrefix = `[Synthetic ${SEED_TAG}]`;
  const generatedLogs = logs.filter((log) => log.title.startsWith(titlePrefix));
  const otherLogs = logs.filter((log) => !log.title.startsWith(titlePrefix));
  if (otherLogs.length > 0) {
    throw new Error(
      `Found ${otherLogs.length} untagged log(s) owned by seeded accounts. Remove or transfer those logs before cleanup; nothing was deleted.`,
    );
  }

  await deleteInBatches(
    request,
    "health_logs",
    "id",
    generatedLogs.map((log) => log.id),
  );
  for (const user of users) {
    await request(`/auth/v1/admin/users/${user.id}`, { method: "DELETE" });
  }
  console.log(
    `Removed ${generatedLogs.length} generated logs and ${users.length} synthetic accounts.`,
  );
}

function makeName(index) {
  const first = FIRST_NAMES[(index * 7) % FIRST_NAMES.length];
  const last = LAST_NAMES[(index * 11) % LAST_NAMES.length];
  return `${first} ${last}`;
}

function makeUser(role, index, name, password) {
  const number = String(index + 1).padStart(3, "0");
  const email = `${SEED_EMAIL_PREFIX}${role}-${number}@example.com`;
  const isProvider = role === "provider";
  return {
    email,
    password,
    email_confirm: true,
    user_metadata: {
      synthetic_seed: SEED_TAG,
      account_type: isProvider ? "provider" : "patient",
      full_name: name,
      ...(isProvider
        ? {
            organization: "Synthetic Test Clinic",
            job_title: PROVIDER_TITLES[index % PROVIDER_TITLES.length],
          }
        : {}),
    },
  };
}

function makeLog(patient, patientIndex, logIndex, providers, now) {
  const id = randomUUID();
  const symptom = SYMPTOMS[(patientIndex + logIndex * 3) % SYMPTOMS.length];
  const type = LOG_TYPES[(patientIndex + logIndex) % LOG_TYPES.length];
  const daysAgo = (patientIndex * 3 + logIndex * 5) % 60;
  const createdAt = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
  const logNumber = String(logIndex + 1).padStart(2, "0");
  const title = `[Synthetic ${SEED_TAG}] ${type} update ${logNumber}`;
  const content = [
    `## Summary`,
    `Synthetic test data only; no real patient information. ${symptom}.`,
    ``,
    `## Timeline`,
    `Generated for dashboard volume testing. Record ${logNumber} for ${patient.name}.`,
    ``,
    `## Questions for Provider`,
    `This entry is synthetic and is not a clinical record.`,
  ].join("\n");
  const provider = providers[(patientIndex + logIndex) % providers.length];
  return {
    log: {
      id,
      user_id: patient.id,
      title,
      log_type: type,
      content,
      created_at: createdAt,
      updated_at: createdAt,
    },
    share: { log_id: id, provider_id: provider.id, created_at: createdAt },
  };
}

async function insertBatches(request, table, rows) {
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    await request(`/rest/v1/${table}`, {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(batch),
    });
  }
}

async function seed(request, options) {
  const existingUsers = await listSeedUsers(request);
  if (existingUsers.length > 0) {
    throw new Error(
      `Found ${existingUsers.length} previously seeded account(s). Run \`npm run seed:synthetic -- --cleanup --apply\` first to avoid duplicates.`,
    );
  }

  const password = `${randomBytes(30).toString("base64url")}aA1!`;
  const createdUsers = [];
  const createdLogIds = [];
  try {
    const providers = [];
    const patients = [];
    for (const [role, count, destination] of [
      ["provider", options.providers, providers],
      ["patient", options.patients, patients],
    ]) {
      for (let i = 0; i < count; i += 1) {
        const body = makeUser(role, i, makeName(i + (role === "patient" ? 5 : 0)), password);
        const user = await request("/auth/v1/admin/users", {
          method: "POST",
          body: JSON.stringify(body),
        });
        if (!user?.id) throw new Error(`Supabase did not return an ID for ${body.email}.`);
        const account = { id: user.id, email: body.email, name: body.user_metadata.full_name };
        destination.push(account);
        createdUsers.push(account);
      }
    }

    const generated = [];
    const now = new Date();
    patients.forEach((patient, patientIndex) => {
      for (let logIndex = 0; logIndex < options.logsPerPatient; logIndex += 1) {
        generated.push(makeLog(patient, patientIndex, logIndex, providers, now));
      }
    });
    const logs = generated.map((row) => row.log);
    const shares = generated.map((row) => row.share);
    createdLogIds.push(...logs.map((log) => log.id));
    await insertBatches(request, "health_logs", logs);
    await insertBatches(request, "log_shares", shares);

    console.log(`Created ${patients.length} synthetic patients and ${providers.length} providers.`);
    console.log(`Created ${logs.length} health logs and ${shares.length} provider shares.`);
    console.log(`Synthetic account password (shared by these new accounts): ${password}`);
    console.log("Provider sign-in accounts:");
    for (const provider of providers) console.log(`  ${provider.email}`);
    console.log("These records are synthetic test data, not clinical records.");
  } catch (error) {
    console.error("Seeding failed; removing records created during this run.");
    const rollbackErrors = [];
    try {
      await deleteInBatches(request, "health_logs", "id", createdLogIds);
    } catch (rollbackError) {
      rollbackErrors.push(rollbackError);
    }
    for (const user of createdUsers) {
      try {
        await request(`/auth/v1/admin/users/${user.id}`, { method: "DELETE" });
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    for (const rollbackError of rollbackErrors) {
      console.error("Rollback failed:", rollbackError);
    }
    throw error;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const logCount = options.patients * options.logsPerPatient;
  if (options.cleanup)
    console.log(`Cleanup plan: only accounts tagged "${SEED_TAG}" and their generated logs.`);
  else {
    console.log(
      `Seed plan: ${options.patients} patients, ${options.providers} providers, ${logCount} logs.`,
    );
  }
  if (!options.apply) {
    console.log("Dry run only. Add --apply to change the Supabase project.");
    console.log("To choose counts, use --patients N --providers N --logs-per-patient N.");
    return;
  }

  await loadLocalEnv();
  const request = apiClient(getConfig());
  if (options.cleanup) await cleanup(request);
  else await seed(request, options);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
