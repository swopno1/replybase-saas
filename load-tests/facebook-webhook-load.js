import http from 'k6/http';
import { check, sleep, group } from 'k6';
import crypto from 'k6/crypto';

export const options = {
  stages: [
    { duration: '15s', target: 50 }, // ramp up to 50 concurrent requests
    { duration: '30s', target: 50 },  // hold at 50
    { duration: '15s', target: 0 },  // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'], // Webhooks must respond fast (under 200ms usually)
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const APP_SECRET = __ENV.FACEBOOK_CLIENT_SECRET || 'test_secret';

export default function () {
  const payload = JSON.stringify({
    object: "page",
    entry: [
      {
        id: "PAGE_ID_123",
        time: Date.now(),
        messaging: [
          {
            sender: { id: `USER_${__VU}_${__ITER}` },
            recipient: { id: "PAGE_ID_123" },
            message: { mid: `mid.${Date.now()}`, text: "load test message" }
          }
        ]
      }
    ]
  });

  const signature = crypto.hmac('sha256', APP_SECRET, payload, 'hex');

  const res = http.post(`${BASE_URL}/api/facebook/webhook`, payload, {
    headers: { 
      'Content-Type': 'application/json',
      'X-Hub-Signature-256': `sha256=${signature}`
    },
  });

  check(res, {
    'webhook status is 200': (r) => r.status === 200,
  });

  sleep(0.1);
}
