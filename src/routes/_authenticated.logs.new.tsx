import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bot, Save, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { LOG_TYPES, draftFromPrompt, getLogType } from "@/lib/log-types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/logs/new")({
  head: () => ({
    meta: [
      { title: "New health log — AeroHealth" },
      { name: "description", content: "Create a new structured health log." },
      { property: "og:title", content: "New health log — AeroHealth" },
      { property: "og:description", content: "Create a new structured health log." },
    ],
  }),
  component: NewLog,
});

function NewLog() {
  const { user, profile } = useAuth();
  const userId = user?.id ?? "";
  const navigate = useNavigate();
  const [type, setType] = useState("general");
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile?.account_type === "provider") navigate({ to: "/dashboard" });
  }, [profile, navigate]);

  function draft() {
    if (!prompt.trim()) { toast.error("Tell the assistant what you'd like to log first."); return; }
    setContent(draftFromPrompt(type, prompt));
    if (!title) setTitle(`${getLogType(type).label} — ${new Date().toLocaleDateString()}`);
  }

  async function save() {
    if (!title.trim()) { toast.error("Add a title"); return; }
    setSaving(true);
    const { data, error } = await supabase
      .from("health_logs")
      .insert({ user_id: userId, title, log_type: type, content })
      .select("id")
      .single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Log saved");
    navigate({ to: "/logs/$id", params: { id: data.id } });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <section className="glass rounded-[2rem] p-6">
        <div className="flex items-center gap-3">
          <span className="gloss-leaf grid h-11 w-11 place-items-center rounded-full">
            <Bot className="h-5 w-5 text-leaf-foreground" />
          </span>
          <div>
            <h1 className="text-xl font-bold">Log assistant</h1>
            <p className="text-xs text-muted-foreground">Smart drafting coming soon — for now it builds a template.</p>
          </div>
        </div>

        <p className="mt-6 text-sm font-bold">1. What kind of log?</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {LOG_TYPES.map((t) => (
            <button
              key={t.id}
              onClick={() => setType(t.id)}
              className={cn(
                "rounded-2xl border-2 p-3 text-left transition-all",
                type === t.id ? "border-primary bg-card" : "border-transparent bg-muted",
              )}
            >
              <p className="text-sm font-bold">{t.label}</p>
              <p className="text-xs text-muted-foreground">{t.description}</p>
            </button>
          ))}
        </div>

        <p className="mt-6 text-sm font-bold">2. Tell the assistant what's going on</p>
        <Textarea
          className="mt-2 min-h-32 bg-card"
          placeholder="e.g. I've had trouble sleeping for two weeks and my anxiety is worse in the mornings…"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <Button className="mt-3 w-full" onClick={draft}><Wand2 /> Draft my log</Button>
      </section>

      <section className="glass flex flex-col rounded-[2rem] p-6">
        <p className="text-sm font-bold">3. Review & save</p>
        <Input className="mt-2 bg-card" placeholder="Log title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea
          className="mt-3 min-h-[360px] flex-1 bg-card font-mono text-sm"
          placeholder="Your drafted log will appear here. Use '## ' to start a section."
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <Button className="mt-4" variant="leaf" size="lg" onClick={save} disabled={saving}>
          <Save /> {saving ? "Saving…" : "Save log"}
        </Button>
      </section>
    </div>
  );
}
