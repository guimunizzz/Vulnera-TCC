/**
 * accessibility.ts
 *
 * O QUE FAZ
 * As preferências do menu de acessibilidade: o que está guardado, como validar,
 * como aplicar ao `<html>` e como observar mudanças, dentro e fora do React.
 *
 * POR QUE O MESMO DESENHO DE theme.ts
 * Tamanho do texto e contraste precisam valer ANTES do primeiro paint — senão a
 * página nasce em 100% e pula para 150% diante de quem pediu letra grande. O
 * `index.html` roda uma cópia mínima de `aplicarPreferencias` num script
 * inline; este módulo é a fonte da verdade do contrato.
 *
 * ⚠️ Ao mexer em `CHAVE_STORAGE_A11Y`, em `ATRIBUTO_A11Y`, em `ESCALAS_FONTE`
 * ou na variável `--a11y-escala-fonte`, mexa TAMBÉM no script do `index.html`.
 * O teste A11Y-PREF-01 (`sistema.test.tsx`) confere que os dois concordam.
 *
 * COMO O CSS LÊ
 *   - escala do texto → `--a11y-escala-fonte` no `<html>`; `base.css` faz
 *     `font-size: calc(100% * var(--a11y-escala-fonte, 1))`. Como toda a escala
 *     tipográfica e de espaçamento é em rem, a interface cresce por inteiro.
 *   - cada opção liga/desliga um atributo vazio no `<html>` (ex.:
 *     `data-alto-contraste`); `tokens.css` e `base.css` reagem a ele.
 *
 * QUEM USA
 * `accessibility-menu.tsx` (o painel), `motion/use-motion.ts` e todo código que
 * precisa saber se o movimento está reduzido fora do React (GSAP, rAF).
 */

import { useSyncExternalStore } from "react";

export interface PreferenciasAcessibilidade {
  /** Multiplicador do tamanho do texto: 1 = 100%. */
  escalaFonte: number;
  altoContraste: boolean;
  reduzirMovimento: boolean;
  sublinharLinks: boolean;
  espacamentoTexto: boolean;
  focoReforcado: boolean;
}

export type OpcaoAcessibilidade = Exclude<keyof PreferenciasAcessibilidade, "escalaFonte">;

/** O teto é 200% porque é o que o WCAG 1.4.4 (Redimensionar texto) exige. */
export const ESCALAS_FONTE = [1, 1.1, 1.25, 1.5, 1.75, 2] as const;

/** Precisa bater com o `index.html`. Ver aviso no topo. */
export const CHAVE_STORAGE_A11Y = "vulnera:a11y";

/** Atributo estampado no `<html>` quando a opção está ligada. */
export const ATRIBUTO_A11Y: Record<OpcaoAcessibilidade, string> = {
  altoContraste: "data-alto-contraste",
  reduzirMovimento: "data-reduzir-movimento",
  sublinharLinks: "data-sublinhar-links",
  espacamentoTexto: "data-espacamento-texto",
  focoReforcado: "data-foco-reforcado",
};

const OPCOES = Object.keys(ATRIBUTO_A11Y) as OpcaoAcessibilidade[];

export const PREFERENCIAS_PADRAO: PreferenciasAcessibilidade = {
  escalaFonte: 1,
  altoContraste: false,
  reduzirMovimento: false,
  sublinharLinks: false,
  espacamentoTexto: false,
  focoReforcado: false,
};

const MEDIA_MOVIMENTO = "(prefers-reduced-motion: reduce)";

/** Lê o que está guardado. Campo inválido cai no padrão, campo a campo. */
export function lerPreferencias(): PreferenciasAcessibilidade {
  try {
    const bruto = JSON.parse(window.localStorage.getItem(CHAVE_STORAGE_A11Y) ?? "{}") as Record<string, unknown>;
    const lidas = { ...PREFERENCIAS_PADRAO };
    if ((ESCALAS_FONTE as readonly unknown[]).includes(bruto.escalaFonte)) lidas.escalaFonte = bruto.escalaFonte as number;
    for (const opcao of OPCOES) lidas[opcao] = bruto[opcao] === true;
    return lidas;
  } catch {
    // Storage bloqueado ou JSON corrompido: preferência não é motivo para
    // quebrar a aplicação (mesma postura de theme.ts).
    return { ...PREFERENCIAS_PADRAO };
  }
}

export function aplicarPreferencias(preferencias: PreferenciasAcessibilidade): void {
  const raiz = document.documentElement;
  if (preferencias.escalaFonte === 1) raiz.style.removeProperty("--a11y-escala-fonte");
  else raiz.style.setProperty("--a11y-escala-fonte", String(preferencias.escalaFonte));
  for (const opcao of OPCOES) raiz.toggleAttribute(ATRIBUTO_A11Y[opcao], preferencias[opcao]);
}

let atuais: PreferenciasAcessibilidade = typeof window === "undefined" ? PREFERENCIAS_PADRAO : lerPreferencias();
const ouvintes = new Set<() => void>();

function avisar(): void {
  ouvintes.forEach((ouvinte) => ouvinte());
}

export function preferenciasAtuais(): PreferenciasAcessibilidade {
  return atuais;
}

/** Muda, guarda e aplica na hora — o menu promete efeito imediato. */
export function definirPreferencias(mudanca: Partial<PreferenciasAcessibilidade>): void {
  atuais = { ...atuais, ...mudanca };
  try {
    window.localStorage.setItem(CHAVE_STORAGE_A11Y, JSON.stringify(atuais));
  } catch {
    /* ver lerPreferencias */
  }
  aplicarPreferencias(atuais);
  avisar();
}

export function restaurarPreferencias(): void {
  definirPreferencias(PREFERENCIAS_PADRAO);
}

export function movimentoReduzidoPeloSistema(): boolean {
  return window.matchMedia?.(MEDIA_MOVIMENTO).matches ?? false;
}

/** Vale o que pedir menos movimento: o menu OU o sistema operacional. */
export function movimentoReduzido(): boolean {
  return atuais.reduzirMovimento || movimentoReduzidoPeloSistema();
}

/** Avisa quando o menu, outra aba ou o sistema mudam algo. Devolve a limpeza. */
export function observarAcessibilidade(aoMudar: () => void): () => void {
  ouvintes.add(aoMudar);
  const mql = window.matchMedia?.(MEDIA_MOVIMENTO);
  mql?.addEventListener("change", aoMudar);
  return () => {
    ouvintes.delete(aoMudar);
    mql?.removeEventListener("change", aoMudar);
  };
}

// Outra aba mudou: `storage` só dispara nas OUTRAS abas, então não há laço.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== CHAVE_STORAGE_A11Y) return;
    atuais = lerPreferencias();
    aplicarPreferencias(atuais);
    avisar();
  });
}

export function usePreferenciasAcessibilidade(): PreferenciasAcessibilidade {
  return useSyncExternalStore(observarAcessibilidade, preferenciasAtuais, () => PREFERENCIAS_PADRAO);
}

export function useMovimentoReduzido(): boolean {
  return useSyncExternalStore(observarAcessibilidade, movimentoReduzido, () => false);
}

export function useMovimentoReduzidoPeloSistema(): boolean {
  return useSyncExternalStore(observarAcessibilidade, movimentoReduzidoPeloSistema, () => false);
}
