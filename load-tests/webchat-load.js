import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1s', target: 1 },
  ],
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const initRes = http.post(`${BASE_URL}/api/webchat/init`, JSON.stringify({
    publicKey: 'pk_test',
    initChallenge: 'challenge_123'
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(initRes, {
    'status is 200 or 404': (r) => r.status === 200 || r.status === 404,
  });
}
