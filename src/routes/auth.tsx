import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({ component: AuthPage });

function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.navigate({ to: "/dashboard" });
    });
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: name }, emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Account created. You can sign in.");
      }
      const { data } = await supabase.auth.getUser();
      if (data.user) router.navigate({ to: "/dashboard" });
    } catch (e: any) {
      toast.error(e.message);
    } finally { setBusy(false); }
  };

  const google = async () => {
    const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (res.error) toast.error(String(res.error));
  };

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-sidebar to-primary p-4">
      <Card className="w-full max-w-md p-6 space-y-5">
        <div>
          <h1 className="text-2xl font-bold">Hosiery IMS</h1>
          <p className="text-sm text-muted-foreground">{mode === "signin" ? "Sign in to continue" : "Create your account"}</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && (
            <div><Label>Full name</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
          )}
          <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div><Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required /></div>
          <Button type="submit" disabled={busy} className="w-full">{mode === "signin" ? "Sign in" : "Create account"}</Button>
        </form>
        <Button variant="outline" className="w-full" onClick={google}>Continue with Google</Button>
        <button type="button" className="text-sm text-primary underline w-full"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
          {mode === "signin" ? "No account? Sign up" : "Have an account? Sign in"}
        </button>
        <p className="text-xs text-muted-foreground text-center">First registered user becomes Admin.</p>
      </Card>
    </div>
  );
}
