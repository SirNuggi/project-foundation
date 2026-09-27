import { Link } from "@tanstack/react-router";
import { BarChart3, LayoutDashboard, UserRound } from "lucide-react";

const items = [
  { to: "/dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
  { to: "/stats" as const, label: "Statistiken", icon: BarChart3 },
  { to: "/profile" as const, label: "Profil", icon: UserRound },
];

export function BottomNavigation() {
  return (
    <nav
      aria-label="Hauptnavigation"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <div className="mx-auto grid h-17 max-w-lg grid-cols-3 px-3">
        {items.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact: true }}
            className="flex min-w-0 flex-col items-center justify-center gap-1 text-muted-foreground transition-colors"
            activeProps={{ className: "text-primary" }}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            <span className="text-[11px] font-bold">{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}