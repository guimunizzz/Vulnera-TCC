/**
 * features/atmosfera-3d/atmosfera.store.ts
 *
 * O QUE FAZ
 * O canal entre as telas e a atmosfera do layout. A tela não conhece a cena;
 * ela só publica três coisas:
 *
 *   risco       0–1, calculado do que a tela já carregou (`risco.ts`)
 *   supressão   "agora a atmosfera some" — a tela tem a própria cena 3D
 *               (aba Mapa 3D do Exposure Graph)
 *   ping        "algo aconteceu aqui" — a cena solta um ping do radar
 *               (seleção de nó no grafo)
 *
 * DONO
 * Risco e supressão têm dono: só quem publicou limpa. Na troca de rota a
 * página que sai ainda está montada durante a transição, e a desmontagem
 * dela não pode apagar o que a página nova já publicou.
 *
 * Não importa three: roda no bundle principal.
 */

import { useEffect, useId } from "react";
import { create } from "zustand";

interface EstadoDaAtmosfera {
  risco: number | null;
  donoDoRisco: string | null;
  /** Quem pediu para a atmosfera sumir (null = ninguém). */
  supressao: string | null;
  /** Cresce a cada ping pedido; a cena reage à mudança. */
  sinal: number;
  publicarRisco: (dono: string, risco: number | null) => void;
  limparRisco: (dono: string) => void;
  suprimir: (dono: string) => void;
  liberar: (dono: string) => void;
  pingar: () => void;
}

export const useAtmosferaStore = create<EstadoDaAtmosfera>((set) => ({
  risco: null,
  donoDoRisco: null,
  supressao: null,
  sinal: 0,
  publicarRisco: (dono, risco) => set({ donoDoRisco: dono, risco }),
  limparRisco: (dono) => set((e) => (e.donoDoRisco === dono ? { donoDoRisco: null, risco: null } : e)),
  suprimir: (dono) => set({ supressao: dono }),
  liberar: (dono) => set((e) => (e.supressao === dono ? { supressao: null } : e)),
  pingar: () => set((e) => ({ sinal: e.sinal + 1 })),
}));

/** A tela entrega o seu risco enquanto estiver montada; `undefined` = ainda carregando. */
export function usePublicarRisco(risco: number | null | undefined): void {
  const dono = useId();
  const publicar = useAtmosferaStore((s) => s.publicarRisco);
  const limpar = useAtmosferaStore((s) => s.limparRisco);
  useEffect(() => {
    if (risco !== undefined) publicar(dono, risco);
  }, [dono, risco, publicar]);
  useEffect(() => () => limpar(dono), [dono, limpar]);
}

/** Enquanto `ativa`, a atmosfera do layout some (com o mesmo crossfade da troca de seção). */
export function useSuprimirAtmosfera(ativa: boolean): void {
  const dono = useId();
  const suprimir = useAtmosferaStore((s) => s.suprimir);
  const liberar = useAtmosferaStore((s) => s.liberar);
  useEffect(() => {
    if (!ativa) return;
    suprimir(dono);
    return () => liberar(dono);
  }, [ativa, dono, suprimir, liberar]);
}

/** Pede um ping do radar à atmosfera (fora de componente também). */
export const pingarAtmosfera = (): void => useAtmosferaStore.getState().pingar();
