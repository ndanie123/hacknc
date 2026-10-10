import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FilePlus2, FileText, Inbox } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { getLogType } from "@/lib/log-types";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — AeroHealth" },
      { name: "description", content: "Your health logs and shared records." },
      { property: "og:title", content: "Dashboard — AeroHealth" },
      { property: "og:description", content: "Your health logs and shared records." },
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
    <Link to="/logs/$id" params={{ id: log.id }} className="glass block rounded-3xl p-5 transition-transform hover:-translate-y-1">
      {accent && <span aria-hidden="true" className="gloss-lilac mb-3 block h-1 w-12 rounded-full" />}
      <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-bold text-secondary-foreground">
        {getLogType(log.log_type).label}
      </span>
      <h3 className="mt-3 text-lg font-bold">{log.title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {subtitle ? `${subtitle} · ` : ""}
        {new Date(log.created_at).toLocaleDateString()}
      </p>
    </Link>
  );
}

function PatientDashboard() {
  const { profile } = useAuth();
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["my-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("health_logs")
        .select("id,title,log_type,created_at")
        .eq("user_id", profile!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-8">
      <section className="glass flex flex-col items-start justify-between gap-6 rounded-[2rem] p-8 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold">Hi {profile?.full_name?.split(" ")[0] ?? "there"} 👋</h1>
          <p className="mt-1 text-muted-foreground">Ready to capture how you've been feeling?</p>
        </div>
        <Button asChild size="lg" variant="leaf">
          <Link to="/logs/new"><FilePlus2 /> Create new log</Link>
        </Button>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold text-shadow-soft">Your logs</h2>
        {isLoading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : logs.length === 0 ? (
          <div className="glass rounded-3xl p-10 text-center">
            <FileText className="mx-auto h-10 w-10 text-primary" />
            <p className="mt-3 font-bold">No logs yet</p>
            <p className="text-sm text-muted-foreground">Create your first log to bring to your next appointment.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {logs.map((l) => <LogCard key={l.id} log={l} />)}
          </div>
        )}
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
        .eq("provider_id", profile!.id);
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
    <div className="space-y-8">
      <section className="glass overflow-hidden rounded-[2rem]">
        <div aria-hidden="true" className="gloss-lilac h-1.5 w-full" />
        <div className="p-8">
          <h1 className="text-3xl font-bold">Provider workspace</h1>
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
        <h2 className="mb-4 text-xl font-bold text-shadow-soft">Shared with you</h2>
        {isLoading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : shared.length === 0 ? (
          <div className="glass rounded-3xl p-10 text-center">
            <Inbox className="mx-auto h-10 w-10 text-lilac" />
            <p className="mt-3 font-bold">Nothing shared yet</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shared.map((l) => <LogCard key={l.id} log={l} subtitle={l.patient} accent />)}
          </div>
        )}
      </section>
    </div>
  );
}
