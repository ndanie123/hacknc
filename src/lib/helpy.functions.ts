import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  logType: z.string().max(100),
  logTypeLabel: z.string().max(200),
  sections: z.array(z.string().max(200)).max(10),
  timezone: z.string().max(100),
  answers: z
    .array(
      z.object({
        question: z.string().max(500),
        answer: z.string().max(4000),
        at: z.string().max(60),
      }),
    )
    .min(1)
    .max(10),
});

export type HelpyResult = { ok: true; title: string; content: string } | { ok: false; error: string };

export const formatHelpyLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => InputSchema.parse(d))
  .handler(async ({ data }): Promise<HelpyResult> => {
    const key = process.env['LOVABLE_API_KEY'];
    if (!key) return { ok: false, error: "Helpy isn't configured yet." };

    const transcript = data.answers
      .map((a) => `[${a.at}] Helpy: ${a.question}\nPatient: ${a.answer}`)
      .join("\n\n");

    const checkInDate = data.answers[0]?.at ?? new Date().toISOString();

    const instructions = `You are Helpy, a health-log assistant. Turn a patient's check-in into a clear, factual log a healthcare provider can read during an appointment.
Rules:
- Use only what the patient said. Never diagnose, never invent facts, doses or times.
- Write in third person ("Patient reports...").
- Output plain Markdown only. Do NOT use bold or italics (no ** or * or _). First line: "TITLE: <short title>" (e.g. "Headache — May 14, 2026").
- Then sections, each starting with "## ". Use these sections in order: ${data.sections.join(", ")}, plus a final "## Check-in Timeline".
- Today's check-in timestamp is ${checkInDate} (patient timezone ${data.timezone}). Resolve every relative time ("yesterday", "since Thursday", "two days ago", "this morning") into a real calendar date using that check-in date.
- State the check-in date near the top and mention onset/duration as reported.

"Check-in Timeline" rules (strict):
- This is a timeline of WHEN THINGS HAPPENED to the patient, not when they typed their answers. Ignore the transcript [timestamp] tags except to know today's date.
- One bullet per day, in chronological order (oldest first). Never repeat a day, never list a day twice.
- Date format: abbreviated month, ordinal day, year — e.g. "Oct 9th, 2026", "Oct 1st, 2026", "Oct 22nd, 2026", "Oct 3rd, 2026". Add a time only if the patient gave one, written like "9:00 AM" (e.g. "Oct 9th, 2026, 9:00 AM").
- Bullet format: "- <date> — <short event summary>". Keep summaries short (a few words), e.g. "Severe cramps", "Severe cramps; took 1 Advil (30 mg) at 3:00 PM".
- An ongoing symptom gets a bullet for EVERY day from its onset date through today's check-in date. Example: patient says on Oct 10th, 2026 they've had severe cramps since Oct 9th →
  - Oct 9th, 2026 — Severe cramps
  - Oct 10th, 2026 — Severe cramps
  If the span is longer than 14 days, use one bullet for the onset date, one bullet "- <start date> to <end date> — <symptom> ongoing", and one bullet for today.
- Put each medication, trigger or event on the day it happened, combined into that day's single bullet with "; ".
- If the onset date is not given, use only today's date.
- If something wasn't mentioned in other sections, write "Not reported".
- Log type: ${data.logTypeLabel}.`;

    let res: Response;
    try {
      res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "X-Lovable-AIG-SDK": "fetch",
        },
        body: JSON.stringify({
          model: "openai/gpt-6-astra",
          instructions,
          input: [{ role: "user", content: `Check-in transcript:\n\n${transcript}` }],
          reasoning: { effort: "low" },
          store: false,
          stream: true,
        }),
      });
    } catch (e) {
      console.error("Helpy fetch failed", e);
      return { ok: false, error: "Couldn't reach Helpy. Please try again." };
    }

    if (!res.ok || !res.body) {
      const body = await res.text().catch(() => "");
      console.error("Helpy gateway error", res.status, body);
      if (res.status === 429) return { ok: false, error: "Helpy is busy right now. Please try again in a minute." };
      if (res.status === 402) return { ok: false, error: "AI credits have run out. Add credits in Settings → Plans & credits." };
      return { ok: false, error: "Helpy couldn't format your log. Please try again." };
    }

    // Consume the SSE stream and accumulate output text.
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    let refused = false;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        for (const line of frame.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const evt = JSON.parse(payload);
            if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") text += evt.delta;
            if (evt.type === "response.refusal.delta") refused = true;
            if (evt.type === "error" || evt.type === "response.failed") {
              console.error("Helpy stream error", payload);
              return { ok: false, error: "Helpy couldn't format your log. Please try again." };
            }
          } catch {
            /* ignore partial frames */
          }
        }
      }
    }

    if (refused || !text.trim()) return { ok: false, error: "Helpy couldn't write this log. You can write it yourself on the right." };

    const lines = text.trim().split("\n");
    let title = `${data.logTypeLabel} — ${new Date().toLocaleDateString("en-US")}`;
    if (lines[0]?.startsWith("TITLE:")) {
      title = lines.shift()!.slice(6).trim() || title;
    }
    return { ok: true, title, content: lines.join("\n").trim() };
  });
