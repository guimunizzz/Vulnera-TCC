/**
 * Cria imagens de antes/depois para avaliar a proposta visual da área web.
 * Captura o aplicativo atual com fixtures isoladas e renderiza estudos em HTML,
 * sem alterar o produto, consultar a API real ou gravar no banco.
 * Consumidores: Rafael e a revisão visual de Dashboard, Aplicações e Projetos.
 */
import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const out = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(out, '../..');
const origin = 'http://127.0.0.1:5173';
const font = (await readFile(path.join(root, 'node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2'))).toString('base64');
const date = '2026-10-16T12:00:00.000Z';
const user = { id: 'preview-admin', name: 'Vulnera Admin', email: 'preview@vulnera.demo', role: 'ADMIN', companyId: null, createdAt: date };
const company = { id: 'company-demo', name: 'TechNova Solutions', cnpj: null, planId: 'plan-demo', createdAt: date, updatedAt: date };
const applications = [
  ['Portal do Cliente', 'https://portal.technova.demo', 'CRITICAL', 'PROD', true, 'CONFIDENTIAL'],
  ['API B2B Integração', 'https://api.technova.demo', 'HIGH', 'PROD', true, 'RESTRICTED'],
  ['App Mobile TechNova', 'https://mobile.technova.demo', 'HIGH', 'PROD', true, 'CONFIDENTIAL'],
  ['Sistema de Gestão', 'https://gestao.technova.demo', 'MEDIUM', 'PROD', false, 'INTERNAL'],
  ['Portal E-commerce', 'https://loja.technova.demo', 'CRITICAL', 'PROD', true, 'RESTRICTED'],
  ['SOC Mobile', 'https://soc.technova.demo', 'MEDIUM', 'HOMOL', false, 'INTERNAL'],
].map(([name, url, criticality, environment, internetFacing, dataSensitivity], i) => ({
  id: `app-${i + 1}`, name, url, criticality, environment, internetFacing, dataSensitivity,
  companyId: company.id, techStack: null, description: null, isActive: true,
  businessOwner: null, technicalOwner: null, createdAt: date, updatedAt: date,
}));
const projects = [
  ['Pentest Web — Portal do Cliente', 0, 'IN_REVIEW'],
  ['Pentest API — Integração B2B', 1, 'IN_REVIEW'],
  ['Análise Mobile — App TechNova', 2, 'IN_PROGRESS'],
  ['Auditoria Interna — Gestão', 3, 'COMPLETED'],
  ['Pentest Web — Portal E-commerce', 4, 'IN_REVIEW'],
  ['Análise DAST — SOC Mobile', 5, 'PENDING'],
  ['Revisão de Segurança — Portal', 0, 'PENDING'],
  ['Análise DAST — API B2B', 1, 'PENDING'],
].map(([name, appIndex, status], i) => ({
  id: `project-${i + 1}`, name, applicationId: applications[appIndex].id, companyId: company.id,
  status, analysisType: 'DAST', analysisLevel: 'INTERMEDIATE', hasRemediation: true,
  requestedAt: '2026-10-01T12:00:00.000Z', startedAt: null, closedAt: null,
  description: null, scopeIn: null, scopeOut: null, notes: null, updatedAt: date,
}));
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const labels = { dashboard: 'Dashboard', applications: 'Aplicações', projects: 'Projetos' };
const statusLabels = { PENDING: 'Pendente', IN_PROGRESS: 'Em andamento', IN_REVIEW: 'Em revisão', COMPLETED: 'Concluído' };
const statusTone = { PENDING: 'muted', IN_PROGRESS: 'amber', IN_REVIEW: 'violet', COMPLETED: 'green' };
const criticalityLabels = { CRITICAL: 'Crítica', HIGH: 'Alta', MEDIUM: 'Média' };
const svgPaths = {
  dashboard: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/>',
  apps: '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8m-4-3v3M3 8h18"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9H3z"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  shield: '<path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6z"/><path d="m8 12 3 3 5-6"/>',
  file: '<path d="M5 3h9l5 5v13H5zM14 3v6h5M8 13h8m-8 4h6"/>',
  scan: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M7 12h10"/>',
  company: '<path d="M4 21V4h11v17m0-12h5v12M8 8h3m-3 4h3m-3 4h3M2 21h20"/>',
  alert: '<path d="m12 3 10 18H2zM12 9v5m0 3h.01"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  dots: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18"/>',
  down: '<path d="m7 10 5 5 5-5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/>',
};
const icon = (name, size = 18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${svgPaths[name] ?? svgPaths.apps}</svg>`;
const badge = (text, tone = 'muted') => `<span class="badge ${tone}">${escape(text)}</span>`;
const btn = (text, primary = false, glyph = '') => `<button class="button ${primary ? 'primary' : ''}">${glyph ? icon(glyph, 16) : ''}${text}</button>`;

const css = `
@font-face{font-family:Inter;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:100 900;font-style:normal}
*{box-sizing:border-box}html,body{margin:0;width:1440px;min-height:1000px;background:#0c0f15;color:#eef0f7;font:14px/1.5 Inter,Arial,sans-serif;-webkit-font-smoothing:antialiased}button,input{font:inherit}button{cursor:default}svg{flex-shrink:0}button{border:0}button:focus{outline:none}.screen{min-height:1000px;display:grid;grid-template-columns:216px 1fr}.sidebar{background:#11151e;border-right:1px solid #252b38;display:flex;flex-direction:column;min-height:1000px;padding:28px 16px 20px}.brand{display:flex;align-items:center;gap:11px;margin:0 10px 37px}.brand-mark{color:#ab91ff;font-size:35px;line-height:1;font-weight:850;letter-spacing:-6px;width:31px;transform:skew(-8deg)}.brand-word{font-size:17px;line-height:1.2;letter-spacing:2px;font-weight:750}.brand-word small{display:block;font-size:8px;letter-spacing:4px;color:#8b92a5;margin-top:5px}.nav-caption{font-size:9px;font-weight:700;letter-spacing:1.6px;color:#737c91;padding:0 12px;margin:20px 0 10px}.nav-item{display:flex;align-items:center;gap:12px;height:43px;padding:0 13px;color:#a0a9bc;border-radius:8px;margin:3px 0;font-size:12px}.nav-item.active{color:#d2c4ff;background:#27203f;box-shadow:inset 2px 0 #a284ff}.nav-item.active svg{color:#b39bff}.sidebar-bottom{margin-top:auto;padding:17px 10px 0;border-top:1px solid #262c38;color:#727d93;font-size:10px;display:flex;align-items:center;gap:7px}.dot{height:6px;width:6px;border-radius:50%;display:inline-block;background:#8a94ab}.dot.green{background:#56d3a1}.workspace{min-width:0}.topbar{height:66px;border-bottom:1px solid #252b38;background:#0f131b;display:flex;align-items:center;justify-content:space-between;padding:0 35px}.crumb{display:flex;gap:11px;color:#79849b;font-size:11px;align-items:center}.crumb strong{font-weight:500;color:#d9deeb}.topbar-right{display:flex;gap:22px;align-items:center}.theme{border:1px solid #2a3040;padding:6px;border-radius:7px;color:#98a2ba;display:flex;gap:9px;align-items:center}.theme .moon{width:23px;height:23px;background:#252a36;color:#e6dfff;text-align:center;border-radius:4px;font-size:17px;line-height:22px}.profile{display:flex;align-items:center;gap:10px}.avatar{width:34px;height:34px;border:1px solid #51406f;background:#2b2140;color:#c8b3ff;display:grid;place-items:center;font-weight:650;font-size:11px;border-radius:50%}.profile-name{font-size:11px;font-weight:600}.profile-role{font-size:9px;color:#7f8aa1;margin-top:1px}.content{position:relative;padding:32px 34px 28px;isolation:isolate}.content:before{content:'';position:absolute;top:0;right:0;width:65%;height:230px;background:radial-gradient(ellipse at 80% 0,#7652d112,transparent 68%);z-index:-1}.page-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:27px;min-height:96px}.eyebrow{font-size:9px;letter-spacing:2px;color:#a28bcf;font-weight:650;margin-bottom:7px}.heading-row{display:flex;align-items:center;gap:13px}h1{font-size:29px;line-height:1.25;letter-spacing:-1px;margin:0;font-weight:650}.subtitle{font-size:12px;color:#8d99af;margin:9px 0 0}.subtitle strong{color:#c4cad8;font-weight:500}.header-actions{display:flex;gap:12px;align-items:center}.button{display:inline-flex;align-items:center;justify-content:center;gap:9px;border:1px solid #343c4e;background:#1b2130;color:#d5dbea;border-radius:7px;padding:9px 14px;font-size:11px;font-weight:550;white-space:nowrap;line-height:18px}.button.primary{background:#8561df;border-color:#9774f0;color:#fff;box-shadow:0 3px 12px #0003,inset 0 1px #ffffff0d}.button.small{padding:7px 11px;font-size:10px}.text-link{color:#b49aef;font-size:11px;font-weight:550;text-decoration:none;display:inline-flex;align-items:center;gap:7px}.muted-text{color:#8591a8}.panel{background:#171c26;border:1px solid #2a3140;border-radius:12px;overflow:hidden;box-shadow:0 4px 18px #0000000c}.panel-head{display:flex;align-items:flex-start;justify-content:space-between;padding:21px 22px 18px}.panel-head h2{font-size:14px;font-weight:600;letter-spacing:-.2px;margin:0}.panel-head p{font-size:10px;color:#8490a6;margin:5px 0 0}.kpi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:23px}.kpi{padding:22px 23px 19px;min-height:157px;position:relative}.kpi-label{font-size:11px;color:#9ba5bb;display:flex;align-items:center;justify-content:space-between}.kpi-icon{width:32px;height:32px;background:#262334;border:1px solid #373047;color:#b09bdc;display:grid;place-items:center;border-radius:9px}.kpi-value{font-size:38px;line-height:1.3;letter-spacing:-2px;font-weight:600;margin:9px 0 5px;font-variant-numeric:tabular-nums}.kpi-note{font-size:10px;color:#7f8ba1;display:flex;align-items:center;gap:6px}.critical .kpi-icon{color:#ed9c9c;background:#33242b;border-color:#55313e}.critical .kpi-value{color:#f3a4a4}.badge{display:inline-flex;align-items:center;gap:5px;white-space:nowrap;border-radius:5px;padding:4px 8px;font-size:9px;font-weight:500;border:1px solid #353c4c;background:#222938;color:#a3afc5;line-height:1.4}.badge.violet{color:#c7b1ff;background:#302540;border-color:#45335e}.badge.red{color:#f0a8aa;background:#35242c;border-color:#5a333e}.badge.amber{color:#d9bf80;background:#302b22;border-color:#4c412c}.badge.green{color:#8bceaf;background:#1b302b;border-color:#2d4b40}.badge.blue{color:#a0bbed;background:#202c42;border-color:#324661}.badge.counter{font-size:10px;color:#9c91b8;border-radius:6px;background:#211e2d;border-color:#373041;padding:4px 8px}.dashboard-grid{display:grid;grid-template-columns:minmax(0,1.8fr) minmax(0,1fr);gap:20px}.company-row{padding:23px 22px;border-top:1px solid #29303e}.company-identity{display:flex;align-items:center;gap:13px}.rank{font-size:11px;color:#9b86c8;font-variant-numeric:tabular-nums}.company-avatar{width:37px;height:37px;border-radius:9px;background:#2d273c;color:#c5b6e6;border:1px solid #433955;display:grid;place-items:center;font-size:11px;font-weight:600}.company-name{font-size:13px;font-weight:550}.company-subtitle{color:#7e8aa0;font-size:10px;margin-top:3px}.company-number{margin-left:auto;text-align:right;font-size:23px;line-height:1.1;font-weight:600;letter-spacing:-.7px}.company-number small{display:block;color:#8590a5;font-size:9px;font-weight:400;letter-spacing:0;margin-top:5px}.bar{height:6px;background:#262c3c;border-radius:10px;margin:21px 0 15px;overflow:hidden}.bar span{display:block;width:100%;height:100%;border-radius:10px;background:linear-gradient(90deg,#7957cb,#b69be9)}.ranking-footer{display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#7c879e}.approval{padding:5px 22px 22px;min-height:218px}.approval-state{display:flex;gap:11px;align-items:center;padding:19px 0 23px}.check-circle{width:38px;height:38px;border:1px solid #355044;background:#1e302c;color:#8ac9aa;border-radius:50%;display:grid;place-items:center}.approval-state strong{display:block;font-size:12px;font-weight:550}.approval-state small{display:block;font-size:10px;color:#8390a7;margin-top:5px}.full-width{width:100%}.shortcuts{margin-top:21px;padding:21px 22px}.section-label{font-size:11px;font-weight:550;margin-bottom:15px}.shortcut-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:11px}.shortcut{border:1px solid #303746;background:#1a202c;border-radius:8px;padding:14px;display:flex;gap:10px;align-items:center;color:#bdc6d9;font-size:11px}.shortcut>svg:first-child{color:#9c86c8}.shortcut .end{margin-left:auto;color:#748099}.focus-card{margin-top:20px;padding:19px 20px;display:flex;align-items:center;gap:13px;border-color:#4a333e;background:linear-gradient(110deg,#251d27,#191c27)}.focus-icon{color:#e79da5}.focus-card strong{font-size:11px;font-weight:550}.focus-card p{font-size:10px;color:#a58e9e;margin:4px 0 0}.focus-card .text-link{margin-left:auto;color:#e1adb3}.toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:17px 20px;border-bottom:1px solid #2a3140;background:#181e29}.toolbar-left{display:flex;align-items:center;gap:11px}.search{width:300px;height:36px;border:1px solid #31394b;background:#10151f;border-radius:7px;display:flex;align-items:center;gap:9px;padding:0 12px;color:#68768f;font-size:10px}.search svg{color:#77849c}.toolbar .button{padding:8px 11px;font-size:10px;background:#1c2230}.result-count{color:#7d899f;font-size:10px}.table{width:100%;border-collapse:collapse;table-layout:fixed;text-align:left}.table th{height:43px;background:#141923;color:#7f8ba1;letter-spacing:1px;text-transform:uppercase;font-size:9px;font-weight:550;padding:0 20px;border-bottom:1px solid #293140}.table td{padding:18px 20px;border-bottom:1px solid #282f3d;vertical-align:middle}.table tr:last-child td{border-bottom:0}.app-identity{display:flex;gap:12px;align-items:center}.app-icon{width:36px;height:36px;border:1px solid #37364c;border-radius:9px;display:grid;place-items:center;background:#252236;color:#b3a0d7;flex-shrink:0}.cell-title{font-size:12px;font-weight:550;letter-spacing:-.1px;color:#e1e6f0}.cell-subtitle{font-size:10px;color:#7f8ca3;margin-top:5px;font-weight:400;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.risk-chips{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.table .actions{display:flex;align-items:center;gap:9px}.actions .button{font-size:10px;padding:7px 10px;line-height:17px}.more{display:grid;place-items:center;color:#8d99af;background:transparent;padding:5px}.table-footer{border-top:1px solid #293140;padding:15px 21px;display:flex;align-items:center;justify-content:space-between;color:#748097;font-size:10px}.table-footer strong{color:#a5afc2;font-weight:500}.legend{display:flex;align-items:center;gap:6px;color:#7f8ba3;font-size:10px}.count-text{font-size:11px;color:#8794aa;margin-top:20px}.page-footnote{margin:20px 2px 0;color:#5e6d86;font-size:9px;display:flex;gap:7px;align-items:center}.flow-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:13px;margin-bottom:22px}.flow-card{padding:18px 19px;position:relative;min-height:107px}.flow-card .flow-label{display:flex;align-items:center;gap:7px;color:#909cb1;font-size:10px}.flow-card .flow-value{margin-top:9px;font-size:25px;line-height:1.3;letter-spacing:-1px;font-weight:550}.flow-card small{color:#66748d;font-size:9px}.flow-card .flow-bottom{display:flex;align-items:baseline;justify-content:space-between}.flow-card.selected{border-color:#62507e;background:linear-gradient(110deg,#241e33,#1c1e2c)}.flow-card .dot.violet{background:#a68be7}.flow-card .dot.amber{background:#c7a34e}.flow-card .dot.muted{background:#8190a8}.project-name{font-size:11px;font-weight:550;color:#dfe5ef;white-space:nowrap}.project-ref{display:flex;gap:6px;align-items:center;font-size:9px;color:#748198;margin-top:5px}.step-dots{display:flex;gap:4px;margin-top:7px}.step-dots i{width:17px;height:3px;border-radius:3px;background:#31384a}.step-dots i.done{background:#8f71cc}.step-dots.green i.done{background:#5d9c85}.projects-table td{padding-top:14px;padding-bottom:14px}.project-app{font-size:10px;color:#99a5bb}.project-date{font-variant-numeric:tabular-nums;font-size:10px;color:#8190a9}.project-open{color:#9d89c8;display:flex;align-items:center;justify-content:flex-end}.small-gap{gap:6px}.empty-space-note{margin-top:27px;border-top:1px solid #202735;padding-top:18px;color:#5f6c83;font-size:10px;display:flex;justify-content:space-between}.heading-pair{display:flex;gap:9px;align-items:center}.subtle-signal{height:1px;background:linear-gradient(90deg,#8c63d9aa,transparent);width:54px;margin-bottom:18px}
`;

function sidebar(kind) {
  const nav = (key, text, glyph) => `<div class="nav-item ${kind === key ? 'active' : ''}">${icon(glyph, 17)}<span>${text}</span></div>`;
  return `<aside class="sidebar"><div class="brand"><div class="brand-mark">V</div><div class="brand-word">VULNERA<small>SECURITY</small></div></div><div class="nav-caption">VISÃO GERAL</div>${nav('dashboard', 'Dashboard', 'dashboard')}<div class="nav-caption">OPERAÇÃO</div>${nav('applications', 'Aplicações', 'apps')}${nav('projects', 'Projetos', 'folder')}${nav('findings', 'Findings', 'search')}${nav('remediation', 'Remediação', 'shield')}${nav('dast', 'DAST', 'scan')}${nav('playbooks', 'Playbooks', 'file')}<div class="nav-caption">ADMINISTRAÇÃO</div>${nav('sla', 'Políticas de SLA', 'clock')}${nav('approvals', 'Aprovações', 'check')}<div class="sidebar-bottom"><span class="dot green"></span>Vulnera · Security workspace</div></aside>`;
}

function header(title, subtitle, eyebrow, actions = '', counter = '') {
  return `<header class="page-header"><div><div class="eyebrow">${eyebrow}</div><div class="heading-row"><h1>${title}</h1>${counter}</div><p class="subtitle">${subtitle}</p></div><div class="header-actions">${actions}</div></header>`;
}

function dashboard() {
  const kpi = (label, value, glyph, note, cls = '') => `<article class="panel kpi ${cls}"><div class="kpi-label">${label}<span class="kpi-icon">${icon(glyph)}</span></div><div class="kpi-value">${value}</div><div class="kpi-note">${note}</div></article>`;
  return `${header('Olá, Vulnera Admin', '<strong>3 críticos</strong> aguardando tratamento no seu ambiente.', 'VISÃO GERAL DA PLATAFORMA', btn('Explorar findings', false, 'arrow'))}
  <section class="kpi-grid">${kpi('Empresas ativas', '1', 'company', '<span class="dot green"></span>Assinatura ativa')}${kpi('Assinaturas pendentes', '0', 'clock', 'Nenhuma aprovação aguardando')}${kpi('Críticos em aberto', '3', 'alert', 'Prioridade de tratamento', 'critical')}</section>
  <section class="dashboard-grid"><div><article class="panel"><div class="panel-head"><div><h2>Empresas por volume de findings</h2><p>Visão consolidada do escopo administrativo.</p></div>${badge('1 empresa')}</div><div class="company-row"><div class="company-identity"><span class="rank">01</span><span class="company-avatar">TN</span><div><div class="company-name">TechNova Solutions</div><div class="company-subtitle">Volume de findings registrados</div></div><div class="company-number">11<small>findings</small></div></div><div class="bar"><span></span></div><div class="ranking-footer"><span>11 de 11 findings no escopo</span><a class="text-link">Ver maturidade ${icon('arrow', 14)}</a></div></div></article>
  <article class="panel shortcuts"><div class="section-label">Continue seu trabalho</div><div class="shortcut-grid">${[['apps','Aplicações'],['folder','Projetos'],['search','Findings']].map(([glyph,text])=>`<div class="shortcut">${icon(glyph,17)}${text}<span class="end">${icon('arrow',14)}</span></div>`).join('')}</div></article>
  <article class="panel focus-card"><div class="focus-icon">${icon('alert',23)}</div><div><strong>3 findings críticos em aberto</strong><p>Acesse o recorte para revisar as prioridades.</p></div><a class="text-link">Revisar ${icon('arrow',14)}</a></article></div>
  <div><article class="panel"><div class="panel-head"><div><h2>Aprovações</h2><p>Solicitações de assinatura</p></div>${icon('clock',17)}</div><div class="approval"><div class="approval-state"><span class="check-circle">${icon('check',20)}</span><div><strong>Tudo em dia</strong><small>Nenhuma aprovação pendente.</small></div></div><div class="button full-width">Ver assinaturas ${icon('arrow',14)}</div></div></article><div class="page-footnote">${icon('shield',13)}Dados respeitam o escopo administrativo.</div></div></section>`;
}

function applicationPage() {
  return `${header('Aplicações', 'Organize seus alvos e mantenha o contexto de risco ao alcance.', 'INVENTÁRIO DE SUPERFÍCIE', btn('Nova aplicação', true, 'plus'), badge('6 aplicações', 'counter'))}
  <section class="panel"><div class="toolbar"><div class="toolbar-left"><div class="search">${icon('search',15)}Buscar por nome ou URL...</div>${btn('Todos os ambientes',false,'down')}</div><span class="result-count">6 aplicações encontradas</span></div>
  <table class="table"><colgroup><col style="width:31%"><col style="width:12%"><col style="width:39%"><col style="width:18%"></colgroup><thead><tr><th>Aplicação</th><th>Ambiente</th><th>Contexto de risco</th><th>Ações</th></tr></thead><tbody>${applications.map(a => `<tr><td><div class="app-identity"><span class="app-icon">${icon('apps',19)}</span><div style="min-width:0"><div class="cell-title">${escape(a.name)}</div><div class="cell-subtitle">${escape(a.url.replace('https://',''))}</div></div></div></td><td>${badge(a.environment === 'PROD' ? 'Produção' : 'Homologação', a.environment === 'PROD' ? 'violet' : 'muted')}</td><td><div class="risk-chips">${badge(criticalityLabels[a.criticality], a.criticality === 'CRITICAL' ? 'red' : a.criticality === 'HIGH' ? 'amber' : 'muted')}${badge(a.internetFacing ? 'Internet' : 'Interna')}${badge(a.dataSensitivity === 'RESTRICTED' ? 'Dado restrito' : a.dataSensitivity === 'CONFIDENTIAL' ? 'Confidencial' : 'Dado interno')}</div></td><td><div class="actions">${btn('Nova análise',false)}<button class="more">${icon('dots',18)}</button></div></td></tr>`).join('')}</tbody></table><div class="table-footer"><span>Mostrando <strong>6 de 6</strong> aplicações</span><span class="legend">${icon('apps',13)}Selecione o nome para abrir o painel</span></div></section>
  <div class="empty-space-note"><span>Contexto de risco: criticidade · ambiente · exposição · sensibilidade dos dados</span><span>TechNova Solutions</span></div>`;
}

function projectsPage() {
  const order = ['PENDING','IN_PROGRESS','IN_REVIEW','COMPLETED'];
  const plural = ['Pendentes','Em andamento','Em revisão','Concluídos'];
  return `${header('Projetos', 'Acompanhe suas análises, do pedido à entrega.', 'PORTFÓLIO DE ANÁLISES', btn('Novo projeto',true,'plus'), badge('8 projetos','counter'))}
  <section class="flow-grid">${order.map((status,i)=>`<article class="panel flow-card"><div class="flow-label"><span class="dot ${statusTone[status]}"></span>${plural[i]}</div><div class="flow-bottom"><span class="flow-value">${projects.filter(p=>p.status===status).length}</span><small>Ver projetos ${icon('arrow',11)}</small></div></article>`).join('')}</section>
  <section class="panel"><div class="toolbar"><div class="toolbar-left"><div class="search">${icon('search',15)}Buscar projeto ou aplicação...</div>${btn('Todos os status',false,'down')}</div><span class="result-count">8 projetos registrados</span></div><table class="table projects-table"><colgroup><col style="width:37%"><col style="width:24%"><col style="width:19%"><col style="width:14%"><col style="width:6%"></colgroup><thead><tr><th>Projeto</th><th>Aplicação</th><th>Etapa atual</th><th>Solicitado em</th><th></th></tr></thead><tbody>${projects.map((p,i)=>`<tr><td><div class="project-name">${escape(p.name)}</div><div class="project-ref">${icon('folder',12)}PRJ-${String(i+1).padStart(3,'0')}</div></td><td><span class="project-app">${escape(applications.find(a=>a.id===p.applicationId).name)}</span></td><td>${badge(statusLabels[p.status],statusTone[p.status])}<div class="step-dots ${p.status==='COMPLETED'?'green':''}">${order.map((s,j)=>`<i class="${j<=order.indexOf(p.status)?'done':''}"></i>`).join('')}</div></td><td><span class="project-date">01 out. 2026</span></td><td><span class="project-open">${icon('arrow',16)}</span></td></tr>`).join('')}</tbody></table><div class="table-footer"><span>Mostrando <strong>8 de 8</strong> projetos</span><span class="legend">As etapas representam o status da análise</span></div></section>`;
}

function proposal(kind) {
  const content = kind === 'dashboard' ? dashboard() : kind === 'applications' ? applicationPage() : projectsPage();
  const polish = `.nav-item{font-size:13px}.nav-caption{font-size:10px}.profile-name{font-size:12px}.profile-role{font-size:10px}.crumb{font-size:12px}.subtitle{font-size:13px}.eyebrow{font-size:10px}.kpi-label{font-size:13px}.kpi-note{font-size:11px}.panel-head h2{font-size:15px}.panel-head p{font-size:11px}.company-name{font-size:14px}.company-subtitle{font-size:11px}.company-number small{font-size:10px}.ranking-footer{font-size:11px}.text-link{font-size:12px}.section-label{font-size:12px}.shortcut{font-size:12px}.approval{min-height:0}.approval-state strong{font-size:13px}.approval-state small{font-size:11px}.focus-card strong{font-size:12px}.focus-card p{font-size:11px}.button{font-size:12px}.cell-title{font-size:14px}.cell-subtitle{font-size:11px}.badge{font-size:10px}.table th{font-size:10px}.table .actions .button{font-size:11px}.search{font-size:12px}.result-count{font-size:11px}.table-footer{font-size:11px}.legend{font-size:11px}.page-footnote{font-size:10px}.flow-card .flow-label{font-size:12px}.flow-card small{font-size:10px}.project-name{font-size:12px}.project-app,.project-date{font-size:11px}.projects .page-header{min-height:82px;margin-bottom:22px}.projects .flow-card{min-height:96px;padding:15px 18px}.projects .projects-table td{padding-top:8px;padding-bottom:8px}.projects .toolbar{padding-top:14px;padding-bottom:14px}.projects .project-ref{display:none}`;
  return `<!doctype html><!-- Estudo visual para avaliação de Rafael; não altera o aplicativo. --><html lang="pt-BR"><head><meta charset="utf-8"><title>${labels[kind]} · Proposta Vulnera</title><style>${css}${polish}</style></head><body class="${kind}"><div class="screen">${sidebar(kind)}<div class="workspace"><div class="topbar"><div class="crumb">${icon('dashboard',14)}Visão geral<span>/</span><strong>${labels[kind]}</strong></div><div class="topbar-right"><div class="theme"><span class="moon">◔</span>${icon('sun',15)}</div><div class="profile"><div class="avatar">VA</div><div><div class="profile-name">Vulnera Admin</div><div class="profile-role">Administrador</div></div>${icon('down',13)}</div></div></div><main class="content">${content}</main></div></div></body></html>`;
}

const pngData = async filename => `data:image/png;base64,${(await readFile(path.join(out,filename))).toString('base64')}`;

await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, colorScheme: 'dark', reducedMotion: 'reduce' });
const page = await ctx.newPage();
const errors = [];
const unknownRequests = new Set();
page.on('pageerror', e => errors.push(e.message));
await page.addInitScript(({ user }) => {
  // Sessão sintética criada só neste contexto de captura, sem credencial real.
  localStorage.setItem('vulnera-auth', JSON.stringify({ state: { user, accessToken: 'visual-preview-only', refreshToken: 'visual-preview-only' }, version: 0 }));
  localStorage.setItem('vulnera:theme', 'dark');
}, { user });
await page.route('**/*', async route => {
  const req = route.request();
  const url = new URL(req.url());
  if (!['xhr','fetch'].includes(req.resourceType()) || url.pathname.startsWith('/src/') || url.pathname.startsWith('/node_modules/')) return route.continue();
  const pathname = url.pathname.replace(/^\/api/, '');
  let body;
  if (pathname === '/applications') body = applications;
  else if (pathname === '/projects') body = projects;
  else if (pathname === '/companies') body = [company];
  else if (pathname === '/subscriptions/active') body = [{id:'subscription-demo',companyId:company.id,planId:'plan-demo',status:'ACTIVE',createdAt:date,updatedAt:date}];
  else if (pathname === '/subscriptions/pending' || pathname === '/saved-queries') body = [];
  else if (pathname === '/vulnerabilities') body = { data: [], pagination: { page:1, pageSize:5, total:url.searchParams.has('severity')?3:11,totalPages:1 }, facets: { severity:{CRITICAL:3,HIGH:4,MEDIUM:4},status:{OPEN:7,IN_PROGRESS:4},company:{[company.id]:11},owasp:{} } };
  else { unknownRequests.add(url.pathname); body = []; }
  await route.fulfill({ status:200,contentType:'application/json',body:JSON.stringify(body),headers:{'access-control-allow-origin':'*'} });
});
const results = [];
try {
  for (const kind of ['dashboard','applications','projects']) {
    await page.goto(`${origin}/${kind}`, { waitUntil:'networkidle' });
    await page.getByRole('heading', { level:1 }).waitFor();
    if(kind==='dashboard') await page.getByText('TechNova Solutions',{exact:true}).waitFor();
    else if(kind==='applications') await page.getByRole('cell',{name:'Portal do Cliente',exact:true}).waitFor();
    else await page.getByRole('link',{name:'Pentest Web — Portal do Cliente',exact:true}).waitFor();
    await page.evaluate(()=>document.fonts.ready);
    await page.screenshot({path:path.join(out,`${kind}-antes.png`)});
    const beforeInfo = await page.evaluate(()=>({width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth}));
    const htmlFile = path.join(out,`${kind}-proposta.html`);
    await writeFile(htmlFile,proposal(kind),'utf8');
    const after = await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
    await after.goto(pathToFileURL(htmlFile).href);
    await after.evaluate(()=>document.fonts.ready);
    const afterInfo = await after.evaluate(()=>({width:innerWidth,height:innerHeight,contentHeight:document.documentElement.scrollHeight,overflow:document.documentElement.scrollWidth>innerWidth}));
    assert.equal(afterInfo.overflow,false,`${kind}: overflow horizontal`);
    assert.equal(afterInfo.contentHeight,1000,`${kind}: proposta cortada`);
    await after.screenshot({path:path.join(out,`${kind}-depois.png`)});
    await after.close();
    results.push({kind,beforeInfo,afterInfo});
    const board = await browser.newPage({viewport:{width:3008,height:1250},deviceScaleFactor:1});
    const copy = {
      dashboard: ['Dados em primeiro plano','Cabeçalho compacto · KPIs refinados · Aprovações ao lado do ranking'],
      applications: ['Inventário com mais clareza','Nome e URL agrupados · Risco legível · Ações organizadas'],
      projects: ['Portfólio com leitura mais rápida','Resumo compacto · Filtros integrados · Etapas visíveis'],
    }[kind];
    await board.setContent(`<!doctype html><!-- Comparativo de capturas para revisão visual; dados de demonstração. --><html lang="pt-BR"><head><meta charset="utf-8"><style>@font-face{font-family:Inter;src:url(data:font/woff2;base64,${font})}*{box-sizing:border-box}body{margin:0;width:3008px;height:1250px;background:#090c12;font-family:Inter,Arial;color:#e9eaf3;padding:32px 36px}.head{display:flex;align-items:end;justify-content:space-between;margin-bottom:25px}.title{font-size:27px;font-weight:650;letter-spacing:-.8px}.title small{font-size:12px;color:#9a83ce;display:block;letter-spacing:2.4px;margin-bottom:6px}.desc{font-size:14px;color:#8c98af}.pair{display:grid;grid-template-columns:1440px 1440px;gap:56px}.label{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;font-size:12px;letter-spacing:1.6px;font-weight:600;color:#9da7ba}.label span{font-size:11px;letter-spacing:0;font-weight:400;color:#68768f}.label.new{color:#bd9df7}img{display:block;width:1440px;height:1000px;border:1px solid #303747;border-radius:9px}.foot{display:flex;justify-content:space-between;font-size:11px;color:#6d7b93;margin-top:20px;letter-spacing:.2px}</style></head><body><div class="head"><div class="title"><small>VULNERA SECURITY / ESTUDO VISUAL</small>${labels[kind]} — ${copy[0]}</div><div class="desc">${copy[1]}</div></div><div class="pair"><div><div class="label">ANTES<span>Tela atual · captura do aplicativo</span></div><img src="${await pngData(`${kind}-antes.png`)}"></div><div><div class="label new">DEPOIS · PROPOSTA<span>Prévia conceitual · mesmos dados</span></div><img src="${await pngData(`${kind}-depois.png`)}"></div></div><div class="foot"><span>Mesma resolução: 1440 × 1000 px em cada tela · Dados de demonstração isolados no navegador</span><span>16 OUT 2026 · A proposta ainda não foi aplicada</span></div></body></html>`);
    await board.evaluate(()=>document.fonts.ready);
    await board.screenshot({path:path.join(out,`${kind}-antes-depois.png`)});
    await board.close();
    process.stdout.write(`OK ${kind}: antes, proposta e comparativo\n`);
  }
  assert.deepEqual(errors,[],`Erros no aplicativo: ${errors.join('; ')}`);
  assert.equal(unknownRequests.size,0,`Requests sem fixture: ${[...unknownRequests].join(', ')}`);
  await writeFile(path.join(out,'README.md'),`<!-- Registra a origem e os limites das prévias; consumido pela revisão visual. -->\n# Prévias visuais — 2026-10-16\n\nTrês comparativos desktop de Dashboard, Aplicações e Projetos.\n\n- Antes: captura do código atual em 1440×1000, tema escuro, Chrome headless e dados de demonstração interceptados somente no navegador.\n- Depois: estudo HTML/CSS independente, com os mesmos dados. Não implementado no aplicativo.\n- Nenhuma consulta à API real ou gravação no banco.\n- Geração de imagens por IA indisponível por erro 401 de sessão expirada; imagens finais renderizadas localmente.\n- Fontes e dependências locais existentes. Nenhuma instalação.\n- ${results.length}/3 propostas sem corte ou overflow horizontal. Zero erros de página e zero endpoints sem fixture.\n\nArquivos por tela: *-antes.png, *-depois.png, *-antes-depois.png e *-proposta.html.\n\nBrief visual: grafite e violeta discreto; superfícies mais sólidas; cabeçalhos compactos; melhor hierarquia de dados; ações de tabela organizadas; sidebar agrupada.\n\nReproduzir: servidor Vite em http://127.0.0.1:5173 e node output/ui-redesign-preview/render-comparisons.mjs.\n`,'utf8');
  process.stdout.write('Validado: 3/3 comparativos, sem cortes, sem overflow e sem erros de página.\n');
} finally { await browser.close(); }
