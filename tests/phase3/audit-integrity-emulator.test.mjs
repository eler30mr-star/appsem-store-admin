import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { scanFirestore } from '../../scripts/phase3/audit-integrity.mjs';

const projectId = 'demo-appsem-phase3';

test('Auditoría read-only: comprueba datos reales del Emulator sin modificarlos y sin filtrar PII', async () => {
  assert.match(process.env.FIRESTORE_EMULATOR_HOST || '', /^(127\.0\.0\.1|localhost):8080$/);
  const app = initializeApp({ projectId }, 'phase3-audit-fixture');
  const db = getFirestore(app);
  try {
    const ref = db.doc('apps/audit-sample');
    await ref.set({
      status: 'published', featured: false, title: 'Nombre privado',
      commentsCount: 0, likesCount: 7, ratingCount: 2,
      ratingSum: 9, ratingAverage: 4.5, downloadsCount: 4
    });
    await ref.collection('comments').doc('visitante-secreto').set({
      name: 'Persona reservada', comment: 'Comentario privado irrepetible', approved: true
    });
    await ref.collection('ratings').doc('visitante-secreto').set({ rating: 5 });
    const orphanRef = db.doc('apps/audit-orphan/comments/visitor-confidential');
    await orphanRef.set({ approved: true, comment: 'Sin padre, no divulgar' });
    const before = await Promise.all([ref.get(), orphanRef.get()]);

    const opts = {
      project: projectId, emulator: true,
      key: 'emulator-only-nonsecret-pseudonym-key',
      maxApps: 500, maxEvents: 5000
    };
    const first = await scanFirestore(db, opts);
    const second = await scanFirestore(db, opts);
    assert.deepEqual(first, second);
    assert.equal(first.summary.orphanParents >= 1, true);
    assert.equal(first.summary.errors >= 2, true);
    assert.ok(first.apps.some(a => a.issues.some(i => i.code === 'APPROVED_COMMENTS_COUNT_MISMATCH')));
    assert.ok(first.apps.some(a => a.issues.some(i => i.code === 'ORPHANED_SUBCOLLECTIONS')));
    const json = JSON.stringify(first);
    for (const sensitive of ['audit-sample', 'audit-orphan', 'visitante-secreto',
      'Nombre privado', 'Comentario privado irrepetible', 'Persona reservada',
      'visitor-confidential', 'Sin padre, no divulgar']) {
      assert.equal(json.includes(sensitive), false, 'No divulgar ' + sensitive);
    }
    const after = await Promise.all([ref.get(), orphanRef.get()]);
    assert.deepEqual(after.map(s => s.data()), before.map(s => s.data()));
    await assert.rejects(scanFirestore(db, { ...opts, maxApps: 1 }), /max-apps/);
  } finally {
    await db.doc('apps/audit-sample/comments/visitante-secreto').delete();
    await db.doc('apps/audit-sample/ratings/visitante-secreto').delete();
    await db.doc('apps/audit-sample').delete();
    await db.doc('apps/audit-orphan/comments/visitor-confidential').delete();
    await deleteApp(app);
  }
});
