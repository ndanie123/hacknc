import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, HeartHandshake, RotateCcw, Save, SendHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { LOG_TYPES, getLogType } from "@/lib/log-types";
import { formatHelpyLog } from "@/lib/helpy.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/logs/new")({
  head: () => ({
    meta: [
      { title: "New health log with Helpy — Log Companion" },
      { name: "description", content: "Check in with Helpy and turn your day into a provider-ready health log." },
      { property: "og:title", content: "New health log with Helpy — Log Companion" },
      { property: "og:description", content: "Check in with Helpy and turn your day into a provider-ready health log." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NewLog,
});

const QUESTIONS = [
  "Hi, I'm Helpy! How are you feeling today? Tell me about any symptom — and whether it's new or how long it's been going on.",
  "Thanks for sharing. Have you taken any medications today? Include the name, dose and roughly when, if you can.",
  "Last one: can you summarize your day around this symptom — when it showed up, what you were doing, and anything that helped or made it worse?",
];

type Msg = { role: "helpy" | "patient"; text: string; at: Date };

const fmtTime = (d: Date) => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

function NewLog() {
  const { user, profile } = useAuth();
  const userId = user?.id ?? "";
  const navigate = useNavigate();
  const formatFn = useServerFn(formatHelpyLog);
  const [type, setType] = useState("symptom");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [formatting, setFormatting] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (profile?.account_type === "provider") navigate({ to: "/dashboard" });
  }, [profile, navigate]);

  // Start the conversation after hydration so timestamps are client-local.
  useEffect(() => {
    setMessages([{ role: "helpy", text: QUESTIONS[0]!, at: new Date() }]);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, formatting]);

  const answered = messages.filter((m) => m.role === "patient").length;
  const done = answered >= QUESTIONS.length;

  async function runFormat(all: Msg[]) {
    const pairs = [];
    for (let i = 0; i < all.length; i++) {
      const m = all[i]!;
      if (m.role === "patient") {
        const q = all[i - 1];
        pairs.push({
          question: q?.text ?? "",
          answer: m.text,
          at: `${m.at.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} ${fmtTime(m.at)}`,
        });
      }
    }
    const t = getLogType(type);
    setFormatting(true);
    try {
      const res = await formatFn({
        data: {
          logType: t.id,
          logTypeLabel: t.label,
          sections: t.sections,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          answers: pairs,
        },
      });
      if (!res.ok) {
        toast.error(res.error);
        setMessages((p) => [...p, { role: "helpy", text: res.error, at: new Date() }]);
        return;
      }
      setTitle(res.title);
      setContent(res.content);
      setMessages((p) => [
        ...p,
        { role: "helpy", text: "All done! I've written up your log on the right. Review it, make any edits, then save it so you can share it with your provider.", at: new Date() },
      ]);
    } catch (e) {
      console.error(e);
      toast.error("Helpy couldn't format your log. Please try again.");
    } finally {
      setFormatting(false);
    }
  }

  function send() {
    const text = input.trim();
    if (!text || done || formatting) return;
    const next: Msg[] = [...messages, { role: "patient", text, at: new Date() }];
    const nextAnswered = answered + 1;
    if (nextAnswered < QUESTIONS.length) {
      next.push({ role: "helpy", text: QUESTIONS[nextAnswered]!, at: new Date() });
    }
    setMessages(next);
    setInput("");
    inputRef.current?.focus();
    if (nextAnswered >= QUESTIONS.length) void runFormat(next);
  }

  function restart() {
    setMessages([{ role: "helpy", text: QUESTIONS[0]!, at: new Date() }]);
    setInput("");
    inputRef.current?.focus();
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
    <div className="space-y-8">
      <div className="workspace-heading">
        <Button asChild variant="ghost" className="mb-4 -ml-3"><Link to="/dashboard"><ArrowLeft /> Your logs</Link></Button>
        <p className="workspace-kicker">Your health story</p>
        <h1 className="font-semibold">Create a new log</h1>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <section className="glass flex flex-col rounded-lg p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-secondary">
                <HeartHandshake className="h-5 w-5 text-primary" />
              </span>
              <div>
                <h2 className="text-xl font-bold">Helpy</h2>
                <p className="text-xs text-muted-foreground">Your check-in companion · {Math.min(answered + 1, 3)} of 3</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={restart} disabled={formatting}><RotateCcw /> Start over</Button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Log type">
            {LOG_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={type === t.id}
                onClick={() => setType(t.id)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                  type === t.id ? "border-primary bg-secondary text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div ref={scrollRef} className="mt-4 flex h-[380px] flex-col gap-3 overflow-y-auto rounded-lg border border-border bg-muted/40 p-4" aria-live="polite">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex flex-col", m.role === "patient" ? "items-end" : "items-start")}>
                <div
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm",
                    m.role === "patient" ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm border border-border bg-card text-foreground",
                  )}
                >
                  {m.text}
                </div>
                <span className="mt-1 text-[11px] text-muted-foreground">{m.role === "helpy" ? "Helpy" : "You"} · {fmtTime(m.at)}</span>
              </div>
            ))}
            {formatting && (
              <div className="flex items-start">
                <div className="rounded-2xl rounded-bl-sm border border-border bg-card px-4 py-2 text-sm text-muted-foreground">
                  Helpy is writing up your log…
                </div>
              </div>
            )}
          </div>

          <div className="mt-3 flex gap-2">
            <Textarea
              ref={inputRef}
              autoFocus
              className="min-h-[52px] flex-1 resize-none bg-card"
              placeholder={done ? "Check-in complete" : "Type your answer…"}
              value={input}
              disabled={done || formatting}
              aria-label="Your answer to Helpy"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
              }}
            />
            <Button size="icon" className="h-[52px] w-[52px] shrink-0" onClick={send} disabled={!input.trim() || done || formatting} aria-label="Send">
              <SendHorizontal />
            </Button>
          </div>
        </section>

        <section className="glass flex flex-col rounded-lg p-6">
          <p className="text-sm font-bold">Your provider-ready log</p>
          <p className="text-xs text-muted-foreground">Helpy fills this in with dates and times once you finish the check-in. You can edit anything.</p>
          <Input aria-label="Log title" className="mt-3 bg-card" placeholder="Log title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea
            className="mt-3 min-h-[360px] flex-1 bg-card font-mono text-sm"
            placeholder="Your formatted log will appear here after you answer Helpy's three questions."
            value={content}
            aria-label="Formatted log"
            onChange={(e) => setContent(e.target.value)}
          />
          <Button className="mt-4" variant="leaf" size="lg" onClick={save} disabled={saving || !content.trim()}>
            <Save /> {saving ? "Saving…" : "Save log"}
          </Button>
        </section>
      </div>
    </div>
  );
}
