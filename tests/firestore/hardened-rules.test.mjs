/**
 * Fase 2 — pruebas de las reglas ENDURECIDAS, solo Emulator Suite.
 * NO se aplican a Firestore de producción y NO reemplazan pruebas históricas.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, increment } from 'firebase/firestore';

const projectId = 'demo-appsem-phase1';
if (!/^(127\.0\.0\.1|localhost):8080$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) {
  throw new Error('SOLO Firestore Emulator puerto 8080.');
}
const rules = readFileSync(new URL('../../docs/fase-02/firestore.hardened.rules', import.meta.url), 'utf8');
const published = { title: 'App', status: 'published', likesCount: 2,
  ratingAverage: 4, ratingCount: 1, downloadsCount: 8 };
const adminEmail = 'eler30.mr@gmail.com';

test('Fase 2 — reglas preparadas para backend confiable', async (t) => {
  const env = await initializeTestEnvironment({
    projectId, firestore: { host: '127.0.0.1', port: 8080, rules }
  });
  const reset = async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'apps', 'pub'), published);
      await setDoc(doc(db, 'apps', 'draft'), { ...published, status: 'draft' });
      await setDoc(doc(db, 'apps', 'pub', 'comments', 'approved'), {
        name: 'Ana', comment: 'Contenido válido', approved: true, createdAt: serverTimestamp()
      });
      await setDoc(doc(db, 'apps', 'pub', 'comments', 'pending'), {
        name: 'Ana', comment: 'Pendiente de revisión', approved: false, createdAt: serverTimestamp()
      });
    });
  };
  const anon = () => env.unauthenticatedContext().firestore();
  const admin = (verified = true) => env.authenticatedContext('admin', {
    email: adminEmail, email_verified: verified
  }).firestore();
  const impostor = () => env.authenticatedContext('impostor', {
    email: 'outsider@example.com', email_verified: true
  }).firestore();
  const ref = (db, app = 'pub') => doc(db, 'apps', app);
  try {
    await t.test('Anon puede leer publicada, no borrador; admin verificado puede leer ambas', async () => {
      await reset();
      await assertSucceeds(getDoc(ref(anon())));
      await assertFails(getDoc(ref(anon(), 'draft')));
      await assertSucceeds(getDoc(ref(admin(), 'draft')));
    });
    await t.test('Admin verificado puede modificar; sin email_verified no puede', async () => {
      await reset();
      await assertSucceeds(updateDoc(ref(admin(), 'draft'), { title: 'Edición válida' }));
      await assertFails(updateDoc(ref(admin(false), 'draft'), { title: 'No autorizado' }));
      await assertFails(getDoc(ref(admin(false), 'draft')));
    });
    await t.test('Correo ajeno no es admin, aunque está verificado', async () => {
      await reset();
      await assertFails(updateDoc(ref(impostor(), 'draft'), { title: 'Intrusión' }));
      await assertFails(getDoc(ref(impostor(), 'draft')));
      await assertFails(deleteDoc(ref(impostor())));
    });
    await t.test('Se niega cualquier incremento de likes sin backend', async () => {
      await reset();
      await assertFails(updateDoc(ref(anon()), {
        likesCount: increment(1), metricsUpdatedAt: serverTimestamp()
      }));
      await assertFails(updateDoc(ref(impostor()), {
        likesCount: increment(1), metricsUpdatedAt: serverTimestamp()
      }));
    });
    await t.test('Se niegan descargas y promedio de valoraciones alterados', async () => {
      await reset();
      await assertFails(updateDoc(ref(anon()), {
        downloadsCount: increment(1), metricsUpdatedAt: serverTimestamp()
      }));
      await assertFails(updateDoc(ref(anon()), {
        ratingCount: increment(1), ratingAverage: 5, metricsUpdatedAt: serverTimestamp()
      }));
    });
    await t.test('Público no puede crear ni editar apps', async () => {
      await reset();
      await assertFails(setDoc(ref(anon(), 'nueva'), published));
      await assertFails(updateDoc(ref(anon()), { status: 'draft' }));
      await assertFails(deleteDoc(ref(anon())));
      await assertSucceeds(setDoc(ref(admin(), 'admin-added'), { title: 'Nueva', status: 'draft' }));
    });
    await t.test('IDs de visitante: likes y ratings no son legibles para terceros', async () => {
      await reset();
      await env.withSecurityRulesDisabled(async ctx => {
        await setDoc(doc(ctx.firestore(), 'apps', 'pub', 'likes', 'id-heredado'), { createdAt: serverTimestamp() });
        await setDoc(doc(ctx.firestore(), 'apps', 'pub', 'ratings', 'id-heredado'), {
          rating: 4, createdAt: serverTimestamp()
        });
      });
      await assertFails(getDoc(doc(anon(), 'apps', 'pub', 'likes', 'id-heredado')));
      await assertFails(getDoc(doc(anon(), 'apps', 'pub', 'ratings', 'id-heredado')));
      await assertFails(getDoc(doc(impostor(), 'apps', 'pub', 'likes', 'id-heredado')));
      await assertSucceeds(getDoc(doc(admin(), 'apps', 'pub', 'likes', 'id-heredado')));
    });
    await t.test('Publicación de like sin backend está bloqueada', async () => {
      await reset();
      await assertFails(setDoc(doc(anon(), 'apps', 'pub', 'likes', 'arbitrario'), { createdAt: serverTimestamp() }));
      await assertSucceeds(setDoc(doc(admin(), 'apps', 'pub', 'likes', 'administrado'), { createdAt: serverTimestamp() }));
    });
    await t.test('Publicación de rating sin backend está bloqueada', async () => {
      await reset();
      await assertFails(setDoc(doc(anon(), 'apps', 'pub', 'ratings', 'arbitrario'), {
        rating: 5, createdAt: serverTimestamp()
      }));
    });
    await t.test('Registro de descarga falso no puede crearse desde el navegador', async () => {
      await reset();
      await assertFails(setDoc(doc(anon(), 'apps', 'pub', 'downloadClicks', 'falso'), {
        targetUrl: 'javascript:alert(1)', createdAt: serverTimestamp()
      }));
    });
    await t.test('Visitante puede publicar comentario pendiente con esquema correcto', async () => {
      await reset();
      await assertSucceeds(setDoc(doc(anon(), 'apps', 'pub', 'comments', 'nuevo'), {
        name: 'Ana', comment: 'Comentario permitido', approved: false, createdAt: serverTimestamp()
      }));
    });
    await t.test('Visitante no puede autoaprobar comentarios', async () => {
      await reset();
      await assertFails(setDoc(doc(anon(), 'apps', 'pub', 'comments', 'falso'), {
        name: 'Ana', comment: 'Contenido válido', approved: true, createdAt: serverTimestamp()
      }));
      await assertFails(updateDoc(doc(anon(), 'apps', 'pub', 'comments', 'pending'), {
        approved: true
      }));
      await assertSucceeds(updateDoc(doc(admin(), 'apps', 'pub', 'comments', 'pending'), {
        approved: true
      }));
    });
    await t.test('Visitante solo lee comentarios aprobados y publicados', async () => {
      await reset();
      await assertSucceeds(getDoc(doc(anon(), 'apps', 'pub', 'comments', 'approved')));
      await assertFails(getDoc(doc(anon(), 'apps', 'pub', 'comments', 'pending')));
      await assertSucceeds(getDoc(doc(admin(), 'apps', 'pub', 'comments', 'pending')));
    });
    await t.test('No se puede comentar en borradores, ni con contenido inválido', async () => {
      await reset();
      await assertFails(setDoc(doc(anon(), 'apps', 'draft', 'comments', 'no'), {
        name: 'Ana', comment: 'Comentario válido', approved: false, createdAt: serverTimestamp()
      }));
      await assertFails(setDoc(doc(anon(), 'apps', 'pub', 'comments', 'bad'), {
        name: 'A', comment: 'Mal', approved: false, createdAt: serverTimestamp()
      }));
    });
    await t.test('No se puede leer ni escribir colección no autorizada', async () => {
      await reset();
      await assertFails(getDoc(doc(anon(), 'internal', 'secret')));
      await assertFails(setDoc(doc(admin(), 'internal', 'secret'), { key: 'secret' }));
    });
  } finally {
    await env.cleanup();
  }
});
