import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/settings")({ component: Settings });

function Settings() {
  const { user, role } = useAuth();
  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-bold">Settings</h1>
      <Card className="p-5 space-y-2">
        <h2 className="font-semibold">Account</h2>
        <div className="text-sm"><span className="text-muted-foreground">Email: </span>{user?.email}</div>
        <div className="text-sm"><span className="text-muted-foreground">Role: </span>{role}</div>
      </Card>
      <Card className="p-5 space-y-2">
        <h2 className="font-semibold">Install as App</h2>
        <p className="text-sm text-muted-foreground">
          On your phone, open this site in Chrome (Android) or Safari (iOS), then tap the menu and choose
          <strong> "Add to Home Screen"</strong>. The app will install with its own icon and open full-screen.
        </p>
      </Card>
    </div>
  );
}
