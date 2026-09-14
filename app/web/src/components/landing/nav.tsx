/**
 * nav.tsx — barra fixa da landing: dropdown "Produto" com as seções, atalho de
 * login e alternância de tema.
 *
 * Portado de `vulnera-landing/src/components/Nav.jsx`. Diferença principal: o
 * toggle de tema NÃO tem mais storage próprio — usa o `useTheme()` do app
 * (design/theme-provider), então a landing e o resto do produto compartilham a
 * mesma preferência. Os CTAs de conta viram `<Link>` do react-router.
 */

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, User, Sun, Moon } from "lucide-react";
import { useTheme } from "../../design/theme-provider";

const PRODUCT_LINKS = [
  { label: "Como funciona", href: "#como-funciona" },
  { label: "Recursos", href: "#recursos" },
  { label: "Demo", href: "#demo" },
  { label: "Maturidade", href: "#maturidade" },
];

const LINKS = [
  { label: "Planos", href: "#planos" },
  { label: "Equipe", href: "#equipe" },
];

export default function Nav() {
  const [open, setOpen] = useState(false);
  const { resolvido, definirTema } = useTheme();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;

    const onClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    window.addEventListener("mousedown", onClickOutside);
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  const isDark = resolvido === "dark";

  return (
    <header className="fixed left-0 right-0 top-0 z-[30] border-b border-[rgba(var(--vx-accent-rgb),0.15)] bg-[rgba(var(--vx-bg-2-rgb),0.75)] backdrop-blur-sm">
      <div className="mx-auto flex h-[76px] max-w-6xl items-center justify-between px-6">
        <a href="#" className="group flex flex-col leading-none">
          <span className="flex items-baseline gap-[3px] font-mono text-base font-bold tracking-widest text-[var(--vx-text)] transition-colors group-hover:text-[var(--vx-accent)]">
            VULNERA
            <span className="vx-blink h-[13px] w-[4px] bg-[var(--vx-accent)]" aria-hidden="true" />
          </span>
          <span className="mt-1 font-mono text-[10px] tracking-[0.4em] text-[var(--vx-text-2)]">SECURITY</span>
        </a>

        <nav aria-label="Navegação principal" className="hidden items-center gap-9 sm:flex">
          <div ref={dropdownRef} className="relative">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="flex items-center gap-[6px] font-mono text-sm tracking-wide text-[var(--vx-text-2)] transition-colors hover:text-[var(--vx-accent)]"
            >
              Produto
              <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.15 }}>
                <ChevronDown size={15} aria-hidden="true" />
              </motion.span>
            </button>

            <AnimatePresence>
              {open && (
                <motion.ul
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-1/2 top-full mt-3 w-[224px] -translate-x-1/2 rounded-[6px] border border-[rgba(var(--vx-accent-rgb),0.2)] bg-[var(--vx-bg-2)] p-2 shadow-[var(--vx-elevated-shadow)]"
                >
                  {PRODUCT_LINKS.map((link) => (
                    <li key={link.href}>
                      <a
                        href={link.href}
                        onClick={() => setOpen(false)}
                        className="block rounded-[6px] px-3 py-2 font-mono text-sm text-[var(--vx-text-2)] transition-colors hover:bg-[rgba(var(--vx-accent-rgb),0.1)] hover:text-[var(--vx-accent)]"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>

          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="font-mono text-sm tracking-wide text-[var(--vx-text-2)] transition-colors hover:text-[var(--vx-accent)]"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            to="/login"
            aria-label="Entrar"
            className="flex h-10 w-10 items-center justify-center rounded-[6px] border border-[rgba(var(--vx-accent-rgb),0.2)] text-[var(--vx-text-2)] transition-colors hover:border-[var(--vx-accent)] hover:text-[var(--vx-accent)]"
          >
            <User size={17} aria-hidden="true" />
          </Link>
          <button
            type="button"
            onClick={() => definirTema(isDark ? "light" : "dark")}
            aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
            className="flex h-10 w-10 items-center justify-center rounded-[6px] border border-[rgba(var(--vx-accent-rgb),0.2)] text-[var(--vx-text-2)] transition-colors hover:border-[var(--vx-accent)] hover:text-[var(--vx-accent)]"
          >
            {isDark ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
          </button>
          <Link
            to="/register"
            className="hidden rounded-[6px] border border-[var(--vx-accent)] px-5 py-[10px] font-mono text-sm font-bold tracking-wide text-[var(--vx-accent)] transition-all duration-[300ms] hover:bg-[var(--vx-accent)] hover:text-[var(--vx-on-accent)] md:inline-block"
          >
            Começar →
          </Link>
        </div>
      </div>
    </header>
  );
}
