import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Boxes, Package, ArrowDownToLine, ArrowUpFromLine, FileBarChart2, Users, Settings, LogOut, Menu, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: any; admin?: boolean };
const nav: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/inventory", label: "Inventory", icon: Boxes },
  { to: "/products", label: "Products", icon: Package, admin: true },
  { to: "/stock-in", label: "Stock In", icon: ArrowDownToLine },
  { to: "/stock-out", label: "Stock Out", icon: ArrowUpFromLine },
  { to: "/reports", label: "Reports", icon: FileBarChart2 },
  { to: "/employees", label: "Employees", icon: Users, admin: true },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, role, isAdmin } = useAuth();
  const router = useRouter();
  const state = useRouterState();
  const [open, setOpen] = useState(false);

  const onLogout = async () => {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth" });
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col transition-transform md:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="px-5 py-5 border-b border-sidebar-border flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold">Hosiery IMS</div>
            <div className="text-xs opacity-70">Wholesale Inventory</div>
          </div>
          <button className="md:hidden" onClick={() => setOpen(false)}><X className="w-5 h-5" /></button>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.filter(n => !n.admin || isAdmin).map((n) => {
            const active = state.location.pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link key={n.to} to={n.to} onClick={() => setOpen(false)}
                className={cn("flex items-center gap-3 px-3 py-2 rounded-md text-sm transition",
                  active ? "bg-sidebar-accent text-white" : "hover:bg-sidebar-accent/60")}>
                <Icon className="w-4 h-4" /> {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <div className="px-3 py-2 text-xs opacity-70 truncate">{user?.email}</div>
          <div className="px-3 pb-2 text-[10px] uppercase tracking-wide opacity-60">{role}</div>
          <button onClick={onLogout} className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-sidebar-accent/60">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 md:ml-64 flex flex-col min-w-0">
        <header className="md:hidden flex items-center gap-2 px-4 py-3 border-b bg-card">
          <button onClick={() => setOpen(true)}><Menu className="w-5 h-5" /></button>
          <span className="font-semibold">Hosiery IMS</span>
        </header>
        <main className="flex-1 p-4 md:p-6 max-w-[1400px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
