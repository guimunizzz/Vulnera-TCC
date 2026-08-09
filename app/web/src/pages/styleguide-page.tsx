/**
 * styleguide-page.tsx
 *
 * O QUE FAZ
 * Renderiza o design system inteiro numa página: paleta, escala tipográfica,
 * espaçamento, elevação, estados de componente e as cores de severidade nos
 * DOIS temas lado a lado.
 *
 * POR QUE EXISTE
 * Duas razões práticas, nenhuma decorativa:
 *   1. É a ferramenta de conferência. Um token quebrado aparece aqui antes de
 *      aparecer numa tela real, e um componente novo é validado aqui antes de
 *      entrar em produção.
 *   2. É evidência para a banca. "O sistema tem tokens" é afirmação; esta
 *      página é demonstração.
 *
 * ⚠️ SÓ EM DESENVOLVIMENTO. A rota é registrada no `App.tsx` sob
 * `import.meta.env.DEV` — em build de produção ela não existe.
 *
 * ⚠️ É a ÚNICA tela autorizada a tocar em token primitivo (`--iris-500` e
 * companhia), e só por `style={{}}` explícito. Em qualquer outro lugar isso
 * seria a violação da regra P1 dos tokens.
 *
 * QUEM USA
 * Desenvolvimento e apresentação.
 */

import { useState } from "react";
import { ThemeToggle } from "../design/theme-toggle";
import {
  Accordion,
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  Combobox,
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DropdownMenu,
  Drawer,
  DrawerBody,
  DrawerHeader,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Pagination,
  Popover,
  Progress,
  Radio,
  RadioGroup,
  Select,
  Separator,
  SeverityBadge,
  Skeleton,
  Slider,
  StatusBadge,
  Switch,
  Table,
  Tabs,
  Textarea,
  Tooltip,
  useToast,
} from "../components/ui";
import { NumeroAnimado } from "../motion/components";
import { cn } from "../lib/cn";

/* ==========================================================================
   Dados de demonstração
   ========================================================================== */

const RAMPAS = ["neutral", "iris", "red", "orange", "amber", "blue", "green"] as const;
const PASSOS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

const SEMANTICOS_FUNDO = [
  ["--color-bg-canvas", "Página"],
  ["--color-bg-surface", "Superfície"],
  ["--color-bg-raised", "Elevada"],
  ["--color-bg-overlay", "Overlay"],
  ["--color-bg-inset", "Poço"],
] as const;

const SEMANTICOS_TEXTO = [
  ["--color-text-primary", "Primário"],
  ["--color-text-secondary", "Secundário"],
  ["--color-text-muted", "Atenuado"],
] as const;

// ⚠️ Classes ESCRITAS POR EXTENSO, nunca `text-${passo}`. O Tailwind varre o
// código-fonte como texto: uma classe montada em tempo de execução não existe
// no CSS gerado. Vale para toda esta página.
const TIPOGRAFIA = [
  ["4xl", "text-4xl", "Postura de segurança"],
  ["3xl", "text-3xl", "Postura de segurança"],
  ["2xl", "text-2xl", "Postura de segurança"],
  ["xl", "text-xl", "Postura de segurança"],
  ["lg", "text-lg", "Postura de segurança"],
  ["base", "text-base", "Postura de segurança"],
  ["sm", "text-sm", "Postura de segurança — corpo e tabela"],
  ["xs", "text-xs", "MICRO-RÓTULO EM CAIXA ALTA"],
] as const;

const ELEVACOES = [
  ["raised", "shadow-raised"],
  ["overlay", "shadow-overlay"],
  ["modal", "shadow-modal"],
] as const;

const RAIOS = [
  ["control", "rounded-control"],
  ["container", "rounded-container"],
  ["overlay", "rounded-overlay"],
] as const;

const ESPACAMENTO = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24] as const;
const SEVERIDADES = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "NONE"] as const;

/* ==========================================================================
   Peças auxiliares
   ========================================================================== */

function Secao({ titulo, descricao, children }: { titulo: string; descricao?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold text-fg">{titulo}</h2>
        {descricao && <p className="max-w-prose text-sm text-fg-muted">{descricao}</p>}
      </div>
      {children}
    </section>
  );
}

/** Amostra dos dois temas lado a lado — o subtema vem do `data-theme`. */
function LadoALado({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {(["dark", "light"] as const).map((t) => (
        <div
          key={t}
          data-theme={t}
          className="flex flex-col gap-3 rounded-container border border-subtle bg-canvas p-4"
        >
          <p className="text-xs font-semibold uppercase text-fg-muted">Tema {t === "dark" ? "escuro" : "claro"}</p>
          {children}
        </div>
      ))}
    </div>
  );
}

/* ==========================================================================
   Página
   ========================================================================== */

export function StyleguidePage() {
  const [dialogAberto, setDialogAberto] = useState(false);
  const [drawerAberto, setDrawerAberto] = useState(false);
  const [marcado, setMarcado] = useState(true);
  const [ligado, setLigado] = useState(true);
  const [faixa, setFaixa] = useState(75);
  const [pagina, setPagina] = useState(3);
  const [selecionado, setSelecionado] = useState<string | null>("A01");
  const [radio, setRadio] = useState("PROD");
  const toast = useToast();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-16 px-6 py-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase text-accent-ink">Vulnera · Design System</p>
          <h1 className="text-3xl font-bold text-fg">Styleguide</h1>
          <p className="max-w-prose text-sm text-fg-muted">
            Instrumento, não painel de marketing. Fundo slate-azulado profundo, grotesca engenheirada com números
            tabulares, e um único acento violeta reservado à ação — porque, num produto de segurança, todo o resto do
            espectro já tem significado ocupado.
          </p>
        </div>
        <ThemeToggle />
      </header>

      {/* ---------------------------------------------------------------- */}
      <Secao
        titulo="Rampas primitivas"
        descricao="Onze passos por matiz, todos compartilhando a mesma espinha de lightness (o passo 500 tem L≈0.60 em qualquer matiz). É isso que faz um chip CRITICAL e um chip LOW pesarem igual na tela. Todos os 77 valores foram verificados dentro do gamut sRGB."
      >
        <div className="flex flex-col gap-3">
          {RAMPAS.map((rampa) => (
            <div key={rampa} className="flex items-center gap-3">
              <span className="w-16 shrink-0 font-mono text-xs text-fg-muted">{rampa}</span>
              <div className="flex flex-1 overflow-hidden rounded-control">
                {PASSOS.map((passo) => (
                  <div
                    key={passo}
                    title={`--${rampa}-${passo}`}
                    className="h-10 flex-1"
                    style={{ background: `oklch(var(--${rampa}-${passo}))` }}
                  />
                ))}
              </div>
            </div>
          ))}
          <div className="flex items-center gap-3">
            <span className="w-16 shrink-0" />
            <div className="flex flex-1">
              {PASSOS.map((p) => (
                <span key={p} className="flex-1 text-center font-mono text-xs text-fg-muted">
                  {p}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Secao>

      {/* ---------------------------------------------------------------- */}
      <Secao
        titulo="Semânticos, nos dois temas"
        descricao="Componente nunca usa primitivo — usa estes. É a indireção que faz o tema trocar sem tocar em nenhum componente."
      >
        <LadoALado>
          <div className="grid grid-cols-5 gap-2">
            {SEMANTICOS_FUNDO.map(([token, nome]) => (
              <div key={token} className="flex flex-col gap-1">
                <div
                  className="h-12 rounded-control border border-subtle"
                  style={{ background: `oklch(var(${token}))` }}
                />
                <span className="text-xs text-fg-muted">{nome}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1 rounded-control bg-surface p-3">
            {SEMANTICOS_TEXTO.map(([token, nome]) => (
              <p key={token} className="text-sm" style={{ color: `oklch(var(${token}))` }}>
                {nome} — a postura de segurança melhorou 12% no período
              </p>
            ))}
            <p className="text-sm text-accent-ink">Ação — ver todos os findings críticos</p>
          </div>
        </LadoALado>
      </Secao>

      {/* ---------------------------------------------------------------- */}
      <Secao
        titulo="Severidade nos dois temas"
        descricao="O ponto mais difícil da fase: as cores da Fase 3 foram calibradas contra #0a0a0a e reprovavam em fundo claro. No tema claro o preenchimento desce ao passo 600 e o texto ao 700/800. Todos os pares medidos por scripts/check-contrast.mjs — o pior caso é 6,44:1, contra os 4,5:1 exigidos."
      >
        <LadoALado>
          <div className="flex flex-wrap gap-2">
            {SEVERIDADES.map((s) => (
              <SeverityBadge key={s} severidade={s} cvss={s === "CRITICAL" ? 9.8 : s === "HIGH" ? 7.5 : undefined} />
            ))}
          </div>
          <div className="flex gap-1">
            {SEVERIDADES.map((s) => (
              <div
                key={s}
                className="h-8 flex-1 rounded-control"
                style={{ background: `oklch(var(--color-severity-${s.toLowerCase()}))` }}
                title={`preenchimento de gráfico — ${s}`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {["OPEN", "IN_PROGRESS", "FIXED", "CLOSED"].map((s) => (
              <StatusBadge key={s} status={s} />
            ))}
          </div>
        </LadoALado>
      </Secao>

      {/* ---------------------------------------------------------------- */}
      <Secao
        titulo="Tipografia"
        descricao="Archivo para interface, JetBrains Mono para dado. Escala modular de razão 1.200 ancorada em 14px. O passo xs (11,7px) é reservado a micro-rótulo em caixa alta — corpo e tabela param no sm."
      >
        <div className="flex flex-col gap-3 rounded-container border border-subtle bg-surface p-6">
          {TIPOGRAFIA.map(([passo, classe, texto]) => (
            <div key={passo} className="flex items-baseline gap-4">
              <span className="w-12 shrink-0 font-mono text-xs text-fg-muted">{passo}</span>
              <span className={cn(classe, "text-fg")}>{texto}</span>
            </div>
          ))}
          <Separator className="my-2" />
          <div className="flex items-baseline gap-4">
            <span className="w-12 shrink-0 font-mono text-xs text-fg-muted">mono</span>
            <span className="font-mono text-sm text-fg" data-numeric>
              CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H
            </span>
          </div>
          <p className="max-w-prose text-xs text-fg-muted">
            A mono não é enfeite: num vetor CVSS e num id <code>cuid()</code>, <code>0</code>/<code>O</code> e{" "}
            <code>1</code>/<code>l</code>/<code>I</code> precisam ser inconfundíveis.
          </p>
        </div>
      </Secao>

      {/* ---------------------------------------------------------------- */}
      <Secao titulo="Espaçamento" descricao="Escala de 4px, sem meio-passo. Os passos 0.5/1.5/2.5/3.5 do Tailwind foram removidos da config.">
        <div className="flex flex-col gap-2 rounded-container border border-subtle bg-surface p-6">
          {ESPACAMENTO.map((n) => (
            <div key={n} className="flex items-center gap-4">
              <span className="w-12 shrink-0 font-mono text-xs text-fg-muted">{n}</span>
              <div className="h-4 rounded-control bg-accent" style={{ width: `var(--space-${n})` }} />
              <span className="font-mono text-xs text-fg-muted">{n * 4}px</span>
            </div>
          ))}
        </div>
      </Secao>

      {/* ---------------------------------------------------------------- */}
      <Secao
        titulo="Raio e elevação"
        descricao="Nomeados por intenção, nunca por tamanho: 'é controle? é contêiner? é overlay?' se responde uma vez. No tema escuro a elevação é lightness; no claro é sombra — são meios diferentes porque o olho lê profundidade de formas diferentes em cada fundo."
      >
        <LadoALado>
          <div className="flex flex-wrap gap-4">
            {ELEVACOES.map(([nome, classe]) => (
              <div key={nome} className={cn("flex h-20 w-32 items-center justify-center rounded-container bg-surface", classe)}>
                <span className="font-mono text-xs text-fg-muted">{nome}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-4">
            {RAIOS.map(([nome, classe]) => (
              <div key={nome} className={cn("flex h-16 w-28 items-center justify-center border border-strong bg-raised", classe)}>
                <span className="font-mono text-xs text-fg-muted">{nome}</span>
              </div>
            ))}
          </div>
        </LadoALado>
      </Secao>

      {/* ---------------------------------------------------------------- */}
      <Secao titulo="Botões — todos os estados" descricao="Padrão, hover, ativo, foco visível, desabilitado e carregando. O foco usa :focus-visible: quem clica com mouse não é punido com um anel.">
        <div className="flex flex-col gap-4 rounded-container border border-subtle bg-surface p-6">
          <div className="flex flex-wrap items-center gap-3">
            {(["primario", "secundario", "fantasma", "sutil", "destrutivo"] as const).map((v) => (
              <Button key={v} variant={v}>
                {v}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">pequeno</Button>
            <Button size="md">médio</Button>
            <Button size="lg">grande</Button>
            <Button disabled>desabilitado</Button>
            <Button carregando>carregando</Button>
            <Button rotulo="Excluir finding" variant="destrutivo" size="sm">
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                <path d="M6 2h4v1h3v1.5H3V3h3V2Zm-2 4h8l-.6 8H4.6L4 6Z" />
              </svg>
            </Button>
          </div>
        </div>
      </Secao>

      {/* ---------------------------------------------------------------- */}
      <Secao titulo="Formulário" descricao="Rótulo, dica e erro amarrados por useId. O erro é role=alert, tem ícone e texto — cor nunca sozinha.">
        <div className="grid gap-6 rounded-container border border-subtle bg-surface p-6 md:grid-cols-2">
          <Field rotulo="Título do finding" dica="Como aparece no relatório executivo." obrigatorio>
            {(attrs) => <Input {...attrs} placeholder="SQL Injection em /search" />}
          </Field>

          <Field rotulo="Vetor CVSS" erro="Vetor inválido: métrica AV duplicada.">
            {(attrs) => <Input {...attrs} mono defaultValue="CVSS:3.1/AV:N/AV:L/AC:L" />}
          </Field>

          <Field rotulo="Categoria OWASP" dica="Busca por código ou por nome.">
            {(attrs) => (
              <Combobox
                {...attrs}
                opcoes={[
                  { valor: "A01", rotulo: "A01 Broken Access Control", sufixo: "12" },
                  { valor: "A02", rotulo: "A02 Cryptographic Failures", sufixo: "4" },
                  { valor: "A03", rotulo: "A03 Injection", sufixo: "8" },
                ]}
                valor={selecionado}
                aoMudar={setSelecionado}
              />
            )}
          </Field>

          <Field rotulo="Ambiente">
            {(attrs) => (
              <Select
                {...attrs}
                opcoes={[
                  { valor: "PROD", rotulo: "Produção" },
                  { valor: "HOMOL", rotulo: "Homologação" },
                  { valor: "DEV", rotulo: "Desenvolvimento" },
                ]}
                valor={radio}
                aoMudar={setRadio}
              />
            )}
          </Field>

          <Field rotulo="Justificativa do override" dica="Mínimo de 20 caracteres." className="md:col-span-2">
            {(attrs) => <Textarea {...attrs} maxLength={500} mostrarContador rows={3} />}
          </Field>

          <div className="flex flex-col gap-2">
            <Checkbox rotulo="Somente findings abertos" checked={marcado} onChange={(e) => setMarcado(e.target.checked)} />
            <Checkbox rotulo="Selecionar tudo" indeterminado />
            <Checkbox rotulo="Opção desabilitada" disabled />
            <RadioGroup rotulo="Granularidade">
              <Radio name="gran" rotulo="Dia" defaultChecked />
              <Radio name="gran" rotulo="Semana" />
              <Radio name="gran" rotulo="Mês" />
            </RadioGroup>
          </div>

          <div className="flex flex-col gap-4">
            <Switch
              rotulo="Comparar com período anterior"
              descricao="Liga os deltas em todos os KPIs."
              checked={ligado}
              onCheckedChange={setLigado}
            />
            <div>
              <p className="mb-1 text-sm font-medium text-fg">Nota CVSS mínima</p>
              <Slider
                value={faixa}
                onChange={(e) => setFaixa(Number(e.target.value))}
                min={0}
                max={100}
                mostrarValor
                textoDoValor={`${(faixa / 10).toFixed(1)} de 10`}
              />
            </div>
            <Progress valor={68} rotulo="Taxa de remediação" textoDoValor="68% dos findings remediados" mostrarValor tom="automatico" />
          </div>
        </div>
      </Secao>

      {/* ---------------------------------------------------------------- */}
      <Secao titulo="Overlays" descricao="Foco entra, é preso, e volta ao gatilho ao fechar. Escape fecha. Scroll do body travado no modal. O resto da árvore vira inert.">
        <div className="flex flex-wrap gap-3 rounded-container border border-subtle bg-surface p-6">
          <Button onClick={() => setDialogAberto(true)}>Abrir Dialog</Button>
          <Button variant="secundario" onClick={() => setDrawerAberto(true)}>
            Abrir Drawer
          </Button>

          <Popover gatilho={<Button variant="secundario">Abrir Popover</Button>}>
            <div className="flex w-64 flex-col gap-3">
              <p className="text-sm font-medium text-fg">Período</p>
              <div className="flex flex-wrap gap-2">
                {["7d", "30d", "90d", "Ano"].map((p) => (
                  <Button key={p} size="sm" variant="fantasma">
                    {p}
                  </Button>
                ))}
              </div>
            </div>
          </Popover>

          <DropdownMenu
            rotulo="Ações do finding"
            gatilho={<Button variant="secundario">Abrir menu</Button>}
            itens={[
              { id: "editar", rotulo: "Editar", aoEscolher: () => toast.sucesso("Editar") },
              { id: "duplicar", rotulo: "Duplicar", atalho: "Ctrl+D", aoEscolher: () => toast.sucesso("Duplicar") },
              { id: "arquivar", rotulo: "Arquivar", desabilitado: true, aoEscolher: () => {} },
              { id: "excluir", rotulo: "Excluir", destrutivo: true, aoEscolher: () => toast.erro("Excluir") },
            ]}
          />

          <Tooltip conteudo="Mean Time To Remediate — tempo mediano entre a criação do finding e a primeira transição para FIXED.">
            <Button variant="fantasma">MTTR (aponte aqui)</Button>
          </Tooltip>

          <Button variant="secundario" onClick={() => toast.sucesso("Relatório gerado", "Executivo · 4 páginas")}>
            Toast de sucesso
          </Button>
          <Button variant="secundario" onClick={() => toast.erro("Falha ao salvar", "O vetor CVSS é inválido.")}>
            Toast de erro
          </Button>
        </div>

        <Dialog aberto={dialogAberto} aoFechar={() => setDialogAberto(false)}>
          <DialogTitle>Excluir finding?</DialogTitle>
          <DialogDescription>
            Esta ação não pode ser desfeita. As evidências anexadas também serão removidas.
          </DialogDescription>
          <DialogFooter>
            {/* `data-autofocus` no botão SEGURO: num diálogo destrutivo, o foco
                não deve nascer sobre o botão que apaga. */}
            <Button variant="secundario" data-autofocus onClick={() => setDialogAberto(false)}>
              Cancelar
            </Button>
            <Button variant="destrutivo" onClick={() => setDialogAberto(false)}>
              Excluir
            </Button>
          </DialogFooter>
        </Dialog>

        <Drawer aberto={drawerAberto} aoFechar={() => setDrawerAberto(false)}>
          <DrawerHeader>Filtros avançados</DrawerHeader>
          <DrawerBody>
            <p className="text-sm text-fg-muted">O drawer desliza porque o deslocamento responde &quot;de onde isto veio?&quot;.</p>
          </DrawerBody>
        </Drawer>
      </Secao>

      {/* ---------------------------------------------------------------- */}
      <Secao titulo="Dados" descricao="Tabela com ordenação e coluna fixa, abas, acordeão, paginação e badges.">
        <Card titulo="Findings" descricao="Ordenável por severidade e por CVSS.">
          <Table
            legenda="Findings da aplicação de exemplo"
            chaveDaLinha={(l) => l.id}
            rotuloDaLinha={(l) => l.titulo}
            primeiraColunaFixa
            colunas={[
              { id: "titulo", cabecalho: "Finding", celula: (l) => l.titulo, ordenarPor: (l) => l.titulo },
              {
                id: "sev",
                cabecalho: "Severidade",
                celula: (l) => <SeverityBadge severidade={l.severidade} />,
                ordenarPor: (l) => l.cvss,
              },
              { id: "cvss", cabecalho: "CVSS", celula: (l) => l.cvss.toFixed(1), alinhamento: "direita", ordenarPor: (l) => l.cvss },
              { id: "idade", cabecalho: "Idade", celula: (l) => `${l.idade}d`, alinhamento: "direita", ordenarPor: (l) => l.idade, ocultarEmTelaEstreita: true },
            ]}
            linhas={[
              { id: "1", titulo: "SQL Injection em /search", severidade: "CRITICAL", cvss: 9.8, idade: 41 },
              { id: "2", titulo: "Falta de rate limiting no login", severidade: "HIGH", cvss: 7.5, idade: 12 },
              { id: "3", titulo: "Cookie sem flag Secure", severidade: "MEDIUM", cvss: 5.3, idade: 88 },
              { id: "4", titulo: "Versão do servidor exposta", severidade: "LOW", cvss: 3.1, idade: 4 },
            ]}
          />
        </Card>

        <Tabs
          abas={[
            { id: "postura", rotulo: "Postura atual", contagem: 4, conteudo: <p className="text-sm text-fg-muted">Conteúdo da aba.</p> },
            { id: "evolucao", rotulo: "Evolução", conteudo: <p className="text-sm text-fg-muted">Conteúdo da aba.</p> },
            { id: "insights", rotulo: "Insights", contagem: 3, conteudo: <p className="text-sm text-fg-muted">Conteúdo da aba.</p> },
          ]}
        />

        <Card titulo="Acordeão">
          <Accordion
            abertasPorPadrao={["evidencias"]}
            secoes={[
              { id: "evidencias", titulo: "Evidências", meta: "2 arquivos", conteudo: <p>Capturas e logs anexados ao finding.</p> },
              { id: "comentarios", titulo: "Comentários", meta: "5", conteudo: <p>Thread de discussão.</p> },
              { id: "auditoria", titulo: "Trilha de auditoria", conteudo: <p>Histórico de mudanças de estado e de severidade.</p> },
            ]}
          />
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <Badge tom="acento">acento</Badge>
          <Badge tom="sucesso">sucesso</Badge>
          <Badge tom="atencao">atenção</Badge>
          <Badge tom="perigo">perigo</Badge>
          <Badge tom="neutro">neutro</Badge>
          <Avatar nome="Rafael Guilherme" />
          <Avatar nome="TechNova Solutions" tamanho="lg" />
        </div>

        <Pagination pagina={pagina} totalPaginas={12} aoMudar={setPagina} />
      </Secao>

      {/* ---------------------------------------------------------------- */}
      <Secao titulo="Estados de carregamento, vazio e erro" descricao="O esqueleto tem a FORMA do conteúdo final. Estado vazio explica por que está vazio e o que fazer. Estado de erro oferece recuperação.">
        <div className="grid gap-4 md:grid-cols-3">
          <Card titulo="Carregando">
            <div className="flex flex-col gap-3">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </Card>
          <EmptyState
            compacto
            titulo="Nenhum finding neste período"
            descricao="O filtro de período está em 7 dias. Amplie para 90 dias para ver o histórico."
            acao={<Button size="sm" variant="secundario">Ampliar para 90 dias</Button>}
          />
          <ErrorState aoTentarNovamente={() => toast.sucesso("Tentando novamente")} />
        </div>
      </Secao>

      {/* ---------------------------------------------------------------- */}
      <Secao titulo="Avisos" descricao="Alert fica na página; toast some. Se a pessoa precisa reler ou agir, é Alert.">
        <div className="flex flex-col gap-3">
          <Alert tom="info">A assinatura da TechNova permite até 5 aplicações. Você está usando 3.</Alert>
          <Alert tom="sucesso" titulo="Relatório gerado">O PDF executivo foi baixado.</Alert>
          <Alert tom="atencao" titulo="Limite do plano próximo">Restam 2 aplicações no plano PRO.</Alert>
          <Alert tom="perigo" titulo="Não foi possível salvar">O vetor CVSS informado tem uma métrica duplicada.</Alert>
        </div>
      </Secao>

      {/* ---------------------------------------------------------------- */}
      <Secao titulo="Movimento" descricao="Contador de KPI com spring e tabular-nums. Com prefers-reduced-motion o número simplesmente troca — contar É movimento.">
        <div className="flex flex-wrap gap-4">
          <Card className="min-w-campo">
            <p className="text-xs uppercase text-fg-muted">Findings abertos</p>
            <p className="text-3xl font-bold text-fg">
              <NumeroAnimado valor={127} />
            </p>
          </Card>
          <Card className="min-w-campo">
            <p className="text-xs uppercase text-fg-muted">Risk score</p>
            <p className="text-3xl font-bold text-severity-critical-ink">
              <NumeroAnimado valor={412.7} casas={1} />
            </p>
          </Card>
        </div>
      </Secao>
    </div>
  );
}
