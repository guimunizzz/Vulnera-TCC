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

import { useEffect, useMemo, useRef, useState } from "react";
import { animate, motion } from "motion/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { companiesApi } from "../../lib/api/companies.api";
import { slaPolicyApi } from "../../lib/api/sla-policy.api";
import { useApiError } from "../../hooks/use-api-error";
import { useAuthStore } from "../../store/auth.store";
import { Breadcrumb, ScrollArea } from "../../components/ui/navigation";
import { Card, Skeleton } from "../../components/ui/card";
import { ErrorState } from "../../components/ui/empty-state";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { Field } from "../../components/ui/field";
import { Alert } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { SLA_DAYS_MAX, SLA_DAYS_MIN, type SlaPolicy, type UpsertSlaPolicyInput } from "../../types/sla-policy.types";
import { useMotion } from "../../motion/use-motion";
import { DURACAO, EASE } from "../../motion/tokens";
import "./sla-settings-page.css";

const SEVERIDADES = [
  { chave: "criticalDays", rotulo: "Crítica", dica: "CVSS 9.0–10.0", tom: "critical" },
  { chave: "highDays", rotulo: "Alta", dica: "CVSS 7.0–8.9", tom: "high" },
  { chave: "mediumDays", rotulo: "Média", dica: "CVSS 4.0–6.9", tom: "medium" },
  { chave: "lowDays", rotulo: "Baixa", dica: "CVSS 0.1–3.9", tom: "low" },
] as const;

type ChaveDias = (typeof SEVERIDADES)[number]["chave"];

export function SlaSettingsPage() {
  const { item, lista, troca } = useMotion();
  const jaMostrouPolitica = useRef(false);
  const jaMostrouHistorico = useRef(false);
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

  useEffect(() => {
    if (politica.data) jaMostrouPolitica.current = true;
  }, [politica.data]);
  useEffect(() => {
    if (historico.data?.length) jaMostrouHistorico.current = true;
  }, [historico.data]);

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
    <div className="sla-workspace flex flex-col gap-5">
      <Breadcrumb itens={[{ rotulo: "Configurações" }, { rotulo: "SLA de remediação" }]} />

      <header className="sla-hero relative overflow-hidden rounded-container border border-subtle p-5 sm:p-6">
        <div aria-hidden="true" className="sla-hero-clock pointer-events-none absolute" />
        <div className="relative">
          <p className="font-mono text-xs font-medium uppercase tracking-[0.16em] text-accent-ink">Governança de resposta / Política de tempo</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-fg">SLA de remediação</h1>
          <p className="mt-2 max-w-prose text-sm text-fg-secondary">
            Defina os dias corridos para corrigir cada severidade. O prazo começa no registro do finding e para quando ele é marcado como corrigido.
          </p>
        </div>
      </header>

      {isAdmin && (
        <div className="sla-company-panel rounded-container border border-subtle bg-surface p-4">
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
        </div>
      )}

      {feedback && (
        <motion.div variants={troca} initial="inicial" animate="visivel" key={feedback.texto}>
          <Alert tom={feedback.tom} aoFechar={() => setFeedback(null)}>{feedback.texto}</Alert>
        </motion.div>
      )}

      {(empresas.isError && isAdmin || minha.isError && !isAdmin) && (
        <ErrorState titulo="Não foi possível identificar a empresa" aoTentarNovamente={() => void (isAdmin ? empresas.refetch() : minha.refetch())} />
      )}

      <motion.div key={companyId ?? "sem-empresa"} variants={troca} initial="inicial" animate="visivel">
        <Card className="sla-policy-card">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-accent-ink">Da maior à menor severidade</p>
              <h2 className="mt-1 text-lg font-semibold text-fg">Política vigente</h2>
            </div>
            {politica.data?.isDefault && <Badge tom="neutro">padrão do produto</Badge>}
            {politica.data && !politica.data.isDefault && <Badge tom="acento">própria da empresa</Badge>}
          </div>

          {companyId && politica.isLoading && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true">
              <span className="sr-only">Carregando política de SLA</span>
              {SEVERIDADES.map((s) => <Skeleton key={s.chave} className="h-40 w-full" />)}
            </div>
          )}
          {!companyId && !empresas.isError && !minha.isError && !empresas.isLoading && !minha.isLoading && (
            <p className="rounded-control border border-dashed border-subtle p-6 text-sm text-fg-muted">Selecione uma empresa para consultar a política.</p>
          )}
          {politica.isError && <ErrorState titulo="Não foi possível carregar a política" descricao={getErrorMessage(politica.error)} aoTentarNovamente={() => void politica.refetch()} />}

          {politica.data && (
            <form
              className="flex flex-col gap-5"
              onSubmit={(e) => {
                e.preventDefault();
                setFeedback(null);
                salvar.mutate();
              }}
            >
              <motion.div className="sla-level-grid grid gap-3 sm:grid-cols-2 xl:grid-cols-4" variants={lista} initial={jaMostrouPolitica.current ? false : "inicial"} animate="visivel">
                {SEVERIDADES.map((s) => (
                  <motion.div key={s.chave} variants={item}>
                    <PrazoPorSeveridade
                      severidade={s}
                      valor={dias[s.chave]}
                      erro={erros[s.chave]}
                      disabled={!podeEditar}
                      onChange={(valor) => setDias((atual) => ({ ...atual, [s.chave]: valor }))}
                    />
                  </motion.div>
                ))}
              </motion.div>

              <div className="sla-save-panel flex flex-wrap items-center justify-between gap-4 rounded-container border border-subtle p-4">
                <div className="max-w-prose">
                  <h3 className="text-sm font-semibold text-fg">{podeEditar ? "Salvar política" : "Política para consulta"}</h3>
                  <p className="mt-1 text-sm text-fg-secondary">{podeEditar ? "A nova política vale para os próximos findings. Salvar não recalcula prazos já existentes." : "A edição desta política é reservada ao responsável pela empresa."}</p>
                </div>
                {podeEditar && <Button type="submit" disabled={!valido || salvar.isPending}>{salvar.isPending ? "Salvando…" : "Salvar política"}</Button>}
              </div>

              {isAdmin && (
                <div className="sla-reapply-panel flex flex-wrap items-center justify-between gap-4 rounded-container border p-4">
                  <div className="max-w-prose">
                    <h3 className="text-sm font-semibold text-warning-ink">Reaplicar aos findings abertos</h3>
                    <p className="mt-1 text-sm text-fg-secondary">Recalcula os prazos dos findings abertos com a política vigente e registra a ação na auditoria.</p>
                  </div>
                  <Button
                    type="button"
                    variant="secundario"
                    disabled={reaplicar.isPending || !companyId}
                    onClick={() => {
                      setFeedback(null);
                      reaplicar.mutate();
                    }}
                  >
                    {reaplicar.isPending ? "Recalculando…" : "Reaplicar aos findings abertos"}
                  </Button>
                </div>
              )}
            </form>
          )}
        </Card>
      </motion.div>

      {historico.isError && <ErrorState titulo="Não foi possível carregar o histórico" descricao={getErrorMessage(historico.error)} aoTentarNovamente={() => void historico.refetch()} />}
      {historico.isLoading && companyId && <Card><Skeleton className="h-32 w-full" /></Card>}
      {historico.data && historico.data.length > 0 && (
        <Card className="sla-history-card" semPadding>
          <div className="border-b border-subtle p-4">
            <h2 className="text-lg font-semibold text-fg">Histórico</h2>
            <p className="mt-1 text-sm text-fg-muted">Versões anteriores e política atualmente vigente.</p>
          </div>
          <ScrollArea rotulo="Histórico das políticas de SLA">
            <table className="min-w-[42rem] w-full text-left text-sm">
              <caption className="sr-only">Versões da política de SLA desta empresa</caption>
              <thead className="bg-inset text-xs uppercase tracking-wide text-fg-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Desde</th>
                  <th className="px-4 py-3 font-medium">Crítica</th>
                  <th className="px-4 py-3 font-medium">Alta</th>
                  <th className="px-4 py-3 font-medium">Média</th>
                  <th className="px-4 py-3 font-medium">Baixa</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <motion.tbody variants={lista} initial={jaMostrouHistorico.current ? false : "inicial"} animate="visivel">
                {historico.data.map((p: SlaPolicy) => (
                  <motion.tr key={p.id} variants={item} data-active={p.isActive || undefined} className="sla-history-row border-t border-subtle text-fg-secondary">
                    <td className="px-4 py-3"><time dateTime={p.createdAt}>{new Date(p.createdAt).toLocaleDateString("pt-BR")}</time></td>
                    <td className="px-4 py-3 font-mono tabular-nums text-severity-critical-ink">{p.criticalDays}d</td>
                    <td className="px-4 py-3 font-mono tabular-nums text-severity-high-ink">{p.highDays}d</td>
                    <td className="px-4 py-3 font-mono tabular-nums text-severity-medium-ink">{p.mediumDays}d</td>
                    <td className="px-4 py-3 font-mono tabular-nums text-severity-low-ink">{p.lowDays}d</td>
                    <td className="px-4 py-3">{p.isActive ? <Badge tom="sucesso">vigente</Badge> : <Badge tom="neutro">substituída</Badge>}</td>
                  </motion.tr>
                ))}
              </motion.tbody>
            </table>
          </ScrollArea>
        </Card>
      )}
    </div>
  );
}

function PrazoPorSeveridade({ severidade, valor, erro, disabled, onChange }: {
  severidade: (typeof SEVERIDADES)[number];
  valor: string;
  erro?: string;
  disabled: boolean;
  onChange: (valor: string) => void;
}) {
  const { reduzido } = useMotion();
  const painel = useRef<HTMLDivElement>(null);
  const ultimoConfirmado = useRef(valor);

  const destacarEdicao = () => {
    const numero = Number(valor);
    if (reduzido || disabled || valor === ultimoConfirmado.current || !Number.isInteger(numero) || numero < SLA_DAYS_MIN || numero > SLA_DAYS_MAX) return;
    ultimoConfirmado.current = valor;
    if (painel.current) void animate(painel.current, { scale: [1, 1.015, 1] }, { duration: DURACAO.base, ease: EASE.out });
  };

  return (
    <div ref={painel} className={`sla-level sla-level--${severidade.tom} relative overflow-hidden rounded-container border border-subtle p-4`}>
      <span className="sla-level-clock" aria-hidden="true" />
      <Field rotulo={`${severidade.rotulo} (dias)`} dica={severidade.dica} erro={erro}>
        {(attrs) => (
          <Input
            {...attrs}
            className="sla-level-input font-mono font-semibold tabular-nums"
            type="number"
            inputMode="numeric"
            min={SLA_DAYS_MIN}
            max={SLA_DAYS_MAX}
            value={valor}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            onBlur={destacarEdicao}
          />
        )}
      </Field>
      <p className="mt-2 font-mono text-xs uppercase tracking-wide text-fg-muted">dias corridos</p>
    </div>
  );
}
