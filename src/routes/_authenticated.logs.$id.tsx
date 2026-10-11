import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Download, Pencil, Send, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { getLogType } from "@/lib/log-types";
import { downloadLogPdf } from "@/lib/pdf";
import { CARE_TEAM, type CareTeamMember } from "@/lib/care-team";

export const Route = createFileRoute("/_authenticated/logs/$id")({
  head: () => ({
    meta: [
      { title: "Health log — Log Companion" },
      { name: "description", content: "View, export and share a health log." },
      { property: "og:title", content: "Health log — Log Companion" },
      { property: "og:description", content: "View, export and share a health log." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LogDetail,
});

function LogDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["log", id],
    queryFn: async () => {
      const { data: log, error } = await supabase.from("health_logs").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!log) return null;
      const { data: owner } = await supabase.from("profiles").select("full_name,date_of_birth").eq("id", log.user_id).maybeSingle();
      const isOwner = log.user_id === user?.id;
      let shares: { id: string; provider_id: string; providerEmail: string }[] = [];
      if (isOwner) {
        const { data: s } = await supabase.from("log_shares").select("id,provider_id").eq("log_id", id);
        const pids = (s ?? []).map((x) => x.provider_id);
        const { data: provs } = pids.length
          ? await supabase.from("profiles").select("id,email").in("id", pids)
          : { data: [] };
        const m = new Map((provs ?? []).map((p) => [p.id, (p.email ?? "").toLowerCase()]));
        shares = (s ?? []).map((x) => ({ ...x, providerEmail: m.get(x.provider_id) ?? "" }));
      }
      return { log, owner, isOwner, shares };
    },
  });

  if (isLoading) return <p className="text-center text-muted-foreground">Loading…</p>;
  if (!data) return <p className="glass rounded-lg p-10 text-center">This log isn't available.</p>;
  const { log, owner, isOwner, shares } = data;

  async function share(doc: CareTeamMember) {
    if (!doc.email) {
      toast.info(`${doc.name}'s office isn't connected to Log Companion yet — download the PDF to bring to your visit.`);
      return;
    }
    const { data: found, error } = await supabase.rpc("find_provider_by_email", { _email: doc.email });
    if (error) { toast.error(error.message); return; }
    const p = found?.[0];
    if (!p) { toast.error(`${doc.name} isn't available right now.`); return; }
    const { error: e2 } = await supabase.from("log_shares").insert({ log_id: id, provider_id: p.id });
    if (e2) { toast.error(e2.code === "23505" ? "Already shared with this provider." : e2.message); return; }
    toast.success(`Shared with ${doc.name}`);
    qc.invalidateQueries({ queryKey: ["log", id] });
  }

  async function unshare(shareId: string) {
    await supabase.from("log_shares").delete().eq("id", shareId);
    qc.invalidateQueries({ queryKey: ["log", id] });
  }

  function startEdit() {
    setEditTitle(log.title);
    setEditContent(log.content);
    setEditing(true);
  }

  async function saveEdit() {
    if (!editTitle.trim() || !editContent.trim()) {
      toast.error("Your log needs a title and some notes.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("health_logs")
      .update({ title: editTitle.trim(), content: editContent })
      .eq("id", id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Log updated");
    setEditing(false);
    qc.invalidateQueries({ queryKey: ["log", id] });
    qc.invalidateQueries({ queryKey: ["my-logs"] });
  }

  const wasEdited = new Date(log.updated_at).getTime() - new Date(log.created_at).getTime() > 60_000;

  return (
    <div className="space-y-6">
      <Button asChild variant="glass" size="sm">
        <Link to="/dashboard"><ArrowLeft /> Your logs</Link>
      </Button>
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <article className="glass rounded-lg p-8">
          <div className="flex items-start justify-between gap-4">
            <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-bold text-secondary-foreground">
              {getLogType(log.log_type).label}
            </span>
            {isOwner && !editing && (
              <Button variant="glass" size="sm" onClick={startEdit}>
                <Pencil className="h-4 w-4" /> Edit
              </Button>
            )}
          </div>
          {editing ? (
            <div className="mt-4 space-y-3">
              <div>
                <label htmlFor="edit-title" className="text-sm font-semibold">Log title</label>
                <Input id="edit-title" className="mt-1 bg-card" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
              </div>
              <div>
                <label htmlFor="edit-content" className="text-sm font-semibold">Log notes</label>
                <textarea
                  id="edit-content"
                  className="mt-1 min-h-72 w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Tip: lines starting with &quot;## &quot; become purple section headings, like &quot;Check-in Timeline&quot;.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="leaf" onClick={saveEdit} disabled={saving}>
                  {saving ? "Saving…" : "Save changes"}
                </Button>
                <Button variant="ghost" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="mt-3 text-3xl font-bold">{log.title}</h1>
              <p className="text-sm text-muted-foreground">
                {owner?.full_name ?? "Patient"} · {new Date(log.created_at).toLocaleString()}
                {wasEdited && <> · edited {new Date(log.updated_at).toLocaleString()}</>}
              </p>
              <div className="document-body mt-6 space-y-2">
                {log.content.split("\n").map((line, i) =>
                  line.startsWith("## ") ? (
                    <h2 key={i} className="pt-3 text-lg font-bold text-lilac">{line.slice(3)}</h2>
                  ) : (
                    <p key={i} className="whitespace-pre-wrap">{line}</p>
                  ),
                )}
              </div>
            </>
          )}
        </article>

        <aside className="space-y-4">
          <div className="border-b border-border pb-6">
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
            <div className="border-b border-border pb-6">
              <h3 className="font-bold">Share with your care team</h3>
              <p className="text-xs text-muted-foreground">Doctors from your visit history. Only providers you've already seen are listed.</p>
              <ul className="mt-3 space-y-2">
                {CARE_TEAM.map((doc) => {
                  const shared = shares.find((s) => doc.email && s.providerEmail === doc.email.toLowerCase());
                  return (
                    <li key={doc.name} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
                      <img
                        src={doc.photo}
                        alt=""
                        aria-hidden="true"
                        className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-border"
                      />

                      <div className="min-w-0 flex-1 text-sm">
                        <p className="font-semibold">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">{doc.title}</p>
                        <p className="text-xs text-muted-foreground">{doc.location}</p>
                        <p className="mt-1 text-xs">
                          <span className="font-semibold text-lilac">{doc.relationship}</span>
                          <span className="text-muted-foreground"> · Last visit {doc.lastVisit}</span>
                        </p>
                      </div>
                      {shared ? (
                        <Button variant="ghost" size="sm" onClick={() => unshare(shared.id)} aria-label={`Stop sharing with ${doc.name}`}>
                          <X className="h-4 w-4" /> Shared
                        </Button>
                      ) : (
                        <Button variant="lilacSoft" size="sm" onClick={() => share(doc)} aria-label={`Share with ${doc.name}`}>
                          <Send className="h-4 w-4" /> Share
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

        </aside>
      </div>
    </div>
  );
}
