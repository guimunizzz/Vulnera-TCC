import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowUpRight, Check, ChevronRight, RotateCcw } from "lucide-react";
import { Reveal, GlitchHeading } from "../ui";
import "./demo.css";

const NAV_ITEMS = ["Dashboard", "Aplicações", "Projetos", "Maturidade", "Configurações"] as const;
const TABS = ["Postura atual", "Evolução", "Insights", "Comparativo"] as const;
const FINDINGS = [
  { severity: "CRÍTICA", color: "var(--vx-danger)", count: 3, title: "SQL Injection em /api/v1/orders", app: "API de pedidos", description: "Parâmetros da consulta permitem alterar a instrução SQL enviada ao banco.", fix: "Utilizar consultas parametrizadas e validar os parâmetros de entrada." },
  { severity: "ALTA", color: "var(--vx-orange)", count: 5, title: "JWT sem expiração no painel admin", app: "Painel administrativo", description: "Tokens de acesso permanecem válidos por tempo indeterminado.", fix: "Definir expiração curta e implementar a renovação segura dos tokens." },
  { severity: "MÉDIA", color: "var(--vx-yellow)", count: 8, title: "CORS permissivo em api.technova.com", app: "API de pedidos", description: "A política de origens permite requisições de domínios não confiáveis.", fix: "Restringir as origens permitidas aos domínios utilizados pela aplicação." },
  { severity: "BAIXA", color: "var(--vx-accent-soft)", count: 12, title: "Header X-Frame-Options ausente", app: "Portal do cliente", description: "O portal pode ser incorporado em páginas de terceiros.", fix: "Configurar a política frame-ancestors no Content-Security-Policy." },
];
const APPS = [
  { name: "API de pedidos", type: "API REST", stack: "Node.js · PostgreSQL", owner: "Equipe de integrações", findings: 11 },
  { name: "Painel administrativo", type: "Aplicação web", stack: "React · Node.js", owner: "Equipe de operações", findings: 9 },
  { name: "Portal do cliente", type: "Aplicação web", stack: "React · Java", owner: "Equipe de experiência", findings: 8 },
];
const PROJECTS = [
  { name: "Pentest da API", app: "API de pedidos", status: "Em andamento", progress: 68, steps: ["Escopo definido", "Testes em execução", "Relatório pendente"] },
  { name: "Revisão de acesso", app: "Painel administrativo", status: "Em revisão", progress: 90, steps: ["Escopo definido", "Testes concluídos", "Relatório em revisão"] },
  { name: "Assessment do portal", app: "Portal do cliente", status: "Concluído", progress: 100, steps: ["Escopo definido", "Testes concluídos", "Relatório entregue"] },
];
const DOMAINS = [
  { name: "Governança", score: 4.2, description: "Políticas documentadas, responsabilidades definidas e revisão periódica dos riscos." },
  { name: "Desenvolvimento seguro", score: 3.4, description: "Revisão de código e análise de dependências adotadas. Próximo passo: ampliar testes de segurança no pipeline." },
  { name: "Gestão de vulnerabilidades", score: 3.8, description: "Triagem e acompanhamento de findings ativos. Próximo passo: automatizar a validação das correções." },
];

function Progress({ value, label }: { value: number; label: string }) {
  const reduced = useReducedMotion();
  return <div className="vx-demo-progress" role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
    <motion.span initial={{ scaleX: reduced ? value / 100 : 0 }} animate={{ scaleX: value / 100 }} transition={{ duration: reduced ? 0 : 0.55, ease: "easeOut" }} />
  </div>;
}

export default function Demo() {
  const reduced = useReducedMotion();
  const [page, setPage] = useState<(typeof NAV_ITEMS)[number]>("Dashboard");
  const [tab, setTab] = useState<(typeof TABS)[number]>("Postura atual");
  const [finding, setFinding] = useState<number | null>(null);
  const [resolved, setResolved] = useState<number[]>([]);
  const [severity, setSeverity] = useState<number | null>(null);
  const [app, setApp] = useState(0);
  const [project, setProject] = useState(0);
  const [domain, setDomain] = useState(0);
  const [notifications, setNotifications] = useState(true);
  const [compact, setCompact] = useState(false);
  const [notice, setNotice] = useState("");
  // Move focus only when the action removes the currently focused control.
  const viewRef = useRef<HTMLDivElement | null>(null);
  const restoreFocus = useRef(false);
  const attachView = useCallback((node: HTMLDivElement | null) => {
    viewRef.current = node;
    if (node && restoreFocus.current) {
      restoreFocus.current = false;
      node.focus({ preventScroll: true });
    }
    if (node?.parentElement) node.parentElement.scrollTop = 0;
  }, []);
  const open = 28 - resolved.length;
  const critical = 3 - Number(resolved.includes(0));
  const selectedFinding = finding === null ? null : FINDINGS[finding];

  function prepareViewChange() {
    restoreFocus.current = !!viewRef.current?.contains(document.activeElement);
  }

  function openFinding(id: number | null) {
    prepareViewChange();
    setFinding(id);
  }

  function navigate(next: (typeof NAV_ITEMS)[number]) {
    prepareViewChange();
    setPage(next);
    setFinding(null);
    setNotice("");
  }

  function reset() {
    setPage("Dashboard"); setTab("Postura atual"); setFinding(null); setResolved([]);
    setSeverity(null); setApp(0); setProject(0); setDomain(0); setNotifications(true); setCompact(false);
    setNotice("Demonstração reiniciada.");
  }

  return (
    <section id="demo" className="vx-grid-bg flex min-h-screen items-center bg-[var(--vx-bg)] px-6 py-24">
      <div className="mx-auto w-full max-w-4xl text-center">
        <Reveal>
          <p className="font-mono text-sm tracking-widest text-[var(--vx-accent)]">{"// VEJA EM AÇÃO"}</p>
          <GlitchHeading className="mt-4 text-3xl font-bold text-[var(--vx-text)] md:text-4xl">
            A plataforma da TechNova Solutions, de perto.
          </GlitchHeading>
        </Reveal>
        <Reveal delay={150}>
          <div className="vx-demo-tabs" role="group" aria-label="Visualizações do dashboard">
            {TABS.map((item) => <button type="button" key={item} aria-pressed={page === "Dashboard" && tab === item && finding === null}
              onClick={() => { navigate("Dashboard"); setTab(item); }}>
              {item}
            </button>)}
          </div>
        </Reveal>
        <Reveal delay={200}>
          <div className={`vx-demo ${compact ? "vx-demo--compact" : ""}`} role="region" aria-label="Preview interativo da plataforma">
            <header className="vx-demo-header">
              <span className="vx-demo-brand">VULNERA</span>
              <span className="vx-demo-company">TechNova Solutions <span>analista@vulnera.sec</span></span>
              <span className="vx-demo-live"><span /> DEMO</span>
            </header>
            <div className="vx-demo-body">
              <nav className="vx-demo-nav" aria-label="Navegação do preview">
                {NAV_ITEMS.map((item) => <button type="button" key={item} aria-current={page === item ? "page" : undefined} onClick={() => navigate(item)}>
                  {page === item && <motion.span className="vx-demo-nav-active" layoutId="demo-nav-active" transition={{ duration: reduced ? 0 : 0.25 }} />}
                  <span>{item}</span><ChevronRight size={12} aria-hidden="true" />
                </button>)}
                <span className="vx-demo-nav-hint">Explore a plataforma.<br />Tudo aqui é interativo.</span>
              </nav>
              <div className="vx-demo-content">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div ref={attachView} tabIndex={-1} className="vx-demo-view" role="group" aria-label={`${page} do preview`} key={`${page}-${tab}-${finding ?? "overview"}`} initial={{ opacity: 0, y: reduced ? 0 : 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduced ? 0 : -4 }} transition={{ duration: reduced ? 0 : 0.16 }}>
                    {page === "Dashboard" && selectedFinding && finding !== null ? <>
                      <button type="button" className="vx-demo-back" onClick={() => openFinding(null)}><ArrowLeft size={13} /> Voltar ao dashboard</button>
                      <div className="vx-demo-detail">
                        <span className="vx-demo-badge" style={{ background: selectedFinding.color }}>{selectedFinding.severity}</span>
                        <h3>{selectedFinding.title}</h3><p>{selectedFinding.app}</p>
                        <div className="vx-demo-divider" /><h4>O que foi encontrado</h4><p>{selectedFinding.description}</p>
                        <h4>Correção recomendada</h4><p>{selectedFinding.fix}</p>
                        <button type="button" className="vx-demo-action" aria-pressed={resolved.includes(finding)} onClick={() => {
                          const alreadyResolved = resolved.includes(finding);
                          setResolved((current) => alreadyResolved ? current.filter((id) => id !== finding) : [...current, finding]);
                          setNotice(alreadyResolved ? "Finding reaberto no preview." : "Correção simulada. Os indicadores do dashboard foram atualizados.");
                        }}>{resolved.includes(finding) ? <><RotateCcw size={13} /> Reabrir finding</> : <><Check size={13} /> Simular correção</>}</button>
                        <span className="vx-demo-caption">{resolved.includes(finding) ? "Status: corrigido nesta demonstração" : "Status: aberto · aguardando correção"}</span>
                      </div>
                    </> : page === "Dashboard" ? <>
                      <div className="vx-demo-kpis">
                        {[{ label: "Findings abertos", value: open }, { label: "Críticos", value: critical }, { label: "Aplicações", value: 12 }].map((kpi, index) => <button type="button" key={kpi.label} aria-label={`${kpi.value} ${kpi.label}`} className="vx-demo-kpi" onClick={() => {
                          if (index === 2) navigate("Aplicações");
                          else { setTab("Postura atual"); setSeverity(index === 1 ? 0 : null); }
                        }}><motion.strong key={kpi.value} initial={{ opacity: 0.4, y: reduced ? 0 : 4 }} animate={{ opacity: 1, y: 0 }}>{kpi.value}</motion.strong><span>{kpi.label}</span><ArrowUpRight size={12} aria-hidden="true" /></button>)}
                      </div>
                      {tab === "Postura atual" && <>
                        <div className="vx-demo-chart" role="group" aria-label="Filtrar findings por severidade">
                          {FINDINGS.map((item, index) => <button type="button" key={item.severity} aria-label={`Filtrar severidade ${item.severity}`} aria-pressed={severity === index} onClick={() => setSeverity(severity === index ? null : index)} style={{ opacity: severity === null || severity === index ? 1 : 0.35 }}>
                            <span className="vx-demo-bars" aria-hidden="true">{Array.from({ length: item.count - Number(resolved.includes(index)) }, (_, i) => <motion.span key={i} style={{ background: item.color, height: `${35 + ((i * 17 + index * 13) % 65)}%` }} initial={{ scaleY: reduced ? 1 : 0 }} animate={{ scaleY: 1 }} transition={{ duration: reduced ? 0 : 0.5, delay: reduced ? 0 : i * 0.018 }} />)}</span>
                            <span>{item.count - Number(resolved.includes(index))} {item.severity.toLowerCase()}</span>
                          </button>)}
                        </div>
                        <div className="vx-demo-list-heading"><span>Findings em destaque</span>{severity !== null && <button type="button" onClick={() => setSeverity(null)}>Limpar filtro</button>}</div>
                        <div className="vx-demo-list">{FINDINGS.map((item, index) => (severity === null || severity === index) && <button type="button" key={item.title} aria-label={`${resolved.includes(index) ? "CORRIGIDA" : item.severity} ${item.title}`} className="vx-demo-row" onClick={() => openFinding(index)}>
                          <span className="vx-demo-badge" style={{ background: resolved.includes(index) ? "var(--vx-success)" : item.color }}>{resolved.includes(index) ? "CORRIGIDA" : item.severity}</span>
                          <span className="vx-demo-row-title">{item.title}</span><ChevronRight size={12} aria-hidden="true" />
                        </button>)}</div>
                      </>}
                      {tab === "Evolução" && <div className="vx-demo-detail"><h3>Menos exposição, a cada ciclo.</h3><p>Findings abertos nas últimas seis avaliações.</p>
                        <div className="vx-demo-trend">{[52, 46, 41, 35, 31, open].map((value, index) => <div key={index}><span>{value}</span><motion.div initial={{ scaleY: reduced ? 1 : 0 }} animate={{ scaleY: 1 }} style={{ height: `${value * 1.6}px` }} transition={{ duration: reduced ? 0 : 0.5, delay: reduced ? 0 : index * 0.05 }} /><span>Ciclo {index + 1}</span></div>)}</div>
                        <span className="vx-demo-caption">{Math.round((1 - open / 52) * 100)}% menos findings em relação ao primeiro ciclo.</span>
                      </div>}
                      {tab === "Insights" && <div className="vx-demo-detail"><h3>Onde agir primeiro</h3><p>Prioridades sugeridas para este cenário de demonstração.</p>
                        {FINDINGS.slice(0, 2).map((item, index) => <button type="button" key={item.title} className="vx-demo-row vx-demo-insight" onClick={() => openFinding(index)}><span><strong>{resolved.includes(index) ? "Correção simulada" : index === 0 ? "Prioridade imediata" : "Revisar autenticação"}</strong><span>{item.title}</span></span><ArrowUpRight size={15} /></button>)}
                      </div>}
                      {tab === "Comparativo" && <div className="vx-demo-detail"><h3>Comparativo de aplicações</h3><p>Distribuição dos {open} findings abertos entre as aplicações em destaque.</p>
                        {APPS.map((item, index) => { const count = item.findings - resolved.filter((id) => FINDINGS[id].app === item.name).length; return <button type="button" key={item.name} aria-label={`${item.name} ${count} findings`} className="vx-demo-comparison" onClick={() => { setApp(index); navigate("Aplicações"); }}><span>{item.name}<strong>{count} findings <ChevronRight size={12} /></strong></span><Progress value={Math.round(count / 12 * 100)} label={`Exposição de ${item.name}`} /></button>; })}
                      </div>}
                    </> : page === "Aplicações" ? <>
                      <div className="vx-demo-title"><h3>Aplicações</h3><span>3 das 12 aplicações</span></div>
                      <p className="vx-demo-subtitle">Selecione uma aplicação para explorar sua superfície.</p>
                      <div className="vx-demo-list">{APPS.map((item, index) => <button type="button" key={item.name} aria-label={`${item.name} ${item.type}`} className="vx-demo-row" aria-pressed={app === index} onClick={() => setApp(index)}><span className="vx-demo-row-title">{item.name}</span><span>{item.type}</span><ChevronRight size={12} /></button>)}</div>
                      <div className="vx-demo-detail" key={app}><h3>{APPS[app].name}</h3><p>{APPS[app].stack}</p><h4>Responsável</h4><p>{APPS[app].owner}</p><button type="button" className="vx-demo-action" onClick={() => { navigate("Dashboard"); setFinding(app === 1 ? 1 : app === 2 ? 3 : 0); }}>Explorar finding <ArrowUpRight size={13} /></button></div>
                    </> : page === "Projetos" ? <>
                      <div className="vx-demo-title"><h3>Projetos de segurança</h3><span>3 projetos</span></div>
                      <p className="vx-demo-subtitle">Acompanhe o andamento de cada avaliação.</p>
                      <div className="vx-demo-list">{PROJECTS.map((item, index) => <button type="button" key={item.name} aria-label={`${item.name} ${item.status}`} className="vx-demo-row" aria-pressed={project === index} onClick={() => setProject(index)}><span className="vx-demo-row-title">{item.name}</span><span>{item.status}</span><ChevronRight size={12} /></button>)}</div>
                      <div className="vx-demo-detail" key={project}><h3>{PROJECTS[project].name}</h3><p>{PROJECTS[project].app} · {PROJECTS[project].progress}% concluído</p><Progress value={PROJECTS[project].progress} label="Progresso do projeto" /><ol className="vx-demo-steps">{PROJECTS[project].steps.map((step) => <li key={step}>{step}</li>)}</ol></div>
                    </> : page === "Maturidade" ? <>
                      <div className="vx-demo-title"><h3>Maturidade de segurança</h3><span>Escala de 1 a 5</span></div>
                      <p className="vx-demo-subtitle">Explore os resultados por domínio avaliado.</p>
                      <div className="vx-demo-list">{DOMAINS.map((item, index) => <button type="button" key={item.name} className="vx-demo-row" aria-pressed={domain === index} onClick={() => setDomain(index)}><span className="vx-demo-row-title">{item.name}</span><strong>{item.score.toFixed(1)} / 5</strong><ChevronRight size={12} /></button>)}</div>
                      <div className="vx-demo-detail" key={domain}><h3>{DOMAINS[domain].name}</h3><Progress value={DOMAINS[domain].score * 20} label="Maturidade do domínio" /><p>{DOMAINS[domain].description}</p></div>
                    </> : <>
                      <div className="vx-demo-title"><h3>Preferências do preview</h3></div><p className="vx-demo-subtitle">Experimente os controles. Nada é salvo na sua conta.</p>
                      <div className="vx-demo-detail vx-demo-settings">
                        <label><span><strong>Notificações de segurança</strong><span>{notifications ? "Alertas ativados nesta simulação" : "Alertas pausados nesta simulação"}</span></span><input type="checkbox" role="switch" checked={notifications} onChange={(event) => setNotifications(event.target.checked)} /></label>
                        <label><span><strong>Visualização compacta</strong><span>Reduz o espaçamento das listas do preview</span></span><input type="checkbox" role="switch" checked={compact} onChange={(event) => setCompact(event.target.checked)} /></label>
                      </div>
                    </>}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
            <footer className="vx-demo-footer"><span><span className="vx-demo-footer-dot" /> Preview interativo · dados fictícios</span><button type="button" onClick={reset}><RotateCcw size={12} /> Reiniciar</button></footer>
          </div>
          <p className="vx-demo-notice" role="status">{notice || "Clique nos menus, indicadores e findings para explorar."}</p>
        </Reveal>
      </div>
    </section>
  );
}
