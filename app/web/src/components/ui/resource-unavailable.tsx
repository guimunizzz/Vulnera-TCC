/**
 * Estados de leitura para recursos que chegam por uma URL protegida.
 * Compartilha a mensagem de 403/404 e mantém falhas operacionais distinguíveis.
 * Consumido pelas páginas de detalhe, com retorno definido pelo módulo.
 */
import type { ResourceFailure } from "../../lib/resource-failure";
import { Alert } from "./alert";
import { Button, LinkButton } from "./button";

export function ResourceUnavailable({ backTo, backLabel }: { backTo: string; backLabel: string }) {
  return (
    <section className="flex flex-col items-start gap-4" aria-labelledby="resource-unavailable">
      <h1 id="resource-unavailable" className="text-xl font-semibold text-fg">Recurso indisponível</h1>
      <Alert tom="atencao">O recurso solicitado não está disponível ou você não possui permissão para acessá-lo.</Alert>
      <LinkButton to={backTo} variant="secundario">{backLabel}</LinkButton>
    </section>
  );
}

const loadErrors = {
  unauthorized: { title: "Sessão indisponível", message: "Entre novamente para continuar." },
  "rate-limited": { title: "Muitas solicitações", message: "Aguarde um momento antes de tentar novamente." },
  connectivity: { title: "Falha de comunicação", message: "O servidor não respondeu. Verifique sua conexão e tente novamente." },
  operational: { title: "Não foi possível carregar o recurso", message: "O serviço encontrou um problema. Tente novamente." },
} satisfies Record<Exclude<ResourceFailure, "unavailable">, { title: string; message: string }>;

export function ResourceLoadError({ failure, onRetry }: {
  failure: Exclude<ResourceFailure, "unavailable">;
  onRetry?: () => void;
}) {
  const { title, message } = loadErrors[failure];
  return (
    <section className="flex flex-col items-start gap-4" aria-labelledby="resource-load-error">
      <h1 id="resource-load-error" className="text-xl font-semibold text-fg">{title}</h1>
      <Alert tom="perigo">{message}</Alert>
      {failure === "unauthorized" ? <LinkButton to="/login" variant="secundario">Ir para o login</LinkButton> :
        onRetry && <Button variant="secundario" onClick={onRetry}>Tentar novamente</Button>}
    </section>
  );
}
