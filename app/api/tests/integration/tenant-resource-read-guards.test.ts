/**
 * Confirma pela API o isolamento das leituras usadas pelo painel da aplicação.
 * Usa somente fixtures sintéticas no schema descartável validado pelo setup;
 * não depende das contas ou dos dados usados na validação manual. Consumido
 * pelo Jest de integração na regressão defensiva da wave B2B.
 */
import { performance } from "node:perf_hooks";
import request from "supertest";
import { app } from "../../src/app";
import { loginAs } from "../fixtures/auth.fixture";
import {
  seedTenantSecurityWaveFixture,
  TENANT_SECURITY_WAVE_PASSWORD,
} from "../fixtures/tenant-security-wave.fixture";
import { cleanDatabase } from "../setup";

type Fixture = Awaited<ReturnType<typeof seedTenantSecurityWaveFixture>>;
type ClientActor = "ownerA" | "memberA" | "ownerB" | "memberB";
type Actor = ClientActor | "admin" | "pentesterAssigned" | "pentesterUnassigned";
let wave: Fixture;
const tokens = {} as Record<Actor, string>;
const samples: Array<{ endpoint: string; status: number; durationMs: number }> = [];
const actors: Actor[] = ["ownerA", "memberA", "ownerB", "memberB", "admin", "pentesterAssigned", "pentesterUnassigned"];
const clients: ClientActor[] = ["ownerA", "memberA", "ownerB", "memberB"];
const reads = [
  { endpoint: "GET /applications/:id", suffix: "", idField: "id" },
  { endpoint: "GET /applications/:id/metrics/summary", suffix: "/metrics/summary", idField: "applicationId" },
  { endpoint: "GET /applications/:id/metrics/timeseries", suffix: "/metrics/timeseries", idField: "applicationId" },
  { endpoint: "GET /applications/:id/metrics/insights", suffix: "/metrics/insights", idField: "applicationId" },
];

async function read(token: string | null, path: string, endpoint: string) {
  const started = performance.now();
  const pending = request(app).get(path);
  if (token) pending.set("Authorization", `Bearer ${token}`);
  const response = await pending;
  samples.push({ endpoint, status: response.status, durationMs: Math.round((performance.now() - started) * 10) / 10 });
  return response;
}

beforeAll(async () => {
  await cleanDatabase();
  wave = await seedTenantSecurityWaveFixture();
  for (const actor of actors) {
    tokens[actor] = await loginAs(app, wave[actor].email, TENANT_SECURITY_WAVE_PASSWORD);
    expect(typeof tokens[actor]).toBe("string");
    expect(tokens[actor].length).toBeGreaterThan(0);
  }
});

afterAll(async () => {
  // Mede somente requests locais sintéticos; não imprime identidades ou tokens.
  const groups = new Map<string, typeof samples>();
  for (const sample of samples) {
    const key = `${sample.endpoint} ${sample.status}`;
    groups.set(key, [...(groups.get(key) ?? []), sample]);
  }
  console.info("TENANT_READ_GUARDS", JSON.stringify([...groups.entries()].map(([route, values]) => ({
    route, requests: values.length,
    minMs: Math.min(...values.map((sample) => sample.durationMs)),
    maxMs: Math.max(...values.map((sample) => sample.durationMs)),
  }))));
  await cleanDatabase();
});

describe("leituras defensivas do painel em tenants sintéticos", () => {
  it.each(clients)("READ-TEN-01 — %s lê o próprio recurso e recebe só erro no recurso de outro tenant", async (actor) => {
    const own = actor.endsWith("A") ? wave.applicationA : wave.applicationB;
    const other = actor.endsWith("A") ? wave.applicationB : wave.applicationA;
    for (const route of reads) {
      const allowed = await read(tokens[actor], `/api/applications/${own.id}${route.suffix}`, route.endpoint);
      expect(allowed.status).toBe(200);
      expect(allowed.body[route.idField]).toBe(own.id);
      if (route.suffix === "/metrics/summary") {
        expect(allowed.body.totalFindings).toBe(1);
        expect(allowed.body.totalAbertos).toBe(1);
      }
      if (route.suffix === "/metrics/timeseries") {
        expect(allowed.body.pontos.reduce((total: number, point: { criados: number }) => total + point.criados, 0)).toBe(1);
      }
      expect(JSON.stringify(allowed.body)).not.toContain(other.id);
      expect(JSON.stringify(allowed.body)).not.toContain(other.name);

      const denied = await read(tokens[actor], `/api/applications/${other.id}${route.suffix}`, route.endpoint);
      expect(denied.status).toBe(403);
      // Corpo exato: nem nomes, IDs, métricas, contexto ou outros metadados.
      expect(denied.body).toEqual({ error: "FORBIDDEN" });
      expect(denied.headers["content-type"]).toMatch(/application\/json/);
    }
  });

  it.each(reads)("READ-TEN-02 — $endpoint distingue a ausência com 404 sem payload do recurso", async (route) => {
    const response = await read(tokens.memberA, `/api/applications/fixture-resource-not-found${route.suffix}`, route.endpoint);
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "APPLICATION_NOT_FOUND" });
  });

  it.each(clients)("READ-TEN-03 — %s recebe comparação e grafo somente da própria empresa", async (actor) => {
    const fromA = actor.endsWith("A");
    const own = fromA ? wave.applicationA : wave.applicationB;
    const ownCompany = fromA ? wave.companyA : wave.companyB;
    const other = fromA ? wave.applicationB : wave.applicationA;
    const otherCompany = fromA ? wave.companyB : wave.companyA;
    const otherFinding = fromA ? wave.vulnerabilityB : wave.vulnerabilityA;
    for (const path of ["/api/companies/me/metrics/comparison", "/api/companies/me/exposure-graph"]) {
      const response = await read(tokens[actor], path, `GET ${path.replace("/api", "")}`);
      expect(response.status).toBe(200);
      expect(response.body.companyId).toBe(ownCompany.id);
      expect(JSON.stringify(response.body)).toContain(own.id);
      if (path.endsWith("comparison")) {
        expect(response.body.aplicacoes.find((application: { applicationId: string }) => application.applicationId === own.id))
          .toMatchObject({ totalFindings: 1, totalAbertos: 1 });
      } else {
        expect(response.body.aplicacoes.find((application: { id: string }) => application.id === own.id))
          .toMatchObject({ totalAbertas: 1 });
      }
      for (const secret of [other.id, other.name, otherCompany.id, otherCompany.name, otherFinding.id, otherFinding.title]) {
        expect(JSON.stringify(response.body)).not.toContain(secret);
      }
    }
  });

  it("READ-TEN-04 — ADMIN preserva leitura global de aplicação e métricas", async () => {
    for (const route of reads) {
      const response = await read(tokens.admin, `/api/applications/${wave.applicationB.id}${route.suffix}`, route.endpoint);
      expect(response.status).toBe(200);
      expect(response.body[route.idField]).toBe(wave.applicationB.id);
    }
  });

  it("READ-TEN-05 — PENTESTER preserva métricas por ProjectMember e o bloqueio do catálogo de aplicações", async () => {
    for (const route of reads.filter((item) => item.suffix)) {
      const allowed = await read(tokens.pentesterAssigned, `/api/applications/${wave.applicationA.id}${route.suffix}`, route.endpoint);
      expect(allowed.status).toBe(200);
      expect(allowed.body.applicationId).toBe(wave.applicationA.id);
      for (const [actor, application] of [
        ["pentesterAssigned", wave.applicationB], ["pentesterUnassigned", wave.applicationA],
      ] as const) {
        const denied = await read(tokens[actor], `/api/applications/${application.id}${route.suffix}`, route.endpoint);
        expect(denied.status).toBe(403);
        expect(denied.body).toEqual({ error: "FORBIDDEN" });
      }
    }
    // Contrato existente: Application.getById é catálogo ADMIN/CLIENT; as
    // métricas têm autorização própria para PENTESTER membro do projeto.
    const application = await read(tokens.pentesterAssigned, `/api/applications/${wave.applicationA.id}`, reads[0].endpoint);
    expect(application.status).toBe(403);
    expect(application.body).toEqual({ error: "FORBIDDEN" });
  });

  it.each(reads)("READ-TEN-06 — $endpoint exige sessão antes de devolver dados", async (route) => {
    const response = await read(null, `/api/applications/${wave.applicationA.id}${route.suffix}`, route.endpoint);
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ code: "UNAUTHORIZED", message: "Token ausente ou mal formado" });
  });
});
