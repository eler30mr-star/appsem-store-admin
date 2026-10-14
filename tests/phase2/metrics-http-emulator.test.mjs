/**
 * API HTTP real de la tienda + Firestore Admin SDK + Turnstile simulado.
 * Únicamente Firebase Emulator y una cuenta demo. No se contacta Cloudflare.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import handler from '../../_store_phase2/api/interaction.js';

const id = 'demo-appsem-phase2-integration';
if (!/^(localhost|127\.0\.0\.1):8080$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) {
  throw new Error('Esta prueba exige Firebase Emulator local 8080.');
}
const origin = 'https://appsem-store.vercel.app';
const secret = 'this-is-a-synthetic-HMAC-key-only-for-tests';
const visitor = '9cad8af9-9571-48c2-91ee-59ff56ed3d41';
const appId = 'http-app';
const googlePlay = 'https://play.google.com/store/apps/details?id=demo.example';

function response() {
  return {
    headers: {},
    statusCode: 200,
    body: null,
    setHeader(name, val) { this.headers[name] = val; return this; },
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; }
  };
}
function request(method, { body = null, query = {}, originHeader = origin,
    contentType = 'application/json', size, ip = '198.51.100.11' } = {}) {
  const headers = { 'x-vercel-forwarded-for': ip };
  if (originHeader !== null) headers.origin = originHeader;
  if (method === 'POST') {
    headers['content-type'] = contentType;
    headers['content-length'] = String(size ?? Buffer.byteLength(JSON.stringify(body)));
  }
  return { method, headers, body, query };
}
async function invoke(req) {
  const res = response();
  await handler(req, res);
  return res;
}

test('Vercel HTTP: validación + captcha + operación con Admin SDK aislada', async (t) => {
  Object.assign(process.env, {
    METRICS_EMULATOR_TEST: 'true',
    METRICS_BACKEND_ENABLED: 'true',
    FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
    GCLOUD_PROJECT: id,
    PUBLIC_SITE_ORIGIN: origin,
    METRICS_HMAC_SECRET: secret,
    TURNSTILE_SECRET_KEY: 'fake-siteverify-secret-for-tests'
  });
  const app = initializeApp({ projectId: id }, 'http-route-emulator-seed');
  const db = getFirestore(app);
  const originalFetch = globalThis.fetch;
  const fake = { success: true, hostname: 'appsem-store.vercel.app', action: 'appsem-metrics' };
  const verifiedRequests = [];
  globalThis.fetch = async (endpoint, args) => {
    assert.equal(endpoint, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
    verifiedRequests.push(JSON.parse(args.body));
    return { ok: true, json: async () => fake };
  };
  const sample = {
    action: 'like', appId, visitorId: visitor, turnstileToken: 'test-anti-bot-token'
  };
  try {
    await db.doc('apps/' + appId).set({
      title: 'App ficticia', status: 'published', likesCount: 0,
      downloadsCount: 0, ratingCount: 0, ratingAverage: 0, ratingSum: 0,
      playStoreUrl: googlePlay
    });
    await t.test('POST válido crea exactamente 1 like; segundo POST queda duplicado', async () => {
      const first = await invoke(request('POST', { body: sample }));
      assert.equal(first.statusCode, 200);
      assert.deepEqual(first.body, { alreadyRecorded: false, action: 'like' });
      const second = await invoke(request('POST', { body: sample }));
      assert.equal(second.statusCode, 200);
      assert.equal(second.body.alreadyRecorded, true);
      assert.equal((await db.doc('apps/' + appId).get()).data().likesCount, 1);
      assert.equal(verifiedRequests.length, 2);
    });
    await t.test('GET devuelve estado sin emitir desafío', async () => {
      const before = verifiedRequests.length;
      const result = await invoke(request('GET', { query: { appId, visitorId: visitor } }));
      assert.equal(result.statusCode, 200);
      assert.deepEqual(result.body, { liked: true, rated: null });
      assert.equal(verifiedRequests.length, before);
    });
    await t.test('POST desde origen ajeno y con Content-Type inválido se rechaza', async () => {
      const cross = await invoke(request('POST', {
        body: { ...sample, action: 'rating', rating: 2 },
        originHeader: 'https://otro-host.example'
      }));
      assert.equal(cross.statusCode, 403);
      const wrong = await invoke(request('POST', {
        body: { ...sample, action: 'rating', rating: 2 },
        contentType: 'text/plain'
      }));
      assert.equal(wrong.statusCode, 415);
      const tooLarge = await invoke(request('POST', {
        body: { ...sample, action: 'rating', rating: 2 }, size: 99999
      }));
      assert.equal(tooLarge.statusCode, 413);
      assert.equal((await db.doc('apps/' + appId).get()).data().ratingCount, 0);
    });
    await t.test('Turnstile rechaza token inválido sin persistir rating', async () => {
      fake.success = false;
      const result = await invoke(request('POST', {
        body: { ...sample, action: 'rating', rating: 2 }
      }));
      assert.equal(result.statusCode, 403);
      fake.success = true;
      assert.equal((await db.doc('apps/' + appId).get()).data().ratingCount, 0);
    });
    await t.test('Rating válido usa API, actualiza promedio y registro de backend', async () => {
      const result = await invoke(request('POST', {
        body: { ...sample, action: 'rating', rating: 4 }
      }));
      assert.equal(result.statusCode, 200);
      assert.equal(result.body.ratingAverage, 4);
      const current = (await db.doc('apps/' + appId).get()).data();
      assert.equal(current.ratingCount, 1);
      assert.equal(current.ratingSum, 4);
    });
    await t.test('Descargas inválidas rechazadas, destino real permitido', async () => {
      const bad = await invoke(request('POST', {
        body: { ...sample, action: 'download', targetUrl: 'https://otro-host.example/apk' }
      }));
      assert.equal(bad.statusCode, 400);
      const valid = await invoke(request('POST', {
        body: { ...sample, action: 'download', targetUrl: googlePlay }
      }));
      assert.equal(valid.statusCode, 200);
      assert.equal((await db.doc('apps/' + appId).get()).data().downloadsCount, 1);
    });
    await t.test('El endpoint sigue inactivo sin METRICS_BACKEND_ENABLED', async () => {
      process.env.METRICS_BACKEND_ENABLED = 'false';
      try {
        const result = await invoke(request('GET', { query: { appId, visitorId: visitor } }));
        assert.equal(result.statusCode, 503);
      } finally {
        process.env.METRICS_BACKEND_ENABLED = 'true';
      }
    });
  } finally {
    globalThis.fetch = originalFetch;
    await deleteApp(app);
    for (const key of [
      'METRICS_EMULATOR_TEST', 'METRICS_BACKEND_ENABLED', 'GCLOUD_PROJECT',
      'PUBLIC_SITE_ORIGIN', 'METRICS_HMAC_SECRET', 'TURNSTILE_SECRET_KEY'
    ]) delete process.env[key];
  }
});
