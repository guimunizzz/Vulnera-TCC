/**
 * common.js
 *
 * Funções compartilhadas dos cenários k6. Impede execução remota acidental e
 * separa respostas aceitas, 429, 5xx e timeouts nos relatórios de carga.
 */

import { Counter, Trend } from 'k6/metrics';

export const accepted2xx = new Counter('accepted_2xx');
export const rateLimited429 = new Counter('rate_limited_429');
export const app5xx = new Counter('app_5xx');
export const timeouts = new Counter('timeouts');
export const acceptedLatency = new Trend('latency_accepted');
export const limitedLatency = new Trend('latency_rate_limited');

const localBaseUrl = 'http://localhost:3001';
const candidate = __ENV.LOAD_TEST_BASE_URL || __ENV.BASE_URL || localBaseUrl;
const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(?:\/|$)/.test(candidate);

if (!isLocal && __ENV.ALLOW_REMOTE_LOAD_TEST !== 'true') {
  throw new Error('Execução remota bloqueada. Defina ALLOW_REMOTE_LOAD_TEST=true conscientemente.');
}

export const baseUrl = candidate.replace(/\/$/, '');
export const duration = __ENV.DURATION || '20s';
export const rps = Number(__ENV.RPS || '1');

export function bearer(tokenName = 'TOKEN') {
  const token = __ENV[tokenName];
  if (!token) throw new Error(`Defina ${tokenName} sem gravá-lo no script.`);
  return { headers: { Authorization: `Bearer ${token}` } };
}

export function record(response) {
  if (response.status >= 200 && response.status < 300) {
    accepted2xx.add(1);
    acceptedLatency.add(response.timings.duration);
  } else if (response.status === 429) {
    rateLimited429.add(1);
    limitedLatency.add(response.timings.duration);
  } else if (response.status >= 500) {
    app5xx.add(1);
  }
  if (response.error_code === 1050 || response.error_code === 1211) timeouts.add(1);
}

export const metricsThresholds = {
  app_5xx: ['count<1'],
  timeouts: ['count<1'],
  latency_accepted: ['p(95)<500', 'p(99)<1000'],
};
