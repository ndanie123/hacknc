import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ChevronRight, Inbox, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { getLogType } from "@/lib/log-types";

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

function LogCard({ log, subtitle, accent }: { log: { id: string; title: string; log_type: string; created_at: string }; subtitle?: string; accent?: boolean }) {
  return (
    <Link to="/logs/$id" params={{ id: log.id }} className={`log-list-card ${accent ? "provider-log" : ""}`}>
      <span className="log-date"><strong>{new Date(log.created_at).getDate()}</strong><small>{new Date(log.created_at).toLocaleDateString(undefined, {month: "short"})}</small></span>
      <div className="min-w-0 flex-1">
        <span className={accent ? "text-xs font-semibold text-lilac" : "text-xs font-semibold text-primary"}>{getLogType(log.log_type).label}</span>
        <h3 className="mt-1 break-words text-lg font-bold">{log.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle ? `${subtitle} · ` : ""}{new Date(log.created_at).toLocaleDateString()}</p>
      </div>
      <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground" />
    </Link>
  );
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
  const { data: shared = [], isLoading } = useQuery({
    queryKey: ["shared-logs"],
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
        .select("id,title,log_type,created_at,user_id")
        .in("id", ids)
        .order("created_at", { ascending: false });
      if (e2) throw e2;
      const userIds = [...new Set(logs.map((l) => l.user_id))];
      const { data: patients } = await supabase.from("profiles").select("id,full_name").in("id", userIds);
      const names = new Map((patients ?? []).map((p) => [p.id, p.full_name]));
      return logs.map((l) => ({ ...l, patient: names.get(l.user_id) || "Patient" }));
    },
  });

  return (
    <div className="provider-workspace space-y-8">
      <section className="workspace-heading">
        
        <div>
          <p className="workspace-kicker">For providers</p>
          <h1 className="font-semibold">Provider workspace</h1>
          <p className="mt-1 text-muted-foreground">
            {profile?.job_title ? `${profile.job_title} · ` : ""}
            {profile?.organization || "Your organization"} — logs patients have shared with you.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Patients share logs using your account email: <b>{profile?.email}</b>
          </p>
        </div>
      </section>
      <section>
        <div className="mb-6 flex items-center justify-between"><h2 className="text-xl font-bold">Shared with you</h2><span className="text-sm text-muted-foreground">{shared.length} logs</span></div>
        {isLoading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : shared.length === 0 ? (
          <div className="glass rounded-lg p-10 text-center">
            <Inbox className="mx-auto h-10 w-10 text-lilac" />
            <p className="mt-3 font-bold">Nothing shared yet</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {shared.map((l) => <LogCard key={l.id} log={l} subtitle={l.patient} accent />)}
          </div>
        )}
      </section>
    </div>
  );
}
