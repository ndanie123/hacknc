import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronRight,
  Clock3,
  Download,
  FileText,
  Inbox,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { getLogType } from "@/lib/log-types";
import { downloadLogPdf } from "@/lib/pdf";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Log Companion" },
      { name: "description", content: "Your health logs and shared records." },
      { property: "og:title", content: "Dashboard — Log Companion" },
      { property: "og:description", content: "Your health logs and shared records." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { profile } = useAuth();
  if (!profile) return <p className="text-center text-muted-foreground">Loading profile…</p>;
  return profile.account_type === "provider" ? <ProviderDashboard /> : <PatientDashboard />;
}

function PatientDashboard() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [showAll, setShowAll] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const deleteLog = async (logId: string, title: string) => {
    if (!window.confirm(`Delete "${title}"? This can't be undone.`)) return;
    setDeletingId(logId);
    const { error: sharesError } = await supabase.from("log_shares").delete().eq("log_id", logId);
    const { error } = sharesError ? { error: sharesError } : await supabase.from("health_logs").delete().eq("id", logId);
    setDeletingId(null);
    if (error) {
      toast.error("Couldn't delete that log. Please try again.");
      return;
    }
    toast.success("Log deleted.");
    queryClient.invalidateQueries({ queryKey: ["my-logs"] });
  };

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["my-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("health_logs")
        .select("id,title,log_type,created_at")
        .eq("user_id", profile?.id ?? "")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthCount = logs.filter((l) => new Date(l.created_at) >= monthStart).length;
  const symptomCount = new Set(logs.map((l) => l.log_type)).size;

  const monthBuckets = Array.from({ length: 6 }, (_, i) => {
    const start = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const end = new Date(now.getFullYear(), now.getMonth() - (5 - i) + 1, 1);
    return logs.filter((l) => {
      const d = new Date(l.created_at);
      return d >= start && d < end;
    }).length;
  });
  const maxBucket = Math.max(1, ...monthBuckets);

  const recentTotal = (monthBuckets[3] ?? 0) + (monthBuckets[4] ?? 0) + (monthBuckets[5] ?? 0);
  const earlierTotal = (monthBuckets[0] ?? 0) + (monthBuckets[1] ?? 0) + (monthBuckets[2] ?? 0);
  const trend = recentTotal === earlierTotal ? "Steady" : recentTotal < earlierTotal ? "Trending down" : "Trending up";

  const typeCounts = logs.reduce<Record<string, number>>((acc, l) => {
    acc[l.log_type] = (acc[l.log_type] ?? 0) + 1;
    return acc;
  }, {});
  const topType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const chartTitle = topType ? `${getLogType(topType).label} frequency` : "Entry frequency";

  const visibleLogs = showAll ? logs : logs.slice(0, 3);

  return (
    <div className="space-y-8">
      <section className="log-summary-card">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="workspace-kicker">Your health log</p>
            <h1 className="font-bold">{greeting}, {firstName}</h1>
          </div>
          <Button asChild variant="lilac" size="lg">
            <Link to="/logs/new"><Plus /> New entry</Link>
          </Button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="log-stat-card">
            <p className="text-sm text-muted-foreground">Entries this month</p>
            <p className="mt-3 text-5xl font-bold">{monthCount}</p>
            <p className="mt-3 text-sm text-muted-foreground">{symptomCount} {symptomCount === 1 ? "symptom" : "symptoms"} tracked</p>
          </div>
          <div className="log-stat-card">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm text-muted-foreground">{chartTitle}</p>
              {!isLoading && logs.length > 1 && (
                <span className={`text-xs font-semibold ${trend === "Trending down" ? "text-leaf" : trend === "Trending up" ? "text-lilac" : "text-muted-foreground"}`}>{trend}</span>
              )}
            </div>
            <div className="log-chart mt-6" aria-hidden="true">
              {monthBuckets.map((count, i) => (
                <span key={i} className="log-bar" style={{ height: `${Math.max(8, Math.round((count / maxBucket) * 100))}%` }} />
              ))}
            </div>
          </div>
        </div>

        <div className="log-stat-card mt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Recent entries</h2>
            {logs.length > 3 && (
              <button type="button" onClick={() => setShowAll((v) => !v)} className="text-sm font-semibold text-lilac hover:underline">
                {showAll ? "Show less" : "View all"}
              </button>
            )}
          </div>
          {isLoading ? (
            <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
          ) : visibleLogs.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No entries yet — create your first log to bring to your next appointment.</p>
          ) : (
            <div className="log-rows mt-2">
              {visibleLogs.map((l) => (
                <Link key={l.id} to="/logs/$id" params={{ id: l.id }} className="log-row">
                  <span className="log-date"><strong>{new Date(l.created_at).getDate()}</strong><small>{new Date(l.created_at).toLocaleDateString(undefined, { month: "short" })}</small></span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-bold">{l.title}</h3>
                    <p className="mt-0.5 text-sm text-muted-foreground">{getLogType(l.log_type).label} · {new Date(l.created_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Delete ${l.title}`}
                    title="Delete log"
                    disabled={deletingId === l.id}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void deleteLog(l.id, l.title);
                    }}
                    className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function ProviderDashboard() {
  const { profile } = useAuth();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const {
    data: shared = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["shared-logs", profile?.id],
    queryFn: async () => {
      const { data: shares, error } = await supabase
        .from("log_shares")
        .select("log_id")
        .eq("provider_id", profile?.id ?? "");
      if (error) throw error;
      const ids = shares.map((s) => s.log_id);
      if (!ids.length) return [];
      const { data: logs, error: e2 } = await supabase
        .from("health_logs")
        .select("id,title,log_type,content,created_at,user_id")
        .in("id", ids)
        .order("created_at", { ascending: false });
      if (e2) throw e2;
      const userIds = [...new Set(logs.map((l) => l.user_id))];
      const { data: patients, error: e3 } = await supabase
        .from("profiles")
        .select("id,full_name")
        .in("id", userIds);
      if (e3) throw e3;
      const names = new Map((patients ?? []).map((p) => [p.id, p.full_name]));
      return logs.map((l) => ({ ...l, patient: names.get(l.user_id) || "Patient" }));
    },
    enabled: !!profile?.id,
  });

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      shared.filter((log) =>
        [log.patient, log.title, log.content, getLogType(log.log_type).label]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery),
      ),
    [normalizedQuery, shared],
  );
  const selected = filtered.find((log) => log.id === selectedId) ?? filtered[0];
  const patientCount = new Set(shared.map((log) => log.user_id)).size;
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const thisWeekCount = shared.filter((log) => {
    const createdAt = new Date(log.created_at);
    return createdAt >= weekAgo && createdAt <= now;
  }).length;
  const recent = filtered.filter((log) => new Date(log.created_at) >= weekAgo);
  const earlier = filtered.filter((log) => new Date(log.created_at) < weekAgo);
  const firstName = profile?.full_name?.split(" ")[0] || "there";
  const dateLabel = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(now);

  async function exportSelectedLog() {
    if (!selected) return;
    setIsExporting(true);
    try {
      await downloadLogPdf({
        ...selected,
        patientName: selected.patient,
      });
    } catch (error) {
      console.error("Couldn't export the shared health log.", error);
      toast.error("Couldn't export this log. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="provider-workspace space-y-8 pb-8">
      <section className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-lilac">
            <Sparkles className="size-4" />
            {dateLabel}
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
            Welcome back, {firstName}
          </h1>
          <p className="mt-2 max-w-xl text-muted-foreground">
            {profile?.job_title ? `${profile.job_title} · ` : ""}
            Review the health updates patients have shared with you.
            {profile?.organization ? ` ${profile.organization}` : ""}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-xl font-extrabold text-slate-900">{shared.length}</div>
            <div className="text-xs font-medium text-slate-500">Shared logs</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-xl font-extrabold text-violet-600">{patientCount}</div>
            <div className="text-xs font-medium text-slate-500">Patients</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-xl font-extrabold text-indigo-600">{thisWeekCount}</div>
            <div className="text-xs font-medium text-slate-500">This week</div>
          </div>
        </div>
      </section>

      {isError ? (
        <section
          role="alert"
          className="rounded-2xl border border-rose-200 bg-white p-8 text-center"
        >
          <p className="font-bold text-slate-900">We couldn&apos;t load your shared logs.</p>
          <p className="mt-1 text-sm text-slate-500">Please check your connection and try again.</p>
          <Button className="mt-4" variant="glass" size="sm" onClick={() => void refetch()}>
            Try again
          </Button>
        </section>
      ) : isLoading ? (
        <p className="text-center text-muted-foreground">Loading shared logs…</p>
      ) : shared.length === 0 ? (
        <section className="rounded-3xl border border-violet-100 bg-white/90 p-10 text-center shadow-sm">
          <Inbox className="mx-auto size-10 text-lilac" />
          <h2 className="mt-3 font-bold text-slate-900">Nothing shared yet</h2>
          <p className="mt-1 text-sm text-slate-500">
            When a patient shares a health log with {profile?.email}, it will appear here.
          </p>
        </section>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.5fr)]">
          <section className="h-fit rounded-3xl border border-violet-100 bg-white/90 p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">Shared patient logs</h2>
                <p className="mt-1 text-sm text-slate-500">Most recent first</p>
              </div>
              <div className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-700">
                {shared.length} {shared.length === 1 ? "log" : "logs"}
              </div>
            </div>

            <label className="mt-5 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 focus-within:border-violet-300 focus-within:ring-4 focus-within:ring-violet-50">
              <Search className="size-4 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search patients or logs"
                aria-label="Search shared patient logs"
                className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
              />
            </label>

            {recent.length > 0 && (
              <LogGroup
                title="This week"
                logs={recent}
                selectedId={selected?.id}
                onSelect={setSelectedId}
              />
            )}
            {earlier.length > 0 && (
              <LogGroup
                title={recent.length ? "Earlier" : "Shared logs"}
                logs={earlier}
                selectedId={selected?.id}
                onSelect={setSelectedId}
              />
            )}
            {filtered.length === 0 && (
              <p className="py-10 text-center text-sm text-slate-500">
                No shared logs match your search.
              </p>
            )}
          </section>

          {selected && (
            <section className="h-fit overflow-hidden rounded-3xl border border-violet-200 bg-white shadow-sm lg:sticky lg:top-6">
              <div className="bg-gradient-to-br from-violet-200 via-purple-100 to-indigo-100 p-6 text-slate-900 sm:p-8">
                <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
                  <div className="flex items-center gap-4">
                    <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/70 text-lg font-extrabold text-violet-800 ring-1 ring-violet-200">
                      {selected.patient
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((part) => part[0])
                        .join("")
                        .toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="mb-1 text-xs font-bold uppercase tracking-widest text-violet-600">
                        Patient-shared update
                      </div>
                      <h2 className="text-2xl font-extrabold tracking-tight">{selected.patient}</h2>
                      <div className="mt-1 text-sm text-violet-700">
                        {getLogType(selected.log_type).label}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl bg-white/60 px-4 py-3 ring-1 ring-violet-200">
                    <CalendarDays className="size-5 text-violet-600" />
                    <div>
                      <div className="text-xs text-violet-600">Submitted</div>
                      <div className="text-sm font-bold">
                        {new Date(selected.created_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 sm:p-8">
                <div className="mb-5">
                  <h3 className="text-lg font-extrabold text-slate-900">{selected.title}</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {getLogType(selected.log_type).description}
                  </p>
                </div>
                <div className="rounded-2xl border border-violet-100 bg-violet-50 p-5">
                  <div className="flex gap-3">
                    <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white">
                      <FileText className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900">Patient notes</div>
                      <div className="mt-2 space-y-2 text-sm leading-relaxed text-slate-600">
                        {selected.content.split("\n").map((line, index) =>
                          line.startsWith("## ") ? (
                            <h4 key={index} className="pt-2 font-bold text-violet-800">
                              {line.slice(3)}
                            </h4>
                          ) : line ? (
                            <p key={index} className="whitespace-pre-wrap">
                              {line}
                            </p>
                          ) : null,
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Clock3 className="size-4 text-slate-400" />
                    {new Date(selected.created_at).toLocaleTimeString(undefined, {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      variant="glass"
                      onClick={() => void exportSelectedLog()}
                      disabled={isExporting}
                    >
                      <Download className="size-4" />
                      {isExporting ? "Preparing PDF…" : "Export PDF"}
                    </Button>
                    <Button asChild variant="lilac">
                      <Link to="/logs/$id" params={{ id: selected.id }}>
                        View full log
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

type SharedLog = {
  id: string;
  title: string;
  log_type: string;
  content: string;
  created_at: string;
  user_id: string;
  patient: string;
};

function LogGroup({
  title,
  logs,
  selectedId,
  onSelect,
}: {
  title: string;
  logs: SharedLog[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-400">
        <span>{title}</span>
        <span className="h-px flex-1 bg-slate-100" />
      </div>
      <div className="mt-3 space-y-3">
        {logs.map((log) => {
          const isSelected = selectedId === log.id;
          return (
            <button
              key={log.id}
              type="button"
              onClick={() => onSelect(log.id)}
              aria-pressed={isSelected}
              className={`group w-full rounded-2xl border p-4 text-left transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-violet-100 ${
                isSelected
                  ? "border-violet-300 bg-violet-50 shadow-sm"
                  : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-sm font-bold text-violet-700">
                  {log.patient
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((part) => part[0])
                    .join("")
                    .toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate font-bold text-slate-900">{log.patient}</div>
                    <ChevronRight
                      className={`size-4 shrink-0 transition-transform ${isSelected ? "translate-x-0.5 text-violet-600" : "text-slate-400 group-hover:translate-x-0.5"}`}
                    />
                  </div>
                  <div className="mt-1 truncate text-sm font-semibold text-violet-700">
                    {log.title}
                  </div>
                  <div className="mt-1 truncate text-xs text-slate-500">
                    {getLogType(log.log_type).label}
                  </div>
                  <div className="mt-3 text-xs text-slate-400">
                    {new Date(log.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    ·{" "}
                    {new Date(log.created_at).toLocaleTimeString(undefined, {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
