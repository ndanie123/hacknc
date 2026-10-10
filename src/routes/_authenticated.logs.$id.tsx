import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Download, Send, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { getLogType } from "@/lib/log-types";
import { downloadLogPdf } from "@/lib/pdf";

export const Route = createFileRoute("/_authenticated/logs/$id")({
  head: () => ({
    meta: [
      { title: "Health log — AeroHealth" },
      { name: "description", content: "View, export and share a health log." },
      { property: "og:title", content: "Health log — AeroHealth" },
      { property: "og:description", content: "View, export and share a health log." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LogDetail,
});

function LogDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["log", id],
    queryFn: async () => {
      const { data: log, error } = await supabase.from("health_logs").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!log) return null;
      const { data: owner } = await supabase.from("profiles").select("full_name,date_of_birth").eq("id", log.user_id).maybeSingle();
      const isOwner = log.user_id === user?.id;
      let shares: { id: string; provider_id: string; name: string }[] = [];
      if (isOwner) {
        const { data: s } = await supabase.from("log_shares").select("id,provider_id").eq("log_id", id);
        const pids = (s ?? []).map((x) => x.provider_id);
        const { data: provs } = pids.length
          ? await supabase.from("profiles").select("id,full_name,organization").in("id", pids)
          : { data: [] };
        const m = new Map((provs ?? []).map((p) => [p.id, `${p.full_name ?? "Provider"}${p.organization ? ` · ${p.organization}` : ""}`]));
        shares = (s ?? []).map((x) => ({ ...x, name: m.get(x.provider_id) ?? "Provider" }));
      }
      return { log, owner, isOwner, shares };
    },
  });

  if (isLoading) return <p className="text-center text-muted-foreground">Loading…</p>;
  if (!data) return <p className="glass rounded-3xl p-10 text-center">This log isn't available.</p>;
  const { log, owner, isOwner, shares } = data;

  async function share() {
    const { data: found, error } = await supabase.rpc("find_provider_by_email", { _email: email });
    if (error) { toast.error(error.message); return; }
    const p = found?.[0];
    if (!p) { toast.error("No provider account found with that email."); return; }
    const { error: e2 } = await supabase.from("log_shares").insert({ log_id: id, provider_id: p.id });
    if (e2) { toast.error(e2.code === "23505" ? "Already shared with this provider." : e2.message); return; }
    toast.success(`Shared with ${p.full_name ?? "provider"}`);
    setEmail("");
    qc.invalidateQueries({ queryKey: ["log", id] });
  }

  async function unshare(shareId: string) {
    await supabase.from("log_shares").delete().eq("id", shareId);
    qc.invalidateQueries({ queryKey: ["log", id] });
  }

  async function remove() {
    if (!confirm("Delete this log?")) return;
    await supabase.from("health_logs").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["my-logs"] });
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="glass" size="sm">
        <Link to="/dashboard"><ArrowLeft /> Back</Link>
      </Button>
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <article className="glass rounded-[2rem] p-8">
          <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-bold text-secondary-foreground">
            {getLogType(log.log_type).label}
          </span>
          <h1 className="mt-3 text-3xl font-bold">{log.title}</h1>
          <p className="text-sm text-muted-foreground">
            {owner?.full_name ?? "Patient"} · {new Date(log.created_at).toLocaleString()}
          </p>
          <div className="mt-6 space-y-2">
            {log.content.split("\n").map((line, i) =>
              line.startsWith("## ") ? (
                <h2 key={i} className="pt-3 text-lg font-bold text-lilac">{line.slice(3)}</h2>
              ) : (
                <p key={i} className="whitespace-pre-wrap">{line}</p>
              ),
            )}
          </div>
        </article>

        <aside className="space-y-4">
          <div className="glass rounded-3xl p-6">
            <h3 className="font-bold">Export</h3>
            <Button
              className="mt-3 w-full"
              onClick={() =>
                downloadLogPdf({ ...log, patientName: owner?.full_name, dateOfBirth: owner?.date_of_birth })
              }
            >
              <Download /> Download PDF
            </Button>
          </div>

          {isOwner && (
            <div className="glass rounded-3xl p-6">
              <h3 className="font-bold">Share with a provider</h3>
              <p className="text-xs text-muted-foreground">Enter your provider's AeroHealth account email.</p>
              <div className="mt-3 flex gap-2">
                <Input className="bg-card" type="email" placeholder="provider@clinic.org" value={email} onChange={(e) => setEmail(e.target.value)} />
                <Button size="icon" variant="leaf" onClick={share} aria-label="Share"><Send /></Button>
              </div>
              {shares.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {shares.map((s) => (
                    <li key={s.id} className="flex items-center justify-between rounded-2xl bg-card px-3 py-2 text-sm">
                      {s.name}
                      <button onClick={() => unshare(s.id)} aria-label="Stop sharing" className="text-muted-foreground hover:text-destructive">
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {isOwner && (
            <Button variant="destructive" className="w-full" onClick={remove}><Trash2 /> Delete log</Button>
          )}
        </aside>
      </div>
    </div>
  );
}
