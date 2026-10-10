import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen pb-16">
      <AppHeader />
      <main className="mx-auto w-[min(1100px,calc(100%-1.5rem))] pt-8">
        {loading || !user ? <p className="text-center text-muted-foreground">Loading…</p> : <Outlet />}
      </main>
    </div>
  );
}
