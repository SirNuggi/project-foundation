import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Flag, PackageOpen, Timer, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import logoAsset from "@/assets/golf-buddies-logo.png.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Birdie Battle — Golfrunden live mit Freunden tracken" },
      {
        name: "description",
        content:
          "Starte eine Runde, füge Mitspieler hinzu und sammle Strafpunkte für Dreiputt, Doppel-Par und Girly.",
      },
      { property: "og:title", content: "Birdie Battle — Golfrunden live mit Freunden tracken" },
      {
        property: "og:description",
        content: "Runden starten, Mitspieler hinzufügen, Strafpunkte sammeln.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
      else setChecked(true);
    });
  }, [navigate]);

  if (!checked) return <div className="min-h-screen bg-background" />;

  return (
    <main className="flex min-h-screen flex-col bg-secondary px-6 py-10 text-secondary-foreground">
      <div className="flex flex-col items-center pb-8">
        <img
          src={logoAsset.url}
          alt="Golf Buddies — Golfrunden mit Freunden"
          className="aspect-square w-[50vw] min-w-40 max-w-[200px] rounded-full object-cover shadow-lg"
        />
        <h1 className="mt-4 text-center text-4xl font-black leading-none tracking-tight">
          Golf Buddies
        </h1>
      </div>
      <div className="flex flex-1 flex-col justify-center">
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-primary px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary-foreground">
          <Flag className="h-3.5 w-3.5" /> TIME TO BATTLE
        </span>
        <p className="mt-5 max-w-sm text-base text-secondary-foreground/70">
          Runden live mit deinen Freunden tracken. Schläge, Putts und Strafpunkte – direkt auf dem
          Platz und auf dem Handy.
        </p>

        <ul className="mt-8 space-y-3 text-sm">
          <li className="flex items-center gap-3">
            <Timer className="h-5 w-5 text-primary" /> Runde in Sekunden anlegen
          </li>
          <li className="flex items-center gap-3">
            <UserRound className="h-5 w-5 text-primary" /> Mitspieler und Gäste hinzufügen
          </li>
          <li className="flex items-center gap-3">
            <PackageOpen className="h-5 w-5 text-primary" /> Strafkasse für Golfgruppen
          </li>
        </ul>
      </div>

      <div className="space-y-3">
        <Button asChild size="lg" className="h-14 w-full text-base font-bold">
          <Link to="/auth">Los geht's</Link>
        </Button>
        <p className="text-center text-xs text-secondary-foreground/50">
          Registrieren dauert keine Minute.
        </p>
      </div>
    </main>
  );
}
