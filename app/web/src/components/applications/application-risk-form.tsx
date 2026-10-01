/**
 * application-risk-form.tsx
 *
 * O QUE FAZ
 * Formulário do contexto de risco de uma aplicação (CP-1): criticidade,
 * ambiente, exposição à internet, sensibilidade do dado e os dois donos.
 * Vive num Dialog aberto a partir da tabela de aplicações.
 *
 * 🎯 A REGRA D2 É MOSTRADA ANTES DE SER APLICADA
 * Um CLIENT OWNER pode SUBIR o risco sozinho e precisa de ADMIN para DESCER.
 * O backend recusa a redução com `RISK_CONTEXT_REDUCTION_REQUIRES_ADMIN`; mas
 * um formulário que deixa a pessoa preencher tudo e só depois diz "não pode"
 * é hostil. Então o formulário calcula a direção de cada mudança enquanto
 * ela digita e AVISA no próprio campo — "reduzir exige um administrador" —
 * antes do envio. O backend continua sendo a barreira; a tela é a cortesia.
 *
 * A mesma comparação alimenta o aviso de impacto: "isto muda o contexto de
 * risco e recalcula a prioridade dos findings desta aplicação". Quem vai
 * rebaixar 12 críticos de uma vez precisa ler isso antes de clicar.
 *
 * CONTRATO DE ACESSIBILIDADE
 *   - Todo controle tem rótulo via `Field` (Select/Input) ou `rotulo` (Switch).
 *   - Aviso de redução é texto sob o campo, associado por `aria-describedby`
 *     através do `Field` (que injeta `dica`).
 *   - Erro do servidor vai num `Alert` no topo, com `role="alert"`.
 *
 * QUEM USA
 * `pages/applications-page.tsx`.
 */

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { applicationsApi } from "../../lib/api/applications.api";
import { useApiError } from "../../hooks/use-api-error";
import { useAuthStore } from "../../store/auth.store";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import { Switch } from "../ui/switch";
import { Field } from "../ui/field";
import { Alert } from "../ui/alert";
import {
  CRITICALITIES,
  CRITICALITY_LABELS,
  DATA_SENSITIVITIES,
  DATA_SENSITIVITY_LABELS,
  ENVIRONMENTS,
  ENVIRONMENT_LABELS,
  rankOf,
  type Application,
  type UpdateRiskContextInput,
} from "../../types/application.types";

export interface ApplicationRiskFormProps {
  application: Application;
  aoSalvar: () => void;
  aoCancelar: () => void;
}

const MAX_OWNER = 180;

export function ApplicationRiskForm({ application, aoSalvar, aoCancelar }: ApplicationRiskFormProps) {
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === "ADMIN";
  const getErrorMessage = useApiError();
  const queryClient = useQueryClient();

  const [criticality, setCriticality] = useState(application.criticality);
  const [environment, setEnvironment] = useState(application.environment);
  const [internetFacing, setInternetFacing] = useState(application.internetFacing);
  const [dataSensitivity, setDataSensitivity] = useState(application.dataSensitivity);
  const [businessOwner, setBusinessOwner] = useState(application.businessOwner ?? "");
  const [technicalOwner, setTechnicalOwner] = useState(application.technicalOwner ?? "");
  const [erro, setErro] = useState<string | null>(null);

  // Direção de cada mudança, no vocabulário do backend (menor rank = menos risco).
  const reducoes = useMemo(() => {
    const r: string[] = [];
    if (rankOf(CRITICALITIES, criticality) < rankOf(CRITICALITIES, application.criticality)) r.push("criticidade");
    if (rankOf(ENVIRONMENTS, environment) < rankOf(ENVIRONMENTS, application.environment)) r.push("ambiente");
    if (!internetFacing && application.internetFacing) r.push("exposição");
    if (rankOf(DATA_SENSITIVITIES, dataSensitivity) < rankOf(DATA_SENSITIVITIES, application.dataSensitivity)) {
      r.push("sensibilidade");
    }
    return r;
  }, [criticality, environment, internetFacing, dataSensitivity, application]);

  const mudouContexto =
    criticality !== application.criticality ||
    environment !== application.environment ||
    internetFacing !== application.internetFacing ||
    dataSensitivity !== application.dataSensitivity;

  const bloqueadoPorReducao = !isAdmin && reducoes.length > 0;

  const mutation = useMutation({
    mutationFn: () => {
      const input: UpdateRiskContextInput = {
        criticality,
        environment,
        internetFacing,
        dataSensitivity,
        businessOwner: businessOwner.trim() || null,
        technicalOwner: technicalOwner.trim() || null,
      };
      return applicationsApi.update(application.id, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["application", application.id] });
      // o VRS dos findings desta app mudou — qualquer listagem em cache está velha
      queryClient.invalidateQueries({ queryKey: ["vulnerabilities"] });
      aoSalvar();
    },
    onError: (e: unknown) => setErro(getErrorMessage(e)),
  });

  const dicaReducao = (dimensao: string) =>
    !isAdmin && reducoes.includes(dimensao) ? "Reduzir exige um administrador. Você pode aumentar." : undefined;

  return (
    <form
      className="mt-4 flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setErro(null);
        mutation.mutate();
      }}
    >
      {erro && <Alert>{erro}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field rotulo="Criticidade" dica={dicaReducao("criticidade")}>
          {(attrs) => (
            <Select
              {...attrs}
              valor={criticality}
              aoMudar={setCriticality}
              opcoes={CRITICALITIES.map((c) => ({ valor: c, rotulo: CRITICALITY_LABELS[c] }))}
            />
          )}
        </Field>

        <Field rotulo="Ambiente" dica={dicaReducao("ambiente")}>
          {(attrs) => (
            <Select
              {...attrs}
              valor={environment}
              aoMudar={setEnvironment}
              opcoes={ENVIRONMENTS.map((e) => ({ valor: e, rotulo: ENVIRONMENT_LABELS[e] }))}
            />
          )}
        </Field>

        <Field rotulo="Sensibilidade do dado" dica={dicaReducao("sensibilidade")}>
          {(attrs) => (
            <Select
              {...attrs}
              valor={dataSensitivity}
              aoMudar={setDataSensitivity}
              opcoes={DATA_SENSITIVITIES.map((d) => ({ valor: d, rotulo: DATA_SENSITIVITY_LABELS[d] }))}
            />
          )}
        </Field>

        <div className="flex items-end">
          <Switch
            checked={internetFacing}
            onCheckedChange={setInternetFacing}
            rotulo="Exposta à internet"
            descricao={dicaReducao("exposição") ?? "Alcançável de fora da rede da empresa."}
          />
        </div>

        <Field rotulo="Dono de negócio" dica="Quem responde pelo sistema. Texto livre.">
          {(attrs) => (
            <Input
              {...attrs}
              value={businessOwner}
              maxLength={MAX_OWNER}
              onChange={(e) => setBusinessOwner(e.target.value)}
              placeholder="Ex.: Diretoria Comercial"
            />
          )}
        </Field>

        <Field rotulo="Dono técnico" dica="Quem corrige. Texto livre.">
          {(attrs) => (
            <Input
              {...attrs}
              value={technicalOwner}
              maxLength={MAX_OWNER}
              onChange={(e) => setTechnicalOwner(e.target.value)}
              placeholder="Ex.: Squad Checkout"
            />
          )}
        </Field>
      </div>

      {mudouContexto && (
        <Alert tom={bloqueadoPorReducao ? "perigo" : "atencao"}>
          {bloqueadoPorReducao
            ? `Esta alteração REDUZ o risco (${reducoes.join(", ")}). Só um administrador pode fazê-la — peça a um admin.`
            : "Isto muda o contexto de risco e recalcula a prioridade (VRS) de todos os findings desta aplicação. A mudança fica registrada na auditoria."}
        </Alert>
      )}

      <div className="mt-2 flex justify-end gap-2">
        <Button type="button" variant="secundario" onClick={aoCancelar} disabled={mutation.isPending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={mutation.isPending || bloqueadoPorReducao}>
          {mutation.isPending ? "Salvando..." : "Salvar contexto"}
        </Button>
      </div>
    </form>
  );
}
