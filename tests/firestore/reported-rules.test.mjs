/**
 * AUDITORÍA 1 / FASE 1 — Caracterización de reglas aportadas por el usuario.
 * No conecta con webs-8b1bf. Requiere FIRESTORE_EMULATOR_HOST y demo-*.
 * Los tests que permiten una operación insegura APUNTAN UN DEFECTO; no
 * significan que los permisos sean aceptables para producción.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, increment, serverTimestamp } from 'firebase/firestore';

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIRESTORE_EMULATOR_HOST.includes('8080')) {
  throw new Error('Solo se ejecuta dentro del Emulator Suite Firestore en puerto 8080.');
}
const projectId = 'demo-appsem-phase1';
const rules = readFileSync(new URL('../../docs/fase-01/FIRESTORE_REGLAS_REPORTADAS_2026-10-13.rules', import.meta.url), 'utf8');
const seed = { title: 'App de prueba', slug: 'app-de-prueba', status: 'published',
  likesCount: 0, downloadsCount: 0, ratingCount: 0, ratingSum: 0,
  ratingAverage: 0, commentsCount: 0 };
const adminEmail = 'eler30.mr@gmail.com';

test('Reglas aportadas — pruebas de caracterización en emulador, NO hardening', async (t) => {
  const env = await initializeTestEnvironment({
    projectId, firestore: { host: '127.0.0.1', port: 8080, rules }
  });
  try {
    const reset = async () => {
      await env.clearFirestore();
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'apps', 'public'), seed);
        await setDoc(doc(db, 'apps', 'draft'), { ...seed, status: 'draft' });
        await setDoc(doc(db, 'apps', 'public', 'comments', 'approved'), {
          name: 'Lector', comment: 'Gracias por compartir', approved: true,
          createdAt: serverTimestamp()
        });
        await setDoc(doc(db, 'apps', 'public', 'comments', 'pending'), {
          name: 'Lector', comment: 'Debe revisarse', approved: false,
          createdAt: serverTimestamp()
        });
      });
    };
    const anon = () => env.unauthenticatedContext().firestore();
    const admin = (verified = true) => env.authenticatedContext(
      'administrador', { email: adminEmail, email_verified: verified }
    ).firestore();
    const outsider = () => env.authenticatedContext(
      'tercero', { email: 'tercero@example.com', email_verified: true }
    ).firestore();

    await t.test('LECTURA: anónimo ve publicadas y no borradores', async () => {
      await reset();
      await assertSucceeds(getDoc(doc(anon(), 'apps', 'public')));
      await assertFails(getDoc(doc(anon(), 'apps', 'draft')));
    });
    await t.test('ADMIN: correo autorizado edita borrador', async () => {
      await reset();
      await assertSucceeds(updateDoc(doc(admin(), 'apps', 'draft'), { title: 'Editada' }));
    });
    await t.test('ADMIN: correo ajeno no edita borrador', async () => {
      await reset();
      await assertFails(updateDoc(doc(outsider(), 'apps', 'draft'), { title: 'Intrusión' }));
    });
    await t.test('ADMIN SEC-02: correo autorizado sin verificación todavía puede editar (riesgo)', async () => {
      await reset();
      await assertSucceeds(updateDoc(doc(admin(false), 'apps', 'draft'), { title: 'Acceso sin verificación' }));
    });
    await t.test('PROTECCIÓN: anónimo no edita nombre ni estado', async () => {
      await reset();
      await assertFails(updateDoc(doc(anon(), 'apps', 'public'), { title: 'Cambiada' }));
      await assertFails(updateDoc(doc(anon(), 'apps', 'public'), { status: 'draft' }));
    });
    await t.test('PROTECCIÓN: anónimo no elimina ni crea app', async () => {
      await reset();
      await assertFails(deleteDoc(doc(anon(), 'apps', 'public')));
      await assertFails(setDoc(doc(anon(), 'apps', 'nueva'), seed));
    });
    await t.test('SEC-01: contador de likes sube 2 veces anónimamente sin documento like', async () => {
      await reset();
      const ref = doc(anon(), 'apps', 'public');
      await assertSucceeds(updateDoc(ref, { likesCount: increment(1), metricsUpdatedAt: serverTimestamp() }));
      await assertSucceeds(updateDoc(ref, { likesCount: increment(1), metricsUpdatedAt: serverTimestamp() }));
      const result = await assertSucceeds(getDoc(ref));
      assert.equal(result.data().likesCount, 2);
    });
    await t.test('SEC-01: contador de descargas crece sin crear downloadClicks', async () => {
      await reset();
      await assertSucceeds(updateDoc(doc(anon(), 'apps', 'public'), {
        downloadsCount: increment(1), metricsUpdatedAt: serverTimestamp()
      }));
    });
    await t.test('SEC-01: promedio 5 arbitrario aceptado sin documento rating', async () => {
      await reset();
      const ref = doc(anon(), 'apps', 'public');
      await assertSucceeds(updateDoc(ref, {
        ratingCount: increment(1), ratingAverage: 5, metricsUpdatedAt: serverTimestamp()
      }));
      const result = await assertSucceeds(getDoc(ref));
      assert.equal(result.data().ratingAverage, 5);
    });
    await t.test('METRICS: rechaza timestamp no establecido por servidor', async () => {
      await reset();
      await assertFails(updateDoc(doc(anon(), 'apps', 'public'), {
        likesCount: increment(1), metricsUpdatedAt: '2026-10-13T00:00:00Z'
      }));
    });
    await t.test('PUBLICACIÓN: downloadClicks acepta registro anónimo correcto', async () => {
      await reset();
      await assertSucceeds(setDoc(doc(anon(), 'apps', 'public', 'downloadClicks', 'a'), {
        targetUrl: 'https://play.google.com/store/apps/details?id=demo',
        createdAt: serverTimestamp()
      }));
    });
    await t.test('URL: reglas aceptan targetUrl sin protocolo permitido (riesgo)', async () => {
      await reset();
      await assertSucceeds(setDoc(doc(anon(), 'apps', 'public', 'downloadClicks', 'b'), {
        targetUrl: 'javascript:alert(1)',
        createdAt: serverTimestamp()
      }));
    });
    await t.test('LIKES: puede crear documento like con ID no ligado a autenticación', async () => {
      await reset();
      await assertSucceeds(setDoc(doc(anon(), 'apps', 'public', 'likes', 'arbitrario'), {
        createdAt: serverTimestamp()
      }));
    });
    await t.test('COMENTARIOS: se acepta pendiente, pero no aprobado creado por público', async () => {
      await reset();
      await assertSucceeds(setDoc(doc(anon(), 'apps', 'public', 'comments', 'nuevo'), {
        name: 'Lector', comment: 'Comentario válido', approved: false, createdAt: serverTimestamp()
      }));
      await assertFails(setDoc(doc(anon(), 'apps', 'public', 'comments', 'falso'), {
        name: 'Lector', comment: 'Comentario válido', approved: true, createdAt: serverTimestamp()
      }));
    });
    await t.test('COMENTARIOS: lectura pública solo aprobados', async () => {
      await reset();
      await assertSucceeds(getDoc(doc(anon(), 'apps', 'public', 'comments', 'approved')));
      await assertFails(getDoc(doc(anon(), 'apps', 'public', 'comments', 'pending')));
    });
    await t.test('COMENTARIOS: visitante no modera; admin sí', async () => {
      await reset();
      await assertFails(updateDoc(doc(anon(), 'apps', 'public', 'comments', 'pending'), {
        approved: true
      }));
      await assertSucceeds(updateDoc(doc(admin(), 'apps', 'public', 'comments', 'pending'), {
        approved: true
      }));
    });
    await t.test('BORRADOR: visitante no registra interacciones en app no publicada', async () => {
      await reset();
      await assertFails(setDoc(doc(anon(), 'apps', 'draft', 'downloadClicks', 'c'), {
        targetUrl: 'https://play.google.com/', createdAt: serverTimestamp()
      }));
      await assertFails(updateDoc(doc(anon(), 'apps', 'draft'), {
        likesCount: increment(1), metricsUpdatedAt: serverTimestamp()
      }));
    });
  } finally {
    await env.cleanup();
  }
});
