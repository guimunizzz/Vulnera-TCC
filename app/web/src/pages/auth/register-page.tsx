/**
 * Redireciona o cadastro legado para o fluxo de solicitação de acesso.
 * Mantém bookmarks antigos funcionando sem chamar `/auth/register` na interface.
 * Consumido somente pela rota pública `/register` em `App.tsx`.
 */

import { Navigate } from "react-router-dom";

export function RegisterPage() {
  return <Navigate to="/request-access" replace />;
}
