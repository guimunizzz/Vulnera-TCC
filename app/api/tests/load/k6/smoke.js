/**
 * smoke.js
 *
 * Smoke local de health e catálogo público. Consumido por quem valida que a
 * stack aceita tráfego básico antes dos cenários autenticados de capacidade.
 */

import http from 'k6/http';
import { check } from 'k6';
import { baseUrl, metricsThresholds, record } from './common.js';

export const options = { vus: 1, iterations: 3, thresholds: metricsThresholds };

export default function () {
  const health = http.get(`${baseUrl}/api/health`);
  const plans = http.get(`${baseUrl}/api/plans`);
  record(health);
  record(plans);
  check(health, { 'health 2xx': (response) => response.status >= 200 && response.status < 300 });
  check(plans, { 'plans 2xx': (response) => response.status >= 200 && response.status < 300 });
}
