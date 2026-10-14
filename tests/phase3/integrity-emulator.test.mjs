import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, getDocs, query, collection, where, serverTimestamp } from 'firebase/firestore';
import {
  moderateCommentAtomic, archiveAppAtomic, restoreAppAtomic, updatePublicationAtomic
} from '../../src/services/phase3Transactions.js';

if (!['127.0.0.1:8080', 'localhost:8080'].includes(process.env.FIRESTORE_EMULATOR_HOST)) {
  throw Error('SOLO Firebase Emulator local; producción no está permitida.');
}

const rules = readFileSync(new URL('../../docs/fase-02/firestore.hardened.rules', import.meta.url), 'utf8');

test('Fase 3: integridad transaccional y archivado reversible, solo Emulator', async (t) => {
  const env = await initializeTestEnvironment({
    projectId: 'demo-appsem-phase3',
    firestore: { host: '127.0.0.1', port: 8080, rules }
  });
  const admin = () => env.authenticatedContext('admin-verified', {
    email: 'eler30.mr@gmail.com', email_verified: true
  }).firestore();
  const guest = () => env.unauthenticatedContext().firestore();

  async function reset(count = 0, approvals = { first: false, second: false }) {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async ctx => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'apps', 'sample'), {
        title: 'Demo', slug: 'demo', status: 'published',
        featured: true, commentsCount: count, likesCount: 4, ratingCount: 2,
        ratingSum: 9, ratingAverage: 4.5, downloadsCount: 5,
        createdAt: serverTimestamp()
      });
      await setDoc(doc(db, 'apps', 'sample', 'comments', 'first'), {
        name: 'Ana', comment: 'Comentario primero',
        approved: approvals.first, createdAt: serverTimestamp()
      });
      await setDoc(doc(db, 'apps', 'sample', 'comments', 'second'), {
        name: 'Luis', comment: 'Comentario segundo',
        approved: approvals.second, createdAt: serverTimestamp()
      });
      await setDoc(doc(db, 'apps', 'sample', 'likes', 'visitor-x'), {
        createdAt: serverTimestamp()
      });
      await setDoc(doc(db, 'apps', 'sample', 'ratings', 'visitor-x'), {
        rating: 5, createdAt: serverTimestamp()
      });
      await setDoc(doc(db, 'apps', 'sample', 'downloadClicks', 'visitor-x'), {
        targetUrl: 'https://play.google.com/store/apps/details?id=sample',
        createdAt: serverTimestamp()
      });
    });
  }
  const comment = id => ({ appId: 'sample', id });

  try {
    await t.test('Aprobar dos veces solo suma una vez y conserva ambas escrituras atómicas', async () => {
      await reset();
      const db = admin();
      assert.equal((await moderateCommentAtomic(db, comment('first'), 'approve')).changed, true);
      assert.equal((await moderateCommentAtomic(db, comment('first'), 'approve')).changed, false);
      assert.equal((await getDoc(doc(db, 'apps', 'sample'))).data().commentsCount, 1);
      assert.equal((await getDoc(doc(db, 'apps', 'sample', 'comments', 'first'))).data().approved, true);
    });

    await t.test('Concurrencia de aprobaciones no duplica el contador', async () => {
      await reset();
      const db = admin();
      const results = await Promise.all([
        moderateCommentAtomic(db, comment('first'), 'approve'),
        moderateCommentAtomic(db, comment('first'), 'approve')
      ]);
      assert.equal(results.filter(v => v.changed).length, 1);
      assert.equal((await getDoc(doc(db, 'apps', 'sample'))).data().commentsCount, 1);
    });

    await t.test('Ocultar repetidamente no produce contador negativo', async () => {
      await reset(1, {first:true,second:false});
      const db=admin();
      assert.equal((await moderateCommentAtomic(db, comment('first'), 'hide')).delta,-1);
      assert.equal((await moderateCommentAtomic(db, comment('first'), 'hide')).changed,false);
      assert.equal((await getDoc(doc(db,'apps','sample'))).data().commentsCount,0);
    });

    await t.test('Eliminar pendiente no cambia contador; eliminar aprobado descuenta exactamente una vez', async () => {
      await reset(1,{first:true,second:false});
      const db=admin();
      assert.equal((await moderateCommentAtomic(db,comment('second'),'remove')).delta,0);
      assert.equal((await getDoc(doc(db,'apps','sample'))).data().commentsCount,1);
      assert.equal((await moderateCommentAtomic(db,comment('first'),'remove')).delta,-1);
      assert.equal((await moderateCommentAtomic(db,comment('first'),'remove')).changed,false);
      assert.equal((await getDoc(doc(db,'apps','sample'))).data().commentsCount,0);
    });

    await t.test('Contador histórico incoherente cancela transacción sin mutar comentario', async () => {
      await reset(0,{first:true,second:false});
      const db=admin();
      await assert.rejects(moderateCommentAtomic(db,comment('first'),'hide'),/concilia|conciliación/i);
      assert.equal((await getDoc(doc(db,'apps','sample','comments','first'))).data().approved,true);
      assert.equal((await getDoc(doc(db,'apps','sample'))).data().commentsCount,0);
    });

    await t.test('Archivar no elimina documento ni subcolecciones; deja de ser visible públicamente', async () => {
      await reset(1,{first:true,second:false});
      const db=admin();
      assert.equal((await archiveAppAtomic(db,'sample')).changed,true);
      assert.equal((await archiveAppAtomic(db,'sample')).changed,false);
      const snap=(await getDoc(doc(db,'apps','sample')));
      assert.equal(snap.data().status,'archived');
      assert.equal(snap.data().featured,false);
      assert.equal(snap.data().likesCount,4);
      assert.equal(snap.data().ratingSum,9);
      assert.equal(snap.data().commentsCount,1);
      for (const collectionName of ['comments','likes','ratings','downloadClicks']) {
        assert.equal((await getDocs(collection(db,'apps','sample',collectionName))).empty,false);
      }
      await assertFails(getDoc(doc(guest(),'apps','sample')));
      const list=await getDocs(query(collection(guest(),'apps'),where('status','==','published')));
      assert.equal(list.empty,true);
      await assert.rejects(updatePublicationAtomic(db,'sample','published'),/restaura/i);
    });

    await t.test('Restaurar convierte únicamente a borrador y mantiene todo el historial', async () => {
      await reset();
      const db=admin();
      await archiveAppAtomic(db,'sample');
      assert.equal((await restoreAppAtomic(db,'sample')).changed,true);
      assert.equal((await restoreAppAtomic(db,'sample')).changed,false);
      let app=(await getDoc(doc(db,'apps','sample'))).data();
      assert.equal(app.status,'draft');
      assert.equal(app.featured,false);
      assert.equal(app.likesCount,4);
      assert.equal((await getDoc(doc(db,'apps','sample','likes','visitor-x'))).exists(),true);
      await assertFails(getDoc(doc(guest(),'apps','sample')));
      await updatePublicationAtomic(db,'sample','published');
      app=(await getDoc(doc(db,'apps','sample'))).data();
      assert.equal(app.status,'published');
    });

    await t.test('No permite publicar estado arbitrario', async () => {
      await reset();
      await assert.rejects(updatePublicationAtomic(admin(),'sample','archived'),/inválido/i);
    });
  } finally {
    await env.cleanup();
  }
});
