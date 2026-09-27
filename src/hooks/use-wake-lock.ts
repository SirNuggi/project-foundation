import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Hält den Bildschirm wach.
 * 1. Bevorzugt die native Wake-Lock-API.
 * 2. Fällt auf ein winziges, stummes Endlos-Video zurück, wenn die API fehlt oder blockiert ist.
 * 3. Versucht es bei der ersten Nutzer-Berührung erneut (viele Browser verlangen eine Interaktion).
 */

type WakeLockSentinelLike = {
  released?: boolean;
  release: () => Promise<void>;
  addEventListener: (type: string, listener: () => void) => void;
};

type WakeNavigator = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
};

const TINY_VIDEO_MP4 =
  "data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAONbW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAABXgAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAArh0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAABXgAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAEAAAABAAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAAV4AAAQAAABAAAAAAIwbWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAAAoAAAAOABVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAAB221pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAZtzdGJsAAAAv3N0c2QAAAAAAAAAAQAAAK9hdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAEAAQABIAAAASAAAAAAAAAABFUxhdmM2Mi4xMS4xMDAgbGlieDI2NAAAAAAAAAAAAAAAGP//AAAANWF2Y0MBZAAK/+EAGGdkAAqs2UQmwEQAAAMABAAAAwAoPEiWWAEABmjr48siwP34+AAAAAAQcGFzcAAAAAEAAAABAAAAFGJ0cnQAAAAAAAARvgAAAAAAAAAYc3R0cwAAAAAAAAABAAAABwAACAAAAAAUc3RzcwAAAAAAAAABAAAAAQAAAEhjdHRzAAAAAAAAAAcAAAABAAAQAAAAAAEAACgAAAAAAQAAEAAAAAABAAAAAAAAAAEAAAgAAAAAAQAAGAAAAAABAAAIAAAAABxzdHNjAAAAAAAAAAEAAAABAAAABwAAAAEAAAAwc3RzegAAAAAAAAAAAAAABwAAAskAAAAOAAAADAAAAAwAAAAMAAAAFAAAAAwAAAAUc3RjbwAAAAAAAAABAAADvQAAAGF1ZHRhAAAAWW1ldGEAAAAAAAAAIWhkbHIAAAAAAAAAAG1kaXJhcHBsAAAAAAAAAAAAAAAALGlsc3QAAAAkqXRvbwAAABxkYXRhAAAAAQAAAABMYXZmNjIuMy4xMDAAAAAIZnJlZQAAAyNtZGF0AAACnwYF//+b3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE2NCAtIEguMjY0L01QRUctNCBBVkMgY29kZWMgLSBDb3B5bGVmdCAyMDAzLTIwMjUgLSBodHRwOi8vd3d3LnZpZGVvbGFuLm9yZy94MjY0Lmh0bWwgLSBvcHRpb25zOiBjYWJhYz0xIHJlZj0zIGRlYmxvY2s9MTowOjAgYW5hbHlzZT0weDM6MHgxMTMgbWU9aGV4IHN1Ym1lPTcgcHN5PTEgcHN5X3JkPTEuMDA6MC4wMCBtaXhlZF9yZWY9MSBtZV9yYW5nZT0xNiBjaHJvbWFfbWU9MSB0cmVsbGlzPTEgOHg4ZGN0PTEgY3FtPTAgZGVhZHpvbmU9MjEsMTEgZmFzdF9wc2tpcD0xIGNocm9tYV9xcF9vZmZzZXQ9LTIgdGhyZWFkcz0yIGxvb2thaGVhZF90aHJlYWRzPTEgc2xpY2VkX3RocmVhZHM9MCBucj0wIGRlY2ltYXRlPTEgaW50ZXJsYWNlZD0wIGJsdXJheV9jb21wYXQ9MCBjb25zdHJhaW5lZF9pbnRyYT0wIGJmcmFtZXM9MyBiX3B5cmFtaWQ9MiBiX2FkYXB0PTEgYl9iaWFzPTAgZGlyZWN0PTEgd2VpZ2h0Yj0xIG9wZW5fZ29wPTAgd2VpZ2h0cD0yIGtleWludD0yNTAga2V5aW50X21pbj01IHNjZW5lY3V0PTQwIGludHJhX3JlZnJlc2g9MCByY19sb29rYWhlYWQ9NDAgcmM9Y3JmIG1idHJlZT0xIGNyZj0yMy4wIHFjb21wPTAuNjAgcXBtaW49MCBxcG1heD02OSBxcHN0ZXA9NCBpcF9yYXRpbz0xLjQwIGFxPTE6MS4wMACAAAAAImWIhAAT//73sY+BTctIRZc6inofw12BbqTaFEmIH5O+kYEAAAAKQZokbEEf/rUr7wAAAAhBnkJ4gh8CxwAAAAgBnmF0Q/8ExAAAAAgBnmNqQ/8ExQAAABBBmmZJqEFomUwU8P/+qZ01AAAACAGehWpD/wTF";

const TINY_VIDEO_WEBM = "data:video/webm;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQJChYECGFOAZwEAAAAAAAJ+EU2bdLpNu4tTq4QVSalmU6yBoU27i1OrhBZUrmtTrIHWTbuMU6uEElTDZ1OsggEjTbuMU6uEHFO7a1OsggJo7AEAAAAAAABZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVSalmsCrXsYMPQkBNgIxMYXZmNjIuMy4xMDBXQYxMYXZmNjIuMy4xMDBEiYhAleAAAAAAABZUrmvIrgEAAAAAAAA/14EBc8WIFa2OYNNdGJycgQAitZyDdW5kiIEAhoVWX1ZQOIOBASPjg4QL68IA4JCwgUC6gUCagQJVsIRVuYEBElTDZ/tzc59jwIBnyJlFo4dFTkNPREVSRIeMTGF2ZjYyLjMuMTAwc3PWY8CLY8WIFa2OYNNdGJxnyKFFo4dFTkNPREVSRIeUTGF2YzYyLjExLjEwMCBsaWJ2cHhnyKFFo4hEVVJBVElPTkSHkzAwOjAwOjAxLjQwMDAwMDAwMAAfQ7Z1QL/ngQCjqoEAAIDwAgCdASpAAEAAAEcIhYWIhYSIAgIABnA8QmAKsiD3MAD+/6tQgKOWgQDIANEBAAEQEAAYABhYL/QACI6AAKOWgQGQANEBAAEQEAAYABhYL/QACI6AAKOWgQJYANEBAAEQEAAYABhYL/QACI6AAKOWgQMgANEBAAEQEAAYABhYL/QACI6AAKOWgQPoANEBAAEQEAAYABhYL/QACI6AAKOWgQSwANEBAAEQEAAYABhYL/QACI6AABxTu2uRu4+zgQC3iveBAfGCAaPwgQM=";

export type WakeLockState = {
  /** Wachhalten ist vom Nutzer eingeschaltet */
  enabled: boolean;
  /** Bildschirm wird gerade tatsächlich wachgehalten */
  active: boolean;
  /** Anfrage wurde vom Gerät abgelehnt (z. B. Energiesparmodus) */
  blocked: boolean;
  /** true, wenn nur der Video-Ersatz greift */
  fallback: boolean;
  toggle: () => void;
};

export function useWakeLock(shouldRun: boolean): WakeLockState {
  const [enabled, setEnabled] = useState(true);
  const [active, setActive] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [fallback, setFallback] = useState(false);

  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const wantRef = useRef(false);

  const stopFallback = useCallback(() => {
    const v = videoRef.current;
    if (v) {
      try {
        v.pause();
        v.remove();
      } catch {
        // egal
      }
    }
    videoRef.current = null;
    setFallback(false);
  }, []);

  const startFallback = useCallback(async () => {
    if (videoRef.current) return true;
    const v = document.createElement("video");
    videoRef.current = v;
    try {
      v.setAttribute("playsinline", "");
      v.setAttribute("muted", "");
      v.muted = true;
      v.loop = true;
      for (const [type, src] of [
        ["video/webm", TINY_VIDEO_WEBM],
        ["video/mp4", TINY_VIDEO_MP4],
      ] as const) {
        const s = document.createElement("source");
        s.type = type;
        s.src = src;
        v.appendChild(s);
      }
      v.style.cssText =
        "position:fixed;width:1px;height:1px;opacity:0.01;pointer-events:none;bottom:0;left:0;";
      document.body.appendChild(v);
      await v.play();
      setFallback(true);
      return true;
    } catch {
      stopFallback();
      return false;
    }
  }, [stopFallback]);

  const release = useCallback(() => {
    const s = sentinelRef.current;
    sentinelRef.current = null;
    if (s) void s.release().catch(() => undefined);
    stopFallback();
    setActive(false);
  }, [stopFallback]);

  const acquire = useCallback(async () => {
    if (!wantRef.current) return;
    if (sentinelRef.current || document.visibilityState !== "visible") return;
    const nav = navigator as WakeNavigator;
    if (nav.wakeLock) {
      try {
        const s = await nav.wakeLock.request("screen");
        if (!wantRef.current) {
          void s.release().catch(() => undefined);
          return;
        }
        s.addEventListener("release", () => {
          sentinelRef.current = null;
          setActive(false);
        });
        sentinelRef.current = s;
        setActive(true);
        setBlocked(false);
        stopFallback();
        return;
      } catch {
        // weiter zum Ersatz
      }
    }
    if (!wantRef.current) return;
    const ok = await startFallback();
    if (!wantRef.current) {
      stopFallback();
      return;
    }
    setActive(ok);
    setBlocked(!ok);
  }, [startFallback, stopFallback]);

  useEffect(() => {
    if (!shouldRun || !enabled) {
      wantRef.current = false;
      release();
      return;
    }

    wantRef.current = true;
    void acquire();

    const onVisibility = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    const onInteract = () => {
      if (!sentinelRef.current && !videoRef.current) void acquire();
    };

    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("pointerdown", onInteract);
    document.addEventListener("touchstart", onInteract, { passive: true });

    return () => {
      wantRef.current = false;
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("pointerdown", onInteract);
      document.removeEventListener("touchstart", onInteract);
      release();
    };
  }, [shouldRun, enabled, acquire, release]);

  const toggle = useCallback(() => setEnabled((e) => !e), []);

  return { enabled, active, blocked, fallback, toggle };
}
