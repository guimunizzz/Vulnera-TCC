/**
 * rate-limit.js
 *
 * Confirma comportamento abaixo e acima do limite global em endpoint público.
 * MODE=below usa 1 RPS; MODE=above usa 10 RPS, ambos contra ambiente local.
 */

import http from 'k6/http';
import { check } from 'k6';
import { baseUrl, duration, metricsThresholds, record } from './common.js';

const above = (__ENV.MODE || 'below') === 'above';
export const options = {
  scenarios: {
    configuredRate: {
      executor: 'constant-arrival-rate', rate: Number(__ENV.RPS || (above ? '10' : '1')),
      timeUnit: '1s', duration, preAllocatedVUs: 5, maxVUs: 30,
    },
  },
  thresholds: above
    ? { ...metricsThresholds, rate_limited_429: ['count>0'] }
    : { ...metricsThresholds, rate_limited_429: ['count==0'] },
};

export default function () {
  const response = http.get(`${baseUrl}/api/plans`);
  record(response);
  check(response, { 'resposta é 2xx ou 429 esperado': (value) => value.status === 429 || (value.status >= 200 && value.status < 300) });
}
