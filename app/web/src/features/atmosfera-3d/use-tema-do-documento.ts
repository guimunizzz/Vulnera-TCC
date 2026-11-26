/**
 * features/atmosfera-3d/use-tema-do-documento.ts
 *
 * O tema estampado em `<html data-theme>` como estado React. O kit three tem
 * `observarTema`, mas aquele módulo importa three; este roda no bundle
 * principal e no chunk dos pôsteres.
 */

import { useEffect, useState } from "react";
import type { TemaDaVariante } from "./tipos-base";

const ler = (): TemaDaVariante => (document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark");

export function useTemaDoDocumento(): TemaDaVariante {
  const [tema, setTema] = useState(ler);
  useEffect(() => {
    const observador = new MutationObserver(() => setTema(ler()));
    observador.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observador.disconnect();
  }, []);
  return tema;
}
