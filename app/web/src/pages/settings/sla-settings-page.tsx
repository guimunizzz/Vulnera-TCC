/**
 * sla-settings-page.tsx
 *
 * O QUE FAZ
 * Configuração da política de SLA de remediação (CP-2): quantos dias corridos
 * cada severidade tem para ser corrigida. Quatro números, um histórico e —
 * para ADMIN — o botão que reaplica a política aos findings abertos.
 *
 * QUEM VÊ O QUÊ
 *   CLIENT  → a própria empresa (resolvida por /companies/me). OWNER edita;
 *             MEMBER só lê (o backend recusa o PUT; a tela nem oferece).
 *   ADMIN   → escolhe a empresa num Select e edita qualquer uma. Só ele vê
 *             "Reaplicar aos findings abertos", porque só ele pode.
 *   PENTESTER → não chega aqui (rota guardada).
 *
 * 🎯 SALVAR NÃO RECALCULA NADA. A tela diz isso em letras grandes, porque é a
 * decisão que mais surpreende: a política nova vale para os PRÓXIMOS findings;
 * quem já tem prazo mantém o prazo. Reaplicar é ação separada, de ADMIN, e
 * fica registrada na auditoria — é o que impede "consertar" um estouro
 * afrouxando a regra.
 *
 * CONTRATO DE ACESSIBILIDADE
 *   - Cada campo numérico tem rótulo via `Field` e `inputMode="numeric"`.
 *   - Feedback de sucesso/erro em `Alert` (`role="alert"`).
 *   - Histórico é uma `<table>` com `<caption>`.
 *
 * QUEM USA
 * Rota `/settings/sla` (ADMIN, CLIENT).
 */

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { companiesApi } from "../../lib/api/companies.api";
import { slaPolicyApi } from "../../lib/api/sla-policy.api";
import { useApiError } from "../../hooks/use-api-error";
import { useAuthStore } from "../../store/auth.store";
import { Breadcrumb } from "../../components/ui/navigation";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { Field } from "../../components/ui/field";
import { Alert } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { SLA_DAYS_MAX, SLA_DAYS_MIN, type SlaPolicy, type UpsertSlaPolicyInput } from "../../types/sla-policy.types";

const SEVERIDADES = [
  { chave: "criticalDays", rotulo: "Crítica", dica: "CVSS 9.0–10.0" },
  { chave: "highDays", rotulo: "Alta", dica: "CVSS 7.0–8.9" },
  { chave: "mediumDays", rotulo: "Média", dica: "CVSS 4.0–6.9" },
  { chave: "lowDays", rotulo: "Baixa", dica: "CVSS 0.1–3.9" },
] as const;

type ChaveDias = (typeof SEVERIDADES)[number]["chave"];

export function SlaSettingsPage() {
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === "ADMIN";
  const getErrorMessage = useApiError();
  const queryClient = useQueryClient();

  // ADMIN escolhe a empresa; CLIENT usa a própria.
  const empresas = useQuery({ queryKey: ["companies"], queryFn: companiesApi.list, enabled: isAdmin });
  const minha = useQuery({ queryKey: ["companies", "me"], queryFn: companiesApi.me, enabled: !isAdmin, retry: false });
  const [companyId, setCompanyId] = useState<string | null>(null);
  useEffect(() => {
    if (!isAdmin && minha.data) setCompanyId(minha.data.id);
    if (isAdmin && !companyId && empresas.data?.[0]) setCompanyId(empresas.data[0].id);
  }, [isAdmin, minha.data, empresas.data, companyId]);

  const politica = useQuery({
    queryKey: ["sla-policy", companyId],
    queryFn: () => slaPolicyApi.get(companyId!),
    enabled: Boolean(companyId),
  });
  const historico = useQuery({
    queryKey: ["sla-policy", companyId, "history"],
    queryFn: () => slaPolicyApi.history(companyId!),
    enabled: Boolean(companyId),
  });

  const [dias, setDias] = useState<Record<ChaveDias, string>>({
    criticalDays: "2",
    highDays: "7",
    mediumDays: "30",
    lowDays: "90",
  });
  useEffect(() => {
    if (politica.data) {
      setDias({
        criticalDays: String(politica.data.criticalDays),
        highDays: String(politica.data.highDays),
        mediumDays: String(politica.data.mediumDays),
        lowDays: String(politica.data.lowDays),
      });
    }
  }, [politica.data]);

  const [feedback, setFeedback] = useState<{ tom: "sucesso" | "perigo" | "info"; texto: string } | null>(null);

  const erros = useMemo(() => {
    const e: Partial<Record<ChaveDias, string>> = {};
    for (const s of SEVERIDADES) {
      const n = Number(dias[s.chave]);
      if (!Number.isInteger(n) || n < SLA_DAYS_MIN || n > SLA_DAYS_MAX) e[s.chave] = `Entre ${SLA_DAYS_MIN} e ${SLA_DAYS_MAX} dias.`;
    }
    return e;
  }, [dias]);
  const valido = Object.keys(erros).length === 0;

  const salvar = useMutation({
    mutationFn: () => {
      const input: UpsertSlaPolicyInput = {
        criticalDays: Number(dias.criticalDays),
        highDays: Number(dias.highDays),
        mediumDays: Number(dias.mediumDays),
        lowDays: Number(dias.lowDays),
      };
      return slaPolicyApi.upsert(companyId!, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sla-policy", companyId] });
      setFeedback({
        tom: "sucesso",
        texto: "Política salva. Vale para os próximos findings; os que já têm prazo mantêm o prazo.",
      });
    },
    onError: (e: unknown) => setFeedback({ tom: "perigo", texto: getErrorMessage(e) }),
  });

  const reaplicar = useMutation({
    mutationFn: () => slaPolicyApi.apply(companyId!),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ["vulnerabilities"] });
      setFeedback({ tom: "sucesso", texto: `Prazo recalculado em ${r.recalculated} finding(s) aberto(s). Registrado na auditoria.` });
    },
    onError: (e: unknown) => setFeedback({ tom: "perigo", texto: getErrorMessage(e) }),
  });

  const podeEditar = isAdmin || useAuthStore.getState().user?.companyRole === "OWNER";

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb itens={[{ rotulo: "Configurações" }, { rotulo: "SLA de remediação" }]} />

      <header>
        <h1 className="text-2xl font-bold text-fg">SLA de remediação</h1>
        <p className="mt-1 max-w-prose text-fg-muted">
          Quantos dias corridos cada severidade tem para ser corrigida. O relógio começa quando o finding é
          registrado e para quando ele é marcado como corrigido.
        </p>
      </header>

      {isAdmin && (
        <Field rotulo="Empresa" className="max-w-sm">
          {(attrs) => (
            <Select
              {...attrs}
              valor={companyId}
              aoMudar={(v) => {
                setCompanyId(v);
                setFeedback(null);
              }}
              opcoes={(empresas.data ?? []).map((c) => ({ valor: c.id, rotulo: c.name }))}
              placeholder="Escolha a empresa"
            />
          )}
        </Field>
      )}

      {feedback && (
        <Alert tom={feedback.tom} aoFechar={() => setFeedback(null)}>
          {feedback.texto}
        </Alert>
      )}

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h2 className="font-semibold text-fg">Política vigente</h2>
          {politica.data?.isDefault && <Badge tom="neutro">padrão do produto</Badge>}
          {politica.data && !politica.data.isDefault && <Badge tom="acento">própria da empresa</Badge>}
        </div>

        {politica.isLoading && <p className="text-fg-muted">Carregando...</p>}

        {politica.data && (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              setFeedback(null);
              salvar.mutate();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {SEVERIDADES.map((s) => (
                <Field key={s.chave} rotulo={`${s.rotulo} (dias)`} dica={s.dica} erro={erros[s.chave]}>
                  {(attrs) => (
                    <Input
                      {...attrs}
                      type="number"
                      inputMode="numeric"
                      min={SLA_DAYS_MIN}
                      max={SLA_DAYS_MAX}
                      value={dias[s.chave]}
                      disabled={!podeEditar}
                      onChange={(e) => setDias((d) => ({ ...d, [s.chave]: e.target.value }))}
                    />
                  )}
                </Field>
              ))}
            </div>

            <Alert tom="info">
              <strong>Salvar não recalcula nada.</strong> A política nova vale para os próximos findings; quem já tem
              prazo mantém o prazo. Isso impede que um estouro seja "consertado" afrouxando a regra.
              {isAdmin && " Para reescrever os prazos dos findings abertos, use o botão ao lado — a ação fica na auditoria."}
            </Alert>

            <div className="flex flex-wrap justify-end gap-2">
              {isAdmin && (
                <Button
                  type="button"
                  variant="secundario"
                  disabled={reaplicar.isPending || !companyId}
                  onClick={() => {
                    setFeedback(null);
                    reaplicar.mutate();
                  }}
                >
                  {reaplicar.isPending ? "Recalculando..." : "Reaplicar aos findings abertos"}
                </Button>
              )}
              {podeEditar && (
                <Button type="submit" disabled={!valido || salvar.isPending}>
                  {salvar.isPending ? "Salvando..." : "Salvar política"}
                </Button>
              )}
            </div>
          </form>
        )}
      </Card>

      {historico.data && historico.data.length > 0 && (
        <Card>
          <h2 className="mb-3 font-semibold text-fg">Histórico</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Versões da política de SLA desta empresa</caption>
              <thead className="text-fg-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Desde</th>
                  <th className="px-3 py-2 font-medium">Crítica</th>
                  <th className="px-3 py-2 font-medium">Alta</th>
                  <th className="px-3 py-2 font-medium">Média</th>
                  <th className="px-3 py-2 font-medium">Baixa</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {historico.data.map((p: SlaPolicy) => (
                  <tr key={p.id} className="border-t border-subtle">
                    <td className="px-3 py-2 text-fg-muted">{new Date(p.createdAt).toLocaleDateString("pt-BR")}</td>
                    <td className="px-3 py-2 tabular-nums">{p.criticalDays}d</td>
                    <td className="px-3 py-2 tabular-nums">{p.highDays}d</td>
                    <td className="px-3 py-2 tabular-nums">{p.mediumDays}d</td>
                    <td className="px-3 py-2 tabular-nums">{p.lowDays}d</td>
                    <td className="px-3 py-2">
                      {p.isActive ? <Badge tom="sucesso">vigente</Badge> : <Badge tom="neutro">substituída</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
