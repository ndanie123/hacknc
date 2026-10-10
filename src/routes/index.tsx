import { createFileRoute, Link } from "@tanstack/react-router";
import { Bot, FileText, Share2, Stethoscope } from "lucide-react";
import heroBg from "@/assets/aero-bg.jpg";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AeroHealth — Health logs your doctor can actually use" },
      { name: "description", content: "Describe how you've been feeling, get a structured health log, and share a clean PDF with your provider." },
      { property: "og:title", content: "AeroHealth — Health logs your doctor can actually use" },
      { property: "og:description", content: "Structured psychiatric, symptom, medication and general health logs as provider-ready PDFs." },
    ],
  }),
  component: Index,
});

const features = [
  { icon: Bot, title: "AI-assisted logging", text: "Tell the assistant what's going on; it shapes your notes into a log." },
  { icon: FileText, title: "Provider-ready PDFs", text: "Psychiatric, symptom, medication or general formats." },
  { icon: Share2, title: "Share securely", text: "Send specific logs to your care team — you stay in control." },
  { icon: Stethoscope, title: "For providers too", text: "Clinicians view shared logs, ready for integration with their systems." },
];

const bubbles = [
  { className: "right-6 top-24 h-24 w-24", delay: "0s" },
  { className: "left-[46%] top-56 h-12 w-12", delay: "1.4s" },
  { className: "right-[16%] bottom-8 h-32 w-32", delay: "2.6s" },
];

function Index() {
  const { user } = useAuth();
  return (
    <div className="relative min-h-screen overflow-hidden">
      <img src={heroBg} alt="" width={1920} height={1088} className="absolute inset-0 -z-10 h-full w-full object-cover" />
      <div className="hero-lilac-tint absolute inset-0 -z-10" aria-hidden="true" />
      {bubbles.map((b, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={cn("bubble-lilac animate-float absolute -z-10 rounded-full", b.className)}
          style={{ animationDelay: b.delay }}
        />
      ))}
      <AppHeader />
      <main className="mx-auto w-[min(1100px,calc(100%-1.5rem))] pb-20 pt-16">
        <section className="glass max-w-2xl rounded-[2rem] p-8 sm:p-12">
          <p className="mb-3 inline-block rounded-full bg-lilac-soft px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-lilac">
            Your health, clearly told
          </p>
          <h1 className="text-4xl font-bold leading-tight sm:text-6xl">
            Walk into every appointment <span className="text-lilac">prepared.</span>
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">
            Turn how you've been feeling into a structured health log, then hand your provider a clean PDF.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to={user ? "/dashboard" : "/auth"}>{user ? "Go to dashboard" : "Create free account"}</Link>
            </Button>
            {!user && (
              <Button asChild size="lg" variant="lilac">
                <Link to="/auth" search={{ mode: "signup", type: "provider" }}>I'm a provider</Link>
              </Button>
            )}
          </div>
        </section>

        <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <div key={f.title} className="glass animate-float rounded-3xl p-6" style={{ animationDelay: `${i * 0.6}s` }}>
              <span className={cn("mb-4 grid h-11 w-11 place-items-center rounded-full", i % 2 ? "gloss-lilac" : "gloss-aqua")}>
                <f.icon className="h-5 w-5 text-primary-foreground" />
              </span>
              <h3 className="text-lg font-bold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
