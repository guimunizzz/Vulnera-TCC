import { describe, expect, it } from "vitest";
import type { DastFinding, DastObservedAsset } from "../../types/dast.types";
import { COLUNA_X, gruposDoNo, gruposParaMostrar, idDoGrupo, montarVisao2D, ocultosPorGrupo } from "./graph-2d-layout";
import { buildSecurityGraph, ID_SUBDOMINIOS } from "./graph-model";
import { descreverNo } from "./node-detail";

const ativo = (kind: DastObservedAsset["kind"], value: string, parentValue: string | null, sensorKey = "internetdb"): DastObservedAsset => ({
  kind,
  value,
  parentValue,
  sensorKey,
  metadata: kind === "IP" ? { publico: true } : null,
});

const ATIVOS: DastObservedAsset[] = [
  ativo("PORT", "45.33.32.156:22", "45.33.32.156"),
  ativo("IP", "45.33.32.156", null),
  ativo("PORT", "45.33.32.156:80", "45.33.32.156"),
  ativo("TECHNOLOGY", "nginx 1.18.0", null, "fingerprint"),
  ...Array.from({ length: 8 }, (_, i) => ativo("SUBDOMAIN", `s${i}.x.com`, null, "crtsh")),
];
const CVE = { id: "c1", risk: "HIGH", normalizedUrl: "http://x/", title: "CVE-2021-42013 — potencial · não validado", cveId: "CVE-2021-42013", cvssScore: 9.8 } as DastFinding;
const ZAP = { id: "z1", risk: "LOW", normalizedUrl: "http://x/login", title: "Cookie" } as DastFinding;

describe("grafo com ativos de descoberta", () => {
  const grafo = buildSecurityGraph("http://x/", [CVE, ZAP], ATIVOS);
  const pai = (id: string) => grafo.edges.find((e) => e.target === id)?.source;

  it("liga IP ao alvo, portas ao IP, CVE ao IP (não a um endpoint) e subdomínios ao nó agregado", () => {
    expect(pai("ip:45.33.32.156")).toBe("asset");
    expect(pai("port:45.33.32.156:22")).toBe("ip:45.33.32.156");
    expect(pai("technology:nginx 1.18.0")).toBe("asset");
    expect(pai("finding:c1")).toBe("ip:45.33.32.156");
    expect(pai("finding:z1")).toBe("endpoint:http://x/login");
    expect(pai("subdomain:s0.x.com")).toBe(ID_SUBDOMINIOS);
    expect(grafo.nodes.find((n) => n.id === ID_SUBDOMINIOS)?.total).toBe(8);
    expect(grafo.nodes.find((n) => n.id === "port:45.33.32.156:22")?.label).toBe("porta 22");
  });

  it("2D: IP no topo (pior risco), portas na coluna do meio, grupo de CVEs; subdomínios começam recolhidos", () => {
    const visao = montarVisao2D(grafo, new Set());
    const ip = visao.nodes.find((n) => n.id === "ip:45.33.32.156")!;
    expect(ip).toMatchObject({ x: COLUNA_X.ENDPOINT, total: 1, risk: "HIGH" });
    expect(visao.nodes.filter((n) => n.kind === "PORT").every((n) => n.x === COLUNA_X.GROUP)).toBe(true);
    expect(visao.nodes.find((n) => n.id === idDoGrupo(ip.id))).toMatchObject({ label: "CVEs", total: 1 });
    const sub = visao.nodes.find((n) => n.id === ID_SUBDOMINIOS)!;
    expect(sub).toMatchObject({ expandivel: true, expandido: false, total: 8 });
    expect(visao.nodes.some((n) => n.id === "subdomain:s0.x.com")).toBe(false);
    // O ramo mais perigoso vem primeiro.
    expect(visao.nodes[2].id).toBe(ip.id);
  });

  it("expandir os subdomínios mostra cada um na coluna do meio", () => {
    const visao = montarVisao2D(grafo, new Set([ID_SUBDOMINIOS]));
    const subs = visao.nodes.filter((n) => n.id.startsWith("subdomain:"));
    expect(subs).toHaveLength(8);
    expect(new Set(subs.map((n) => n.y)).size).toBe(8);
  });

  it("detalhe do IP conta as portas e as CVEs; o grupo do IP fala de CVEs", () => {
    const porNo = new Map([["finding:c1", CVE], ["finding:z1", ZAP]]);
    const ip = descreverNo(grafo, porNo, "ip:45.33.32.156")!;
    expect(ip.estrutura.filter((e) => e.kind === "PORT")).toHaveLength(2);
    expect(ip.findings).toEqual([CVE]);
    const grupo = descreverNo(grafo, porNo, idDoGrupo("ip:45.33.32.156"))!;
    expect(grupo).toMatchObject({ kind: "GROUP", ramo: "IP", label: "CVEs de 45.33.32.156" });
  });

  it("3D: tudo fechado esconde CVEs, findings e subdomínios, mas não as portas (poucas)", () => {
    const ocultos = ocultosPorGrupo(grafo, new Set());
    expect([...ocultos].sort()).toEqual(["finding:c1", "finding:z1", ...Array.from({ length: 8 }, (_, i) => `subdomain:s${i}.x.com`)].sort());
    expect(ocultosPorGrupo(grafo, new Set([idDoGrupo("ip:45.33.32.156"), ID_SUBDOMINIOS])).has("finding:c1")).toBe(false);
  });

  it("3D: o IP alterna o grupo de CVEs, Subdomínios alterna os filhos, porta e finding não agrupam", () => {
    expect(gruposDoNo(grafo, "ip:45.33.32.156")).toEqual([idDoGrupo("ip:45.33.32.156")]);
    expect(gruposDoNo(grafo, ID_SUBDOMINIOS)).toEqual([ID_SUBDOMINIOS]);
    expect(gruposDoNo(grafo, "port:45.33.32.156:22")).toEqual([]);
    expect(gruposDoNo(grafo, "finding:c1")).toEqual([]);
    // Buscar um subdomínio escondido abre o nó agregado.
    expect(gruposParaMostrar(grafo, "subdomain:s3.x.com")).toEqual([ID_SUBDOMINIOS]);
  });

  it("sem IP (alvo privado sem ativo), CVE cai no endpoint como antes", () => {
    const g = buildSecurityGraph("http://x/", [CVE]);
    expect(g.edges.find((e) => e.target === "finding:c1")?.source).toBe("endpoint:http://x/");
  });
});
