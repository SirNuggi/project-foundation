import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Anmelden — Birdie Battle" },
      {
        name: "description",
        content: "Melde dich an oder registriere dich, um Golfrunden mit deinen Freunden zu tracken.",
      },
      { property: "og:title", content: "Anmelden — Birdie Battle" },
      { property: "og:description", content: "Anmelden und Golfrunden tracken." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const schema = z.object({
  email: z.string().trim().email("Bitte gültige E-Mail eingeben").max(255),
  password: z.string().min(6, "Mindestens 6 Zeichen").max(72),
  displayName: z.string().trim().min(2, "Mindestens 2 Zeichen").max(40).optional(),
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({
      email,
      password,
      displayName: mode === "signup" ? displayName : undefined,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Eingabe prüfen");
      return;
    }
    if (mode === "signup" && !displayName.trim()) {
      toast.error("Bitte einen Anzeigenamen eingeben");
      return;
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: displayName.trim() },
          },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success("Fast fertig! Bitte bestätige die E-Mail, die wir dir geschickt haben.");
          setMode("login");
          return;
        }
        navigate({ to: "/dashboard", replace: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) throw error;
        navigate({ to: "/dashboard", replace: true });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Es hat nicht geklappt";
      toast.error(
        message.includes("Invalid login credentials")
          ? "E-Mail oder Passwort stimmt nicht"
          : message.includes("already registered")
            ? "Diese E-Mail ist bereits registriert"
            : message.toLowerCase().includes("weak")
              ? "Dieses Passwort ist zu unsicher. Bitte ein längeres, eigenes Passwort wählen."
              : message.includes("Email not confirmed")
                ? "Bitte bestätige zuerst die E-Mail, die wir dir geschickt haben."
                : message,
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col justify-center bg-background px-6 py-10">
      <Link
        to="/"
        aria-label="Zurück"
        className="flex h-10 w-10 items-center justify-center text-primary"
      >
        <ChevronLeft className="h-5 w-5" />
      </Link>
      <h1 className="mt-8 text-3xl font-black tracking-tight">
        {mode === "login" ? "Anmeldung" : "Konto erstellen"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {mode === "login"
          ? "\n"
          : "Dein Name ist für Freunde in der Spielersuche sichtbar."}
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        {mode === "signup" && (
          <div className="space-y-2">
            <Label htmlFor="displayName">Anzeigename</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Gerhard W."
              maxLength={40}
              className="h-13"
            />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="email">E-Mail</Label>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="du@beispiel.at"
            className="h-13"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Passwort</Label>
          <Input
            id="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••"
            className="h-13"
          />
        </div>

        <Button type="submit" disabled={loading} size="lg" className="h-14 w-full text-base font-bold">
          {loading ? "Einen Moment…" : mode === "login" ? "Anmelden" : "Registrieren"}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => setMode(mode === "login" ? "signup" : "login")}
        className="mt-6 text-sm font-semibold text-muted-foreground underline underline-offset-4"
      >
        {mode === "login" ? "Noch kein Konto? Jetzt registrieren" : "Schon registriert? Anmelden"}
      </button>
    </main>
  );
}
