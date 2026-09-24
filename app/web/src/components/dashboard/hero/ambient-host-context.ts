/**
 * Sinaliza que o AppLayout já montou a cena decorativa compartilhada.
 * Evita segundo canvas nas páginas que também funcionam isoladas em testes.
 * Consumidores: AppLayout e DashboardAtmosphere.
 */
import { createContext } from "react";

export const AmbientHostContext = createContext(false);
