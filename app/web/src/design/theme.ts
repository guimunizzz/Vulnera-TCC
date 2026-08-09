/**
 * theme.ts
 *
 * O QUE FAZ
 * A lógica de tema em TypeScript puro: qual a preferência guardada, como ela
 * se resolve em um tema concreto, e como aplicá-la ao documento.
 *
 * POR QUE É SEPARADO DO REACT
 * Porque o tema precisa ser aplicado ANTES do React existir. O `index.html`
 * roda uma versão mínima desta mesma lógica num script inline, antes do
 * primeiro paint — senão a página aparece clara por um quadro e escurece
 * depois (o "flash"). Este módulo é a fonte da verdade do contrato; o script
 * inline é a cópia mínima dele, e os dois compartilham a chave de storage e os
 * nomes dos temas de propósito.
 *
 * ⚠️ Ao mexer em `CHAVE_STORAGE` ou nos valores de `Theme`, mexa TAMBÉM no
 * script inline do `index.html`. Um teste (`theme.test.ts`) confere que os dois
 * concordam, justamente porque essa é a divergência fácil de introduzir.
 *
 * QUEM USA
 * `design/theme-provider.tsx` (o React em volta) e `index.html` (o inline).
 */

/** O que a pessoa ESCOLHEU. `system` delega ao sistema operacional. */
export type Theme = "dark" | "light" | "system";

/** O que a interface REALMENTE renderiza. `system` já foi resolvido. */
export type ThemeResolvido = "dark" | "light";

export const TEMAS: readonly Theme[] = ["dark", "light", "system"] as const;

/** Precisa bater com o `index.html`. Ver aviso no topo. */
export const CHAVE_STORAGE = "vulnera:theme";

/** Escuro é o padrão — ver tokens.css §8 para o porquê. */
export const TEMA_PADRAO: Theme = "dark";

const MEDIA_ESCURO = "(prefers-color-scheme: dark)";

/** Lê a preferência guardada. Qualquer valor inválido cai no padrão. */
export function lerTemaGuardado(): Theme {
  try {
    const bruto = window.localStorage.getItem(CHAVE_STORAGE);
    return (TEMAS as readonly string[]).includes(bruto ?? "") ? (bruto as Theme) : TEMA_PADRAO;
  } catch {
    // localStorage lança em modo privado de alguns navegadores e quando o
    // usuário bloqueia storage de terceiros. Tema não é motivo para quebrar a
    // aplicação inteira.
    return TEMA_PADRAO;
  }
}

export function guardarTema(tema: Theme): void {
  try {
    window.localStorage.setItem(CHAVE_STORAGE, tema);
  } catch {
    /* ver acima */
  }
}

/** `system` → o que o SO pede agora. Os outros dois são eles mesmos. */
export function resolverTema(tema: Theme): ThemeResolvido {
  if (tema !== "system") return tema;
  return window.matchMedia?.(MEDIA_ESCURO).matches ? "dark" : "light";
}

/**
 * Aplica o tema ao documento.
 *
 * Sempre estampa um valor CONCRETO em `data-theme` (nunca "system"). Isso deixa
 * o CSS com só dois casos a tratar (`:root` = escuro, `:root[data-theme=light]`
 * = claro) em vez de três, e mata a necessidade de duplicar a paleta clara
 * dentro de um `@media (prefers-color-scheme)`.
 *
 * `color-scheme` acompanha porque é o que faz o navegador pintar barra de
 * rolagem, campos nativos e a moldura de `<dialog>` no tom certo — CSS nosso
 * não alcança essas partes.
 */
export function aplicarTema(tema: Theme): ThemeResolvido {
  const resolvido = resolverTema(tema);
  const raiz = document.documentElement;
  raiz.setAttribute("data-theme", resolvido);
  raiz.style.colorScheme = resolvido;
  return resolvido;
}

/**
 * Observa a troca de tema do SO. Só faz efeito quando a preferência é
 * `system` — quem escolheu explicitamente não quer que o SO mande.
 * Devolve a função de limpeza.
 */
export function observarTemaDoSistema(aoMudar: (resolvido: ThemeResolvido) => void): () => void {
  const mql = window.matchMedia?.(MEDIA_ESCURO);
  if (!mql) return () => {};
  const handler = (e: MediaQueryListEvent) => aoMudar(e.matches ? "dark" : "light");
  mql.addEventListener("change", handler);
  return () => mql.removeEventListener("change", handler);
}

/** Rótulos em PT-BR para o seletor de tema. */
export const ROTULO_TEMA: Record<Theme, string> = {
  dark: "Escuro",
  light: "Claro",
  system: "Sistema",
};
