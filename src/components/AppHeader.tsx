import { Link, useNavigate } from "@tanstack/react-router";
import { Droplet, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2">
      <span className="gloss-aqua grid h-9 w-9 place-items-center rounded-full">
        <Droplet className="h-5 w-5 text-primary-foreground" />
      </span>
      <span className="font-display text-xl font-bold text-foreground text-shadow-soft">AeroHealth</span>
    </Link>
  );
}

export function AppHeader() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <header className="glass sticky top-3 z-20 mx-auto mt-3 flex w-[min(1100px,calc(100%-1.5rem))] items-center justify-between rounded-full px-4 py-2">
      <Logo />
      {user ? (
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {profile?.full_name || user.email}
            {profile && (
              <span
                className={
                  profile.account_type === "provider"
                    ? "ml-2 rounded-full gloss-lilac px-2 py-0.5 text-xs font-bold capitalize text-lilac-foreground"
                    : "ml-2 rounded-full bg-secondary px-2 py-0.5 text-xs font-bold capitalize text-secondary-foreground"
                }
              >
                {profile.account_type}
              </span>
            )}
          </span>
          <Button
            variant="glass"
            size="sm"
            onClick={async () => {
              await signOut();
              navigate({ to: "/" });
            }}
          >
            <LogOut /> Sign out
          </Button>
        </div>
      ) : (
        <Button asChild size="sm">
          <Link to="/auth">Sign in</Link>
        </Button>
      )}
    </header>
  );
}
