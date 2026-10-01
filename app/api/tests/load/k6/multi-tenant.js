/**
 * multi-tenant.js
 *
 * Demonstra isolamento: dois usuários da empresa A excedem o bucket tenant;
 * empresas B/C permanecem normais. Exige quatro tokens fornecidos no ambiente.
 */

import http from 'k6/http';
import { check } from 'k6';
import { baseUrl, bearer, duration, metricsThresholds, record } from './common.js';

export const options = {
  scenarios: {
    tenantA: { executor: 'constant-arrival-rate', exec: 'tenantA', rate: 3, timeUnit: '1s', duration, preAllocatedVUs: 5, maxVUs: 20 },
    tenantB: { executor: 'constant-arrival-rate', exec: 'tenantB', rate: 1, timeUnit: '1s', duration, preAllocatedVUs: 2, maxVUs: 5 },
    tenantC: { executor: 'constant-arrival-rate', exec: 'tenantC', rate: 1, timeUnit: '1s', duration, preAllocatedVUs: 2, maxVUs: 5 },
  },
  thresholds: metricsThresholds,
};

function requestWith(tokenName, tags) {
  const response = http.get(`${baseUrl}/api/users/me`, { ...bearer(tokenName), tags });
  record(response);
  return response;
}

export function tenantA() {
  const tokenName = __ITER % 2 === 0 ? 'TENANT_A_TOKEN_1' : 'TENANT_A_TOKEN_2';
  const response = requestWith(tokenName, { tenantScenario: 'A' });
  check(response, { 'tenant A recebe resposta prevista': (value) => value.status === 429 || (value.status >= 200 && value.status < 300) });
}

export function tenantB() {
  const response = requestWith('TENANT_B_TOKEN', { tenantScenario: 'B' });
  check(response, { 'tenant B preserva 2xx': (value) => value.status >= 200 && value.status < 300 });
}

export function tenantC() {
  const response = requestWith('TENANT_C_TOKEN', { tenantScenario: 'C' });
  check(response, { 'tenant C preserva 2xx': (value) => value.status >= 200 && value.status < 300 });
}
