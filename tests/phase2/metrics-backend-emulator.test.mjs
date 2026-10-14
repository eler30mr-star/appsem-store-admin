/**
 * Prueba de integración: backend REAL de la tienda pública + Firebase Admin SDK
 * vs reglas candidatas de fase 2 en FIRESTORE EMULATOR (nunca datos reales).
 * El workflow clona el repo público en _store_phase2 para importar su código.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import {
  recordInteraction, getInteractionStatus, PublicError, keyedHash
} from '../../_store_phase2/server/metricsCore.js';

const projectId = 'demo-appsem-phase2-integration';
const secret = 'safety-fixture-integration-crypto-secret-98765';
const visitors = {
  like: '9650c011-76c4-4eac-bd95-5cb2ba30c899',
  rating: 'b251d6fc-14af-4a41-acb9-78054ea11300',
  download: '11979681-3eaa-45f3-9da5-3a0a74ee0d4b'
};
const token = 'fake-token-only-emulator-fixture';
const appId = 'integrated-app';
const url = 'https://play.google.com/store/apps/details?id=example.official';

test('Integración real del backend con reglas estrictas e historial', async (t) => {
  assert.match(process.env.FIRESTORE_EMULATOR_HOST || '', /^(127\.0\.0\.1|localhost):8080$/);
  const rules = readFileSync(new URL('../../docs/fase-02/firestore.hardened.rules', import.meta.url), 'utf8');
  const app = initializeApp({ projectId }, 'phase2-integration-fixture');
  const db = getFirestore(app);
  const env = await initializeTestEnvironment({
    projectId, firestore: { host: '127.0.0.1', port: 8080, rules }
  });
  const publishedRef = db.doc('apps/' + appId);
  const anon = () => env.unauthenticatedContext().firestore();
  const admin = () => env.authenticatedContext('test-admin', {
    email: 'eler30.mr@gmail.com', email_verified: true
  }).firestore();
  const params = (action, visitorId, extra = {}) => ({
    db, FieldValue, payload: { appId, action, visitorId, turnstileToken: token, ...extra },
    ip: '198.51.100.21', secret, now: 1700000000000
  });
  try {
    await env.clearFirestore();
    await publishedRef.set({
      title: 'App de prueba, NO producción', status: 'published',
      likesCount: 0, downloadsCount: 0, ratingCount: 0,
      ratingAverage: 0, ratingSum: 0, playStoreUrl: url
    });
    await db.doc('apps/draft').set({
      title: 'Borrador', status: 'draft', likesCount: 0
    });
    await t.test('El cliente no puede crear eventos ni falsificar métricas', async () => {
      await assertFails(setDoc(doc(anon(), 'apps', appId, 'likes', 'forged'), {
        createdAt: serverTimestamp()
      }));
      await assertFails(updateDoc(doc(anon(), 'apps', appId), {
        likesCount: increment(1), metricsUpdatedAt: serverTimestamp()
      }));
      await assertFails(getDoc(doc(anon(), 'apps', appId, 'ratings', 'guessed')));
      await assertSucceeds(getDoc(doc(anon(), 'apps', appId)));
      await assertFails(getDoc(doc(anon(), 'apps', 'draft')));
    });
    await t.test('Backend registra like solo una vez y transaccionalmente', async () => {
      const req = params('like', visitors.like);
      const outcome = await recordInteraction(req);
      assert.equal(outcome.alreadyRecorded, false);
      assert.equal((await recordInteraction(req)).alreadyRecorded, true);
      assert.equal((await publishedRef.get()).data().likesCount, 1);
      const eventId = keyedHash(secret, 'visitor', visitors.like);
      assert.equal((await db.doc('apps/' + appId + '/likes/' + eventId).get()).exists, true);
      assert.equal((await getInteractionStatus({
        db, appId, visitorId: visitors.like, secret
      })).liked, true);
    });
    await t.test('Backend registra rating sin duplicado, con suma y media', async () => {
      const req = params('rating', visitors.rating, { rating: 5 });
      assert.equal((await recordInteraction(req)).ratingAverage, 5);
      assert.equal((await recordInteraction(req)).alreadyRecorded, true);
      const appData = (await publishedRef.get()).data();
      assert.equal(appData.ratingCount, 1);
      assert.equal(appData.ratingAverage, 5);
      assert.equal(appData.ratingSum, 5);
      const ratingRef = db.doc('apps/' + appId + '/ratings/' +
        keyedHash(secret, 'visitor', visitors.rating));
      assert.equal((await ratingRef.get()).data().rating, 5);
      await assertFails(getDoc(doc(anon(), ratingRef.path)));
      await assertSucceeds(getDoc(doc(admin(), ratingRef.path)));
    });
    await t.test('Backend registra una descarga por ventana, sin URL modificada', async () => {
      const req = params('download', visitors.download, { targetUrl: url });
      const first = await recordInteraction(req);
      assert.equal(first.alreadyRecorded, false);
      assert.equal((await recordInteraction(req)).alreadyRecorded, true);
      assert.equal((await publishedRef.get()).data().downloadsCount, 1);
      await assert.rejects(recordInteraction({
        ...req, payload: { ...req.payload, targetUrl: 'https://no-autorizado.example.com' },
        now: req.now + 1000
      }), error => error instanceof PublicError && error.status === 400);
      assert.equal((await publishedRef.get()).data().downloadsCount, 1);
      assert.equal((await recordInteraction(req)).alreadyRecorded, true);
    });
    await t.test('Borradores no reciben interacciones por el backend', async () => {
      await assert.rejects(recordInteraction({
        ...params('like', '4f1d9b2f-b84f-41c8-862f-37b5802c738e'),
        payload: { ...params('like', visitors.like).payload, appId: 'draft' }
      }), error => error instanceof PublicError && error.status === 404);
      assert.equal((await db.doc('apps/draft').get()).data().likesCount, 0);
    });
    await t.test('Comentarios: backend crea pendiente, evita duplicados y reglas niegan acceso público', async () => {
      const commentReq = params('comment', 'b673698f-9402-4f6e-a0d2-454d55b10231',
        { name: 'María', comment: 'Esta aplicación funciona correctamente.' });
      assert.equal((await recordInteraction(commentReq)).alreadyRecorded, false);
      assert.equal((await recordInteraction(commentReq)).alreadyRecorded, true);
      const list = await db.collection('apps').doc(appId).collection('comments').get();
      assert.equal(list.size, 1);
      const pending = list.docs[0];
      assert.equal(pending.data().approved, false);
      await assertFails(getDoc(doc(anon(), pending.ref.path)));
      await assertFails(setDoc(doc(anon(), 'apps', appId, 'comments', 'public-injected'), {
        name: 'Otro', comment: 'No debe publicarse directamente', approved: false,
        createdAt: serverTimestamp()
      }));
      await assertSucceeds(getDoc(doc(admin(), pending.ref.path)));
    });
    await t.test('No se duplican interacciones históricas antes del corte', async () => {
      const legacy = 'aa4bb31f-774e-413c-b7db-44d0ce90ec2e';
      await db.doc('apps/' + appId + '/likes/' + legacy).set({ createdAt: FieldValue.serverTimestamp() });
      assert.equal((await recordInteraction(params('like', legacy))).alreadyRecorded, true);
      assert.equal((await publishedRef.get()).data().likesCount, 1);
    });
  } finally {
    await env.cleanup();
    await deleteApp(app);
  }
});
