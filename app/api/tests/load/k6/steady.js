/**
 * steady.js
 *
 * Mede tráfego autenticado estável em /users/me. Consumido como baseline de
 * operação; TOKEN, RPS e DURATION entram por ambiente, nunca pelo arquivo.
 */

import http from 'k6/http';
import { check } from 'k6';
import { baseUrl, bearer, duration, metricsThresholds, record, rps } from './common.js';

export const options = {
  scenarios: {
    steady: { executor: 'constant-arrival-rate', rate: rps, timeUnit: '1s', duration, preAllocatedVUs: 5, maxVUs: 20 },
  },
  thresholds: metricsThresholds,
};

export default function () {
  const response = http.get(`${baseUrl}/api/users/me`, bearer());
  record(response);
  check(response, { 'steady aceita 2xx': (value) => value.status >= 200 && value.status < 300 });
}
