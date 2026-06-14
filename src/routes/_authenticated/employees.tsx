import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/employees")({ component: Employees });

function Employees() {
  const { data: rows = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data: profiles } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      const { data: roles } = await supabase.from("user_roles").select("user_id,role");
      const byUser = new Map<string, string[]>();
      (roles ?? []).forEach((r: any) => {
        const list = byUser.get(r.user_id) ?? [];
        list.push(r.role); byUser.set(r.user_id, list);
      });
      return (profiles ?? []).map((p: any) => ({ ...p, roles: byUser.get(p.id) ?? [] }));
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Employees</h1>
        <p className="text-sm text-muted-foreground">Users with access to this system</p>
      </div>
      <Card className="p-2">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase"><tr><th className="text-left px-3 py-2">Name</th><th className="text-left px-3 py-2">Email</th><th className="text-left px-3 py-2">Role</th><th className="text-left px-3 py-2">Joined</th></tr></thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2">{r.full_name}</td>
                <td className="px-3 py-2">{r.email}</td>
                <td className="px-3 py-2"><span className="text-xs px-2 py-0.5 rounded bg-accent">{r.roles.join(", ") || "—"}</span></td>
                <td className="px-3 py-2">{format(new Date(r.created_at), "PP")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-muted-foreground">New users automatically receive the Employee role. The first registered user is Admin. Manage roles directly in the database for now.</p>
    </div>
  );
}
