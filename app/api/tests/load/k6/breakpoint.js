/**
 * breakpoint.js
 *
 * Aumenta gradualmente o tráfego para achar capacidade sem limiter. Só deve
 * rodar contra uma instância reiniciada com RATE_LIMIT_ENABLED=false.
 */

import http from 'k6/http';
import { check } from 'k6';
import { baseUrl, bearer, metricsThresholds, record } from './common.js';

export const options = {
  scenarios: {
    breakpoint: {
      executor: 'ramping-arrival-rate',
      startRate: 0.5,
      timeUnit: '1s',
      preAllocatedVUs: 5,
      maxVUs: 40,
      stages: [
        { target: 1, duration: '20s' }, { target: 2, duration: '20s' }, { target: 3, duration: '20s' },
        { target: 5, duration: '20s' }, { target: 8, duration: '20s' }, { target: 10, duration: '20s' },
        { target: 15, duration: '20s' },
      ],
    },
  },
  thresholds: { ...metricsThresholds, rate_limited_429: ['count==0'] },
};

export default function () {
  const response = http.get(`${baseUrl}/api/users/me`, bearer());
  record(response);
  check(response, { 'capacity não recebe 429': (value) => value.status !== 429 });
}
