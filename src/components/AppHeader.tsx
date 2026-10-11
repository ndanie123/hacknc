import { Link, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, LogIn, LogOut } from "lucide-react";
import { LogoMark } from "@/components/LogoMark";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2">
      <LogoMark compact />
    </Link>
  );
}

export function AppHeader() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <header className="companion-header relative z-20 mx-auto flex min-h-20 w-[min(1100px,calc(100%-3rem))] items-center justify-between gap-3 border-b border-border py-4">
      <Logo />
      {user ? (
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm"><Link to="/dashboard"><LayoutDashboard /> <span className="hidden sm:inline">Workspace</span></Link></Button>
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
        <nav className="flex items-center gap-2 sm:gap-5" aria-label="Main navigation">
          <Button asChild size="sm" variant="ghost"><Link to="/auth" search={{ mode: "signup", type: "patient" }}>New here?</Link></Button>
          <Button asChild size="sm" variant="ghost"><Link to="/auth">Sign in <LogIn className="h-3 w-3" /></Link></Button>
        </nav>
      )}
    </header>
  );
}
