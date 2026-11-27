/**
 * Contêiner de todas as rotas protegidas, inclusive onboarding e relatório DAST.
 * Consumido por App: mantém uma instância do assistente fora das transições de página.
 */
import { Outlet } from "react-router-dom";
import { Assistant } from "../assistant/assistant";

export function AuthenticatedLayout() {
  return <><Outlet /><Assistant /></>;
}
