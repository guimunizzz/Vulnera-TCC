/**
 * Renderiza o desafio público do Cloudflare Turnstile em modo explícito.
 * Mantém o token efêmero e falha fechado quando chave, script ou desafio falham.
 * Consumido pelas páginas que enviam solicitações anônimas de acesso.
 */

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

const TURNSTILE_SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const SCRIPT_TIMEOUT_MS = 12_000;
const CLOUDFLARE_TEST_SITE_KEY = "1x00000000000000000000AA";

interface TurnstileRenderOptions {
  sitekey: string;
  action: string;
  size?: "normal" | "compact";
  callback: (token: string) => void;
  "expired-callback": () => void;
  "error-callback": () => void;
}

interface TurnstileApi {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export interface TurnstileChallengeHandle {
  /** Descarta o token usado e abre um desafio novo no widget atual. */
  reset: () => void;
}

export interface TurnstileChallengeProps {
  onTokenChange: (token: string | null) => void;
  className?: string;
}

type ChallengeState = "loading" | "ready" | "unavailable" | "retry";
let scriptPromise: Promise<void> | undefined;

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  const promise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${TURNSTILE_SCRIPT}"]`);
    const script = existing ?? document.createElement("script");
    const createdHere = !existing;
    const cleanup = () => {
      window.clearTimeout(timeoutId);
      script.removeEventListener("load", loaded);
      script.removeEventListener("error", failed);
    };
    const failed = () => {
      cleanup();
      if (createdHere) script.remove();
      reject(new Error("TURNSTILE_UNAVAILABLE"));
    };
    const loaded = () => {
      cleanup();
      if (window.turnstile) resolve();
      else failed();
    };

    script.addEventListener("load", loaded, { once: true });
    script.addEventListener("error", failed, { once: true });
    const timeoutId = window.setTimeout(failed, SCRIPT_TIMEOUT_MS);
    if (createdHere) {
      script.src = TURNSTILE_SCRIPT;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });

  scriptPromise = promise;
  void promise.catch(() => {
    // Uma falha transitória não pode envenenar os próximos widgets da sessão.
    if (scriptPromise === promise) scriptPromise = undefined;
  });
  return promise;
}

export const TurnstileChallenge = forwardRef<TurnstileChallengeHandle, TurnstileChallengeProps>(
  function TurnstileChallenge({ onTokenChange, className }, ref) {
    const hostRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const onTokenRef = useRef(onTokenChange);
    const [state, setState] = useState<ChallengeState>("loading");
    const [retryKey, setRetryKey] = useState(0);
    const [compact, setCompact] = useState(false);

    onTokenRef.current = onTokenChange;

    const reset = useCallback(() => {
      onTokenRef.current(null);
      const id = widgetIdRef.current;
      if (!id || !window.turnstile) return;
      try {
        window.turnstile.reset(id);
      } catch {
        setState("unavailable");
      }
    }, []);

    useImperativeHandle(ref, () => ({ reset }), [reset]);

    const siteKey = (import.meta.env.VITE_TURNSTILE_SITE_KEY || "").trim();
    const action = (import.meta.env.VITE_TURNSTILE_ACTION || "access-request").trim() || "access-request";

    useEffect(() => {
      const host = hostRef.current;
      const container = host?.parentElement;
      if (!container) return;

      const measure = (width = container.getBoundingClientRect().width) => {
        if (width > 0) setCompact(width < 300);
      };
      measure();
      const observer = typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver((entries) => measure(entries[0]?.contentRect.width));
      observer?.observe(container);
      const resize = () => measure();
      window.addEventListener("resize", resize);
      return () => {
        observer?.disconnect();
        window.removeEventListener("resize", resize);
      };
    }, []);

    useEffect(() => {
      let cancelled = false;
      widgetIdRef.current = null;
      onTokenRef.current(null);

      const testKeyInProduction = siteKey === CLOUDFLARE_TEST_SITE_KEY
        && !import.meta.env.DEV
        && import.meta.env.MODE !== "test";
      if (!siteKey || testKeyInProduction) {
        setState("unavailable");
        return () => {
          cancelled = true;
        };
      }

      setState("loading");
      void loadTurnstileScript()
        .then(() => {
          if (cancelled) return;
          const turnstile = window.turnstile;
          const host = hostRef.current;
          if (!turnstile || !host) throw new Error("TURNSTILE_UNAVAILABLE");

          const id = turnstile.render(host, {
            sitekey: siteKey,
            action,
            size: compact ? "compact" : "normal",
            callback: (token) => {
              if (cancelled) return;
              onTokenRef.current(token || null);
              setState("ready");
            },
            "expired-callback": () => {
              if (cancelled) return;
              onTokenRef.current(null);
              setState("ready");
              try { turnstile.reset(id); } catch { setState("unavailable"); }
            },
            "error-callback": () => {
              if (cancelled) return;
              onTokenRef.current(null);
              setState("retry");
            },
          });
          widgetIdRef.current = id;
          setState("ready");
        })
        .catch(() => {
          if (!cancelled) {
            onTokenRef.current(null);
            setState("unavailable");
          }
        });

      return () => {
        cancelled = true;
        const id = widgetIdRef.current;
        widgetIdRef.current = null;
        if (id && window.turnstile) {
          try { window.turnstile.remove(id); } catch { /* O token já foi descartado. */ }
        }
        onTokenRef.current(null);
      };
    }, [action, compact, retryKey, siteKey]);

    return (
      <div className={className} role="group" aria-label="Verificação de segurança">
        <div ref={hostRef} data-testid="turnstile-host" className="min-w-0 max-w-full" />
        {state === "loading" && <p role="status">Carregando verificação de segurança…</p>}
        {state === "unavailable" && (
          <p role="alert">Verificação de segurança indisponível. Tente novamente mais tarde.</p>
        )}
        {state === "retry" && (
          <div role="alert">
            <p>Não foi possível concluir a verificação. Tente novamente.</p>
            <button
              type="button"
              onClick={() => setRetryKey((value) => value + 1)}
              className="min-h-touch underline underline-offset-4"
            >
              Recarregar verificação
            </button>
          </div>
        )}
      </div>
    );
  },
);
