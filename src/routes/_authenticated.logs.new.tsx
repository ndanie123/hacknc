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
import { chatWithHelpy, formatHelpyLog } from "@/lib/helpy.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/logs/new")({
  head: () => ({
    meta: [
      { title: "New health log with Helpy — Log Companion" },
      {
        name: "description",
        content: "Create a personal health log with Helpy.",
      },
    ],
  }),
  component: NewLog,
});

type Msg = {
  role: "helpy" | "patient";
  text: string;
  at: Date;
};

const WELCOME_MESSAGE =
  "Hi! I'm Helpy, your health journaling companion. " +
  "I'm here to help you organize what you'd like to record. " +
  "What would you like to write about today? " +
  "Please avoid sharing personal identifiers or sensitive details.";

const MAX_MESSAGES = 30;

const fmtTime = (date: Date) =>
  date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

function initialMessages(): Msg[] {
  return [
    {
      role: "helpy",
      text: WELCOME_MESSAGE,
      at: new Date(),
    },
  ];
}

function NewLog() {
  const { user, profile } = useAuth();
  const userId = user?.id ?? "";
  const navigate = useNavigate();

  const chatFn = useServerFn(chatWithHelpy);
  const formatFn = useServerFn(formatHelpyLog);

  const [type, setType] = useState("symptom");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");

  const [chatting, setChatting] = useState(false);
  const [formatting, setFormatting] = useState(false);
  const [completed, setCompleted] = useState(false);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (profile?.account_type === "provider") {
      navigate({ to: "/dashboard" });
    }
  }, [profile, navigate]);

  useEffect(() => {
    setMessages(initialMessages());
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, chatting, formatting]);

  const answered = messages.filter((message) => message.role === "patient").length;

  const busy = chatting || formatting || saving;

  const conversationLimitReached = messages.length >= MAX_MESSAGES;

  const canSend =
    !busy &&
    !completed &&
    !conversationLimitReached &&
    input.trim().length > 0 &&
    input.length <= 2000;

  // --------------------------------------------
  // Chat with Gemini
  // --------------------------------------------

  async function send() {
    if (!canSend) return;

    const text = input.trim();

    const patientMessage: Msg = {
      role: "patient",
      text,
      at: new Date(),
    };

    const nextMessages = [...messages, patientMessage];

    setMessages(nextMessages);
    setInput("");
    setChatting(true);

    try {
      const result = await chatFn({
        data: {
          logType: getLogType(type).label,
          messages: nextMessages.map((message) => ({
            role: message.role,
            text: message.text,
          })),
        },
      });

      if (!result.ok) {
        toast.error(result.error);
        // Keep the message available for another attempt.
        setInput(text);
        setMessages(messages);
        return;
      }

      setMessages([
        ...nextMessages,
        {
          role: "helpy",
          text: result.reply,
          at: new Date(),
        },
      ]);
    } catch (error) {
      console.error("Helpy chat failed:", error);
      toast.error("Helpy couldn't respond. Please try again.");

      setInput(text);
      setMessages(messages);
    } finally {
      setChatting(false);
      inputRef.current?.focus();
    }
  }

  // --------------------------------------------
  // Generate the health log
  // --------------------------------------------

  async function runFormat() {
    if (busy || answered === 0) return;

    const pairs: {
      question: string;
      answer: string;
      at: string;
    }[] = [];

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i]!;

      if (message.role !== "patient") continue;

      const previousMessage = messages[i - 1];

      pairs.push({
        question: previousMessage?.role === "helpy" ? previousMessage.text.slice(0, 500) : "",
        answer: message.text,
        at: `${message.at.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })} ${fmtTime(message.at)}`,
      });
    }

    const selectedType = getLogType(type);

    setFormatting(true);

    try {
      const result = await formatFn({
        data: {
          logType: selectedType.id,
          logTypeLabel: selectedType.label,
          sections: selectedType.sections,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          answers: pairs,
        },
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setTitle(result.title);
      setContent(result.content);
      setCompleted(true);

      setMessages((previous) => [
        ...previous,
        {
          role: "helpy",
          text:
            "Your log is ready! I've organized what you shared " +
            "on the right. Please review it, make any changes " +
            "you'd like, and save it when you're ready.",
          at: new Date(),
        },
      ]);

      toast.success("Your health log is ready!");
    } catch (error) {
      console.error("Helpy log generation failed:", error);
      toast.error("Helpy couldn't generate your log. Try again.");
    } finally {
      setFormatting(false);
    }
  }

  // --------------------------------------------
  // Restart the check-in
  // --------------------------------------------

  function restart() {
    if (busy) return;

    setMessages(initialMessages());
    setInput("");
    setCompleted(false);
    setTitle("");
    setContent("");

    inputRef.current?.focus();
  }

  // --------------------------------------------
  // Save to Supabase
  // --------------------------------------------

  async function save() {
    if (busy) return;

    if (!userId) {
      toast.error("Please sign in to save your log.");
      return;
    }

    if (!title.trim()) {
      toast.error("Add a title.");
      return;
    }

    if (!content.trim()) {
      toast.error("Your log is empty.");
      return;
    }

    setSaving(true);

    try {
      const { data, error } = await supabase
        .from("health_logs")
        .insert({
          user_id: userId,
          title: title.trim(),
          log_type: type,
          content,
        })
        .select("id")
        .single();

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Log saved!");

      navigate({
        to: "/logs/$id",
        params: { id: data.id },
      });
    } catch (error) {
      console.error("Save failed:", error);
      toast.error("Couldn't save your log.");
    } finally {
      setSaving(false);
    }
  }

  // --------------------------------------------
  // User interface
  // --------------------------------------------

  return (
    <div className="space-y-8">
      <div className="workspace-heading">
        <Button asChild variant="ghost" className="mb-4 -ml-3">
          <Link to="/dashboard">
            <ArrowLeft />
            Your logs
          </Link>
        </Button>

        <p className="workspace-kicker">Your health story</p>
        <h1 className="font-semibold">Create a new log</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        {/* HELPY CHAT PANEL */}

        <section className="glass flex flex-col rounded-lg p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-secondary">
                <HeartHandshake className="h-5 w-5 text-primary" />
              </span>

              <div>
                <h2 className="text-xl font-bold">Helpy</h2>
                <p className="text-xs text-muted-foreground">
                  Your conversational health log companion
                </p>
              </div>
            </div>

            <Button variant="ghost" size="sm" onClick={restart} disabled={busy}>
              <RotateCcw />
              Start over
            </Button>
          </div>

          {/* PRIVACY NOTICE */}

          <p className="mt-4 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            Helpy helps document your experiences, not diagnose conditions or provide medical
            advice. Please avoid sharing identifying information or sensitive details. You can skip
            questions or finish at any time.
          </p>

          {/* LOG TYPE SELECTOR */}

          <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Log type">
            {LOG_TYPES.map((logType) => (
              <button
                key={logType.id}
                type="button"
                aria-pressed={type === logType.id}
                disabled={busy || completed}
                onClick={() => setType(logType.id)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                  type === logType.id
                    ? "border-primary bg-secondary text-primary"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {logType.label}
              </button>
            ))}
          </div>

          {/* CONVERSATION */}

          <div
            ref={scrollRef}
            className="mt-4 flex h-[380px] flex-col gap-3 overflow-y-auto rounded-lg border border-border bg-muted/40 p-4"
            aria-live="polite"
            aria-label="Conversation with Helpy"
          >
            {messages.map((message, index) => (
              <div
                key={index}
                className={cn(
                  "flex flex-col",
                  message.role === "patient" ? "items-end" : "items-start",
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm",
                    message.role === "patient"
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-bl-sm border border-border bg-card text-foreground",
                  )}
                >
                  {message.text}
                </div>

                <span className="mt-1 text-[11px] text-muted-foreground">
                  {message.role === "helpy" ? "Helpy" : "You"}
                  {" · "}
                  {fmtTime(message.at)}
                </span>
              </div>
            ))}

            {chatting && (
              <div className="flex items-start">
                <div className="rounded-2xl rounded-bl-sm border border-border bg-card px-4 py-2 text-sm text-muted-foreground">
                  Helpy is thinking...
                </div>
              </div>
            )}

            {formatting && (
              <div className="flex items-start">
                <div className="rounded-2xl rounded-bl-sm border border-border bg-card px-4 py-2 text-sm text-muted-foreground">
                  Helpy is organizing your log...
                </div>
              </div>
            )}

            {conversationLimitReached && !completed && (
              <p className="text-center text-xs text-muted-foreground">
                You've reached the conversation limit. You can generate your log now.
              </p>
            )}
          </div>

          {/* MESSAGE INPUT */}

          <div className="mt-3 flex gap-2">
            <Textarea
              ref={inputRef}
              autoFocus
              className="min-h-[52px] flex-1 resize-none bg-card"
              placeholder={
                completed
                  ? "Check-in complete"
                  : conversationLimitReached
                    ? "Ready to generate your log"
                    : "Message Helpy..."
              }
              value={input}
              maxLength={2000}
              disabled={busy || completed || conversationLimitReached}
              aria-label="Your message to Helpy"
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  void send();
                }
              }}
            />

            <Button
              size="icon"
              className="h-[52px] w-[52px] shrink-0"
              onClick={() => void send()}
              disabled={!canSend}
              aria-label="Send message"
            >
              <SendHorizontal />
            </Button>
          </div>

          {/* GENERATE LOG */}

          <Button
            className="mt-3 w-full"
            variant="outline"
            disabled={busy || answered === 0 || completed}
            onClick={() => void runFormat()}
          >
            <Save className="mr-2 h-4 w-4" />
            {formatting
              ? "Generating your log..."
              : completed
                ? "Log generated"
                : "Finish & Generate Log"}
          </Button>

          <p className="mt-2 text-center text-xs text-muted-foreground">
            You decide when your check-in is complete.
          </p>
        </section>

        {/* GENERATED LOG PANEL */}

        <section className="glass flex flex-col rounded-lg p-6">
          <p className="text-sm font-bold">Your provider-ready log</p>

          <p className="text-xs text-muted-foreground">
            When you're finished chatting, Helpy will organize your notes here. Review and edit
            everything before saving.
          </p>

          <Input
            aria-label="Log title"
            className="mt-3 bg-card"
            placeholder="Log title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />

          <Textarea
            className="mt-3 min-h-[360px] flex-1 bg-card font-mono text-sm"
            placeholder={
              "Your formatted log will appear here after " +
              "you select Finish & Generate Log. " +
              "You can also write your own log."
            }
            value={content}
            aria-label="Formatted log"
            onChange={(event) => setContent(event.target.value)}
          />

          <Button
            className="mt-4"
            variant="leaf"
            size="lg"
            onClick={() => void save()}
            disabled={busy || !content.trim()}
          >
            <Save />
            {saving ? "Saving..." : "Save log"}
          </Button>
        </section>
      </div>
    </div>
  );
}
