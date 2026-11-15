/**
 * accessibility-menu.tsx
 *
 * O QUE FAZ
 * O botão de acessibilidade do canto superior direito. Abre um painel com
 * tamanho do texto, alto contraste, reduzir animações, sublinhar links,
 * espaçamento de texto e foco reforçado. Cada mudança vale na hora e fica
 * guardada neste navegador (design/accessibility.ts).
 *
 * POR QUE UM POPOVER E NÃO UM DROPDOWN MENU
 * O painel tem interruptores e botões de passo, que são controles de
 * formulário. `role="menu"` só admite itens de menu e muda as teclas que o
 * leitor de tela espera; um popover (`role="dialog"` não modal) aceita os
 * controles como eles são.
 *
 * ==========================================================================
 * CONTRATO DE ACESSIBILIDADE
 * ==========================================================================
 * ROLE / ARIA
 *   - Gatilho: botão com `aria-label` ("Acessibilidade", ou "Acessibilidade
 *     (ajustes ativos)" quando algo mudou); `aria-expanded`, `aria-controls` e
 *     `aria-haspopup="dialog"` vêm do Popover.
 *   - Painel: `role="dialog"` com `aria-label="Acessibilidade"`.
 *   - Tamanho do texto: grupo com dois botões de rótulo próprio e o valor num
 *     `<output aria-live="polite">`, anunciado a cada passo.
 *   - Opções: `Switch` (`role="switch"` + `aria-checked` + descrição ligada).
 *   - Todo ícone é `aria-hidden`: o nome está sempre no texto.
 *
 * TECLADO
 *   Enter/Espaço abre · Tab circula dentro do painel · Escape fecha e devolve o
 *   foco ao botão. No limite (100% ou 200%) o botão de passo fica
 *   `aria-disabled`, não `disabled`: `disabled` tiraria o foco de quem acabou
 *   de apertá-lo e o jogaria para o `<body>`.
 *
 * ALVO DE TOQUE
 *   Gatilho e botões de passo usam `.alvo-estendido` (44×44); cada interruptor
 *   ocupa uma linha de 44px.
 * ==========================================================================
 *
 * QUEM USA
 * `AppLayout` (cabeçalho), a navegação da landing e `ComMenuAcessibilidade`
 * (rotas sem cabeçalho: login, cadastro, planos, onboarding, relatório do ZAP).
 */

import { useId } from "react";
import { Outlet } from "react-router-dom";
import {
  AArrowDown,
  AArrowUp,
  ALargeSmall,
  Accessibility,
  CirclePause,
  Contrast,
  Focus,
  RotateCcw,
  Space,
  Underline,
  type LucideIcon,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Popover } from "../components/ui/popover";
import { Switch } from "../components/ui/switch";
import { cn } from "../lib/cn";
import {
  ESCALAS_FONTE,
  PREFERENCIAS_PADRAO,
  definirPreferencias,
  restaurarPreferencias,
  useMovimentoReduzidoPeloSistema,
  usePreferenciasAcessibilidade,
  type OpcaoAcessibilidade,
  type PreferenciasAcessibilidade,
} from "./accessibility";

const OPCOES: { chave: OpcaoAcessibilidade; rotulo: string; descricao: string; Icone: LucideIcon }[] = [
  { chave: "altoContraste", rotulo: "Alto contraste", descricao: "Texto, bordas e foco mais fortes (nível AAA).", Icone: Contrast },
  { chave: "reduzirMovimento", rotulo: "Reduzir animações", descricao: "Para efeitos de movimento e fundos animados.", Icone: CirclePause },
  { chave: "sublinharLinks", rotulo: "Sublinhar links", descricao: "Links reconhecíveis sem depender da cor.", Icone: Underline },
  { chave: "espacamentoTexto", rotulo: "Espaçamento de texto", descricao: "Mais espaço entre linhas, letras e palavras.", Icone: Space },
  { chave: "focoReforcado", rotulo: "Foco reforçado", descricao: "Contorno mais grosso no item focado pelo teclado.", Icone: Focus },
];

function foiAlterado(preferencias: PreferenciasAcessibilidade): boolean {
  return (Object.keys(PREFERENCIAS_PADRAO) as (keyof PreferenciasAcessibilidade)[]).some(
    (chave) => preferencias[chave] !== PREFERENCIAS_PADRAO[chave],
  );
}

function PainelAcessibilidade({ preferencias }: { preferencias: PreferenciasAcessibilidade }) {
  const idFonte = useId();
  const sistemaReduz = useMovimentoReduzidoPeloSistema();
  const alterado = foiAlterado(preferencias);
  const indice = (ESCALAS_FONTE as readonly number[]).indexOf(preferencias.escalaFonte);
  const noMinimo = indice <= 0;
  const noMaximo = indice === ESCALAS_FONTE.length - 1;

  const mudarEscala = (passo: number) => {
    const escala = ESCALAS_FONTE[indice + passo];
    if (escala !== undefined) definirPreferencias({ escalaFonte: escala });
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 border-b border-subtle px-4 py-3">
        <Accessibility className="h-4 w-4 text-accent-ink" aria-hidden="true" />
        <p className="text-sm font-semibold text-fg">Acessibilidade</p>
      </div>

      <div className="flex flex-col gap-1 px-4 py-2">
        <div className="flex min-h-touch items-center justify-between gap-4">
          <span id={idFonte} className="flex items-center gap-2 text-sm text-fg">
            <ALargeSmall className="h-4 w-4 shrink-0 text-fg-muted" aria-hidden="true" />
            Tamanho do texto
          </span>
          <div role="group" aria-labelledby={idFonte} className="flex items-center gap-1">
            <Button
              variant="secundario"
              size="sm"
              rotulo="Diminuir texto"
              className="w-8 px-0"
              aria-disabled={noMinimo || undefined}
              onClick={() => mudarEscala(-1)}
            >
              <AArrowDown className="h-4 w-4" aria-hidden="true" />
            </Button>
            <output aria-live="polite" className="w-12 text-center text-sm font-medium tabular-nums text-fg">
              {Math.round(preferencias.escalaFonte * 100)}%
            </output>
            <Button
              variant="secundario"
              size="sm"
              rotulo="Aumentar texto"
              className="w-8 px-0"
              aria-disabled={noMaximo || undefined}
              onClick={() => mudarEscala(1)}
            >
              <AArrowUp className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        {OPCOES.map(({ chave, rotulo, descricao, Icone }) => {
          // Quem já pediu menos movimento no sistema operacional não consegue
          // desligá-lo daqui — o interruptor mostra o estado real e explica.
          const peloSistema = chave === "reduzirMovimento" && sistemaReduz;
          return (
            <Switch
              key={chave}
              checked={preferencias[chave] || peloSistema}
              disabled={peloSistema}
              onCheckedChange={(ligado) => definirPreferencias({ [chave]: ligado } as Partial<PreferenciasAcessibilidade>)}
              rotulo={
                <span className="flex items-center gap-2">
                  <Icone className="h-4 w-4 shrink-0 text-fg-muted" aria-hidden="true" />
                  {rotulo}
                </span>
              }
              descricao={peloSistema ? "Já ativo pelas configurações do seu sistema." : descricao}
            />
          );
        })}
      </div>

      <div className="border-t border-subtle px-4 py-3">
        <Button
          variant="secundario"
          size="sm"
          larguraTotal
          iconeInicio={<RotateCcw className="h-4 w-4" />}
          aria-disabled={!alterado || undefined}
          onClick={() => alterado && restaurarPreferencias()}
        >
          Restaurar padrão
        </Button>
      </div>
    </div>
  );
}

export function AccessibilityMenu({ className }: { className?: string }) {
  const preferencias = usePreferenciasAcessibilidade();
  const alterado = foiAlterado(preferencias);

  return (
    <Popover
      lado="bottom"
      alinhamento="end"
      rotulo="Acessibilidade"
      className="w-[min(22rem,calc(100vw-2rem))] p-0"
      gatilho={
        <Button
          variant="fantasma"
          size="sm"
          rotulo={alterado ? "Acessibilidade (ajustes ativos)" : "Acessibilidade"}
          className={cn("w-8 px-0", className)}
        >
          <Accessibility className="h-5 w-5" aria-hidden="true" />
          {alterado && <span aria-hidden="true" className="absolute right-1 top-1 h-2 w-2 rounded-full bg-accent" />}
        </Button>
      }
    >
      <PainelAcessibilidade preferencias={preferencias} />
    </Popover>
  );
}

/**
 * Rotas sem cabeçalho próprio: o mesmo menu, fixo no canto superior direito,
 * e primeiro na ordem de Tab — quem precisa de letra maior acha antes do
 * formulário.
 */
export function ComMenuAcessibilidade() {
  return (
    <>
      <div className="fixed right-4 top-4 z-sticky">
        <AccessibilityMenu className="h-10 w-10 border border-strong bg-surface shadow-raised" />
      </div>
      <Outlet />
    </>
  );
}
