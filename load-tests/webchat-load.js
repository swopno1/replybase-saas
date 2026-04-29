import http from 'k6/http';
import { check, sleep, group } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 }, // ramp up to 20 users
    { duration: '1m', target: 20 },  // stay at 20 users
    { duration: '30s', target: 0 },  // ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
    http_req_failed: ['rate<0.01'],   // error rate should be less than 1%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  group('Webchat User Journey', function () {
    // 1. Init
    const initRes = http.post(`${BASE_URL}/api/webchat/init`, JSON.stringify({
      publicKey: 'pk_test',
      initChallenge: 'challenge_123'
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

    const initSuccess = check(initRes, {
      'init status is 200': (r) => r.status === 200,
    });

    if (!initSuccess) return;

    const sessionData = initRes.json();
    const token = sessionData.token;
    const conversationId = sessionData.conversationId;

    sleep(1);

    // 2. Send Message
    const msgRes = http.post(`${BASE_URL}/api/webchat/message`, JSON.stringify({
      token: token,
      conversationId: conversationId,
      message: 'Hello, this is a load test message',
      botId: 'bot_1'
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

    check(msgRes, {
      'message status is 200': (r) => r.status === 200,
    });

    sleep(2);

    // 3. Poll for messages
    const pollRes = http.get(`${BASE_URL}/api/webchat/messages?token=${token}&conversationId=${conversationId}`);

    check(pollRes, {
      'poll status is 200': (r) => r.status === 200,
    });
  });

  sleep(1);
}
