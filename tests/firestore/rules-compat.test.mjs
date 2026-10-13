/**
 * FASE 1 — Pruebas de caracterización, no parches de seguridad.
 * Solo trabaja contra Emulator Suite con projectId ficticio 'demo-*'.
 * Se cargan de forma secuencial las dos versiones de reglas.
 * La prueba que demuestra un contador público manipulable debe APROBAR
 * porque documenta el comportamiento vulnerable actual; no certifica seguridad.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, increment, serverTimestamp
} from 'firebase/firestore';

const projectId = 'demo-appsem-phase1';
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Este test exige FIRESTORE_EMULATOR_HOST y no puede usar producción.');
}

const adminRules = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
const publicRules = readFileSync(new URL('./fixtures/public-firestore.rules', import.meta.url), 'utf8');
const appData = {
  title: 'Ejemplo ficticio',
  status: 'published',
  slug: 'ejemplo',
  likesCount: 0,
  downloadsCount: 0,
  ratingCount: 0,
  ratingSum: 0,
  ratingAverage: 0,
  commentsCount: 0
};

test('Fase 1: comportamientos reales de cada versión de reglas EN EMULADOR', async (t) => {
  let env = null;
  try {
    async function reset(rules) {
      if (env) await env.cleanup();
      env = await initializeTestEnvironment({
        projectId,
        firestore: { host: '127.0.0.1', port: 8080, rules }
      });
      await env.clearFirestore();
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'apps', 'public'), { ...appData });
        await setDoc(doc(db, 'apps', 'hidden'), { ...appData, status: 'draft' });
      });
    }
    const anon = () => env.unauthenticatedContext().firestore();
    const user = (email, verified = true) => env.authenticatedContext('uid-user', {
      email,
      email_verified: verified
    }).firestore();

    await t.test('admin-rules: visitante lee publicadas, NO borradores', async () => {
      await reset(adminRules);
      await assertSucceeds(getDoc(doc(anon(), 'apps', 'public')));
      await assertFails(getDoc(doc(anon(), 'apps', 'hidden')));
    });
    await t.test('admin-rules: visitante no edita título ni crea apps', async () => {
      await reset(adminRules);
      await assertFails(updateDoc(doc(anon(), 'apps', 'public'), {title:'intruso'}));
      await assertFails(setDoc(doc(anon(), 'apps', 'inventada'), {title:'intruso'}));
    });
    await t.test('admin-rules: correo no autorizado NO administra borradores', async () => {
      await reset(adminRules);
      await assertFails(updateDoc(doc(user('otro@example.com'), 'apps', 'hidden'), {title:'intruso'}));
      await assertSucceeds(updateDoc(doc(user('eler30.mr@gmail.com'), 'apps', 'hidden'), {title:'autorizado'}));
    });
    await t.test('admin-rules: prueba de caracterización SEC-01 — contador anónimo manipulable', async () => {
      await reset(adminRules);
      await assertSucceeds(updateDoc(doc(anon(), 'apps', 'public'), {
        likesCount: increment(1), updatedAt: serverTimestamp()
      }));
      const snapshot = await assertSucceeds(getDoc(doc(anon(), 'apps', 'public')));
      assert.equal(snapshot.data().likesCount, 1);
    });
    await t.test('admin-rules: no admite downloadClicks del cliente público', async () => {
      await reset(adminRules);
      await assertFails(setDoc(doc(anon(), 'apps', 'public', 'downloadClicks', 'click01'), {
        targetUrl: 'https://play.google.com/store/apps/details?id=test', createdAt: serverTimestamp()
      }));
    });

    await t.test('public-rules: visitante lee públicas pero no borradores', async () => {
      await reset(publicRules);
      await assertSucceeds(getDoc(doc(anon(), 'apps', 'public')));
      await assertFails(getDoc(doc(anon(), 'apps', 'hidden')));
    });
    await t.test('public-rules: correo Admin antiguo no administra borradores', async () => {
      await reset(publicRules);
      await assertFails(updateDoc(doc(user('eler30.mr@gmail.com'), 'apps', 'hidden'), {title:'bloqueado'}));
      await assertSucceeds(updateDoc(doc(user('ceo.developer.appsem@gmail.com'), 'apps', 'hidden'), {title:'permitido'}));
    });
    await t.test('public-rules: admite downloadClicks de la tienda pública', async () => {
      await reset(publicRules);
      await assertSucceeds(setDoc(doc(anon(), 'apps', 'public', 'downloadClicks', 'click01'), {
        targetUrl: 'https://play.google.com/store/apps/details?id=test', createdAt: serverTimestamp()
      }));
    });
    await t.test('public-rules: conserva la posibilidad de incrementar métricas anónimamente', async () => {
      await reset(publicRules);
      await assertSucceeds(updateDoc(doc(anon(), 'apps', 'public'), {
        likesCount: increment(1), metricsUpdatedAt: serverTimestamp()
      }));
    });
    await t.test('public-rules: rechaza actualización con timestamp de Admin', async () => {
      await reset(publicRules);
      await assertFails(updateDoc(doc(anon(), 'apps', 'public'), {
        likesCount: increment(1), updatedAt: serverTimestamp()
      }));
    });
  } finally {
    if (env) await env.cleanup();
  }
});
