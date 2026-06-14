import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Local dev override: set VITE_DISABLE_AUTH=true in your .env to skip auth checks
    // This allows running the app locally without an OAuth/Supabase setup.
    if (import.meta.env.VITE_DISABLE_AUTH === 'true') {
      return { user: { id: 'dev-local', email: 'dev@local' } } as any;
    }
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
