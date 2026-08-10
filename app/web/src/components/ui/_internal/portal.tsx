/**
 * portal.tsx
 *
 * O QUE FAZ
 * Renderiza filhos num nó anexado ao `<body>`, fora da árvore do React onde o
 * componente foi declarado.
 *
 * POR QUE EXISTE
 * Substitui o `<DialogPrimitive.Portal>` do Radix (ADR-023). Sem portal, um
 * dialog declarado dentro de um card herda o `overflow: hidden`, o `transform`
 * e o `z-index` do card — e aparece cortado, ou atrás de outra coisa, por
 * motivos que não têm nada a ver com o dialog. Um `transform` em QUALQUER
 * ancestral, inclusive o de uma animação do `motion`, cria um novo contexto de
 * posicionamento e quebra `position: fixed`; o portal é a única saída
 * confiável.
 *
 * QUEM USA
 * `Dialog`, `Drawer`, `Popover`, `DropdownMenu`, `ContextMenu`, `Tooltip`,
 * `Toast`.
 */

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function Portal({ children }: { children: ReactNode }) {
  const [no, setNo] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const el = document.createElement("div");
    // `data-portal` é o gancho que `useInertForaDe` usa para saber quais
    // irmãos do body pertencem a overlays e não devem virar inertes.
    el.setAttribute("data-portal", "");
    document.body.appendChild(el);
    setNo(el);
    return () => {
      document.body.removeChild(el);
    };
  }, []);

  // Primeiro render devolve null: o nó só existe depois do efeito. É o
  // comportamento correto também em teste, onde a montagem é síncrona e o
  // conteúdo aparece no render seguinte.
  return no ? createPortal(children, no) : null;
}
