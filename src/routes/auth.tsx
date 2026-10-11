import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { cloneElement, isValidElement, useEffect, useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { HeartPulse, Stethoscope } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

type Search = { mode?: "signin" | "signup"; type?: "patient" | "provider" };

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    mode: s["mode"] === "signup" ? "signup" : "signin",
    type: s["type"] === "provider" ? "provider" : "patient",
  }),
  head: () => ({
    meta: [
      { title: "Sign in or create an account — Log Companion" },
      { name: "description", content: "Sign in to Log Companion or create a patient or provider account." },
      { property: "og:title", content: "Sign in — Log Companion" },
      { property: "og:description", content: "Patient and provider accounts for structured health logs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState(search.mode ?? "signin");
  const [type, setType] = useState(search.type ?? "patient");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [f, setF] = useState({ email: "", password: "", full_name: "", date_of_birth: "", organization: "", job_title: "" });

  useEffect(() => {
    setMode(search.mode ?? "signin");
    setType(search.type ?? "patient");
  }, [search.mode, search.type]);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: f.email, password: f.password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email: f.email,
          password: f.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              account_type: type,
              full_name: f.full_name,
              date_of_birth: type === "patient" ? f.date_of_birth : "",
              organization: type === "provider" ? f.organization : "",
              job_title: type === "provider" ? f.job_title : "",
            },
          },
        });
        if (error) throw error;
        setSent(true);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) toast.error("Google sign-in failed");
  }

  return (
    <div className="companion-auth companion-grid min-h-screen">
      <AppHeader />
      <main className="mx-auto flex w-[min(480px,calc(100%-1.5rem))] flex-col py-12">
        <div className="glass rounded-lg p-6 sm:p-10">
          {sent ? (
            <div className="text-center">
              <h1 className="text-2xl font-bold">Check your email</h1>
              <p className="mt-2 text-muted-foreground">
                We sent a confirmation link to <b>{f.email}</b>. Click it to finish creating your account.
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-3xl font-bold">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {mode === "signin" ? "Sign in to your health logs." : "Choose the account that fits you."}
              </p>

              {mode === "signup" && (
                <div className="mt-6 grid grid-cols-2 gap-3">
                  {([
                    { id: "patient", label: "Patient", icon: HeartPulse },
                    { id: "provider", label: "Provider", icon: Stethoscope },
                  ] as const).map((o) => (
                    <Button variant="ghost"
                      key={o.id}
                      type="button"
                      onClick={() => setType(o.id)}
                      aria-pressed={type === o.id}
                      className={cn(
                        "flex h-24 flex-col items-center gap-2 rounded-lg border p-4 font-bold transition-all",
                        type === o.id
                          ? o.id === "provider"
                            ? "border-lilac bg-lilac-soft text-lilac"
                            : "border-primary bg-secondary text-primary"
                          : "border-transparent bg-muted text-muted-foreground",
                      )}
                    >
                      <o.icon className="h-6 w-6" />
                      {o.label}
                    </Button>
                  ))}
                </div>
              )}

              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                {mode === "signup" && (
                  <Field label="Full name"><Input required value={f.full_name} onChange={set("full_name")} /></Field>
                )}
                {mode === "signup" && type === "patient" && (
                  <Field label="Date of birth"><Input type="date" value={f.date_of_birth} onChange={set("date_of_birth")} /></Field>
                )}
                {mode === "signup" && type === "provider" && (
                  <>
                    <Field label="Organization"><Input required placeholder="e.g. Atrium Health" value={f.organization} onChange={set("organization")} /></Field>
                    <Field label="Title / role"><Input placeholder="e.g. Psychiatrist, RN" value={f.job_title} onChange={set("job_title")} /></Field>
                  </>
                )}
                <Field label="Email"><Input type="email" required value={f.email} onChange={set("email")} /></Field>
                <Field label="Password"><Input type="password" required minLength={8} value={f.password} onChange={set("password")} /></Field>
                <Button type="submit" variant={mode === "signup" && type === "provider" ? "lilac" : "default"} className="w-full" size="lg" disabled={busy}>
                  {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
                </Button>
              </form>

              {mode === "signin" && (
                <>
                  <div className="my-5 text-center text-xs font-bold uppercase text-muted-foreground">or</div>
                  <Button variant="glass" className="w-full" onClick={google}>Continue with Google</Button>
                </>
              )}

              <p className="mt-6 text-center text-sm text-muted-foreground">
                {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
                <Button variant="ghost" className="h-auto p-0 font-bold text-lilac" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
                  {mode === "signin" ? "Create an account" : "Sign in"}
                </Button>
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="font-bold">{label}</Label>
      {isValidElement<{ id?: string }>(children) ? cloneElement(children, { id }) : children}
    </div>
  );
}
