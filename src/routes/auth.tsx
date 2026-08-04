import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Brand } from "@/components/shared/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ensureDevelopmentSession, isDevelopmentAccessEnabled } from "@/lib/development-access";
import { testPinLogin } from "@/lib/test-auth.functions";

const SHOW_TEST_PIN_LOGIN = (import.meta.env.VITE_TEST_PIN_LOGIN_ENABLED ?? "").toString().toLowerCase() === "true";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in · EventScape" },
      { name: "description", content: "Sign in or create your EventScape organizer account." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [pin, setPin] = useState("");
  const [pinLoading, setPinLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const pinLogin = useServerFn(testPinLogin);

  // If already signed in, skip the auth page.
  useEffect(() => {
    let cancelled = false;

    if (isDevelopmentAccessEnabled()) {
      if (!cancelled) navigate({ to: "/app", replace: true });
      return;
    }

    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled && data.user) navigate({ to: "/app", replace: true });
    });
    return () => { cancelled = true; };
  }, [navigate]);

  if (isDevelopmentAccessEnabled()) {
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName, org_name: orgName },
          },
        });
        if (error) throw error;
        toast.success("Welcome to EventScape!");
        navigate({ to: "/app" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Signed in");
        navigate({ to: "/app" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handlePinLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!pin.trim()) {
      toast.error("Enter your test PIN");
      return;
    }

    setPinLoading(true);
    try {
      const session = await pinLogin({ data: { pin: pin.trim() } });
      const { error } = await supabase.auth.setSession({
        access_token: session.accessToken,
        refresh_token: session.refreshToken,
      });
      if (error) throw error;
      toast.success("Signed in");
      navigate({ to: "/app" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "PIN login failed");
    } finally {
      setPinLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-primary-soft lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,oklch(0.94_0.06_20/0.9),transparent_60%),radial-gradient(circle_at_70%_80%,oklch(0.88_0.08_30/0.7),transparent_60%)]" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Brand size="md" />
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.32em] text-primary-deep">Plan · Organize · Create · Celebrate</p>
            <h2 className="mt-4 max-w-md font-display text-5xl font-semibold leading-tight text-foreground">
              An elegant home for every event you run.
            </h2>
            <p className="mt-4 max-w-md text-sm text-muted-foreground">
              Applications, booth maps, vendor communication, and payments — organized into one welcoming workspace built for craft shows, markets, and festivals.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">© EventScape</p>
        </div>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden"><Brand size="sm" /></div>
          <h1 className="mt-8 font-display text-3xl font-semibold">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to your studio or create a new one.</p>

          <Tabs value={mode} onValueChange={(v) => setMode(v as "signin" | "signup")} className="mt-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>Sign in</Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Your name</Label>
                  <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="orgName">Studio / Organization name</Label>
                  <Input id="orgName" placeholder="e.g. Rose Market Co." value={orgName} onChange={(e) => setOrgName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email2">Email</Label>
                  <Input id="email2" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password2">Password</Label>
                  <Input id="password2" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <p className="rounded-lg bg-secondary/50 p-3 text-xs text-muted-foreground">
                  Vendor accounts are invitation-only. If an organizer invited you, use the link or code in your invitation email instead.
                </p>
                <Button type="submit" className="w-full" disabled={loading}>Create organizer account</Button>
              </form>
            </TabsContent>
          </Tabs>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground">← Back to home</Link>
          </p>

          {SHOW_TEST_PIN_LOGIN && (
            <div className="mt-6 rounded-lg border border-border bg-secondary/40 p-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Testing Access</p>
              <form onSubmit={handlePinLogin} className="mt-3 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="test-pin">Login PIN</Label>
                  <Input
                    id="test-pin"
                    type="password"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="Enter test PIN"
                  />
                </div>
                <Button type="submit" variant="outline" className="w-full" disabled={pinLoading}>
                  {pinLoading ? "Signing in…" : "Sign in with PIN"}
                </Button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
