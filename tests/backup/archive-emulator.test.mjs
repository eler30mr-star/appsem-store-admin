import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, GeoPoint, Timestamp } from 'firebase-admin/firestore';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { createArchive, verifyArchive, restoreToEmulator } from '../../scripts/firestore/archive.mjs';

if (!/^(127\.0\.0\.1|localhost):8080$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) {
  throw new Error('Esta prueba solo funciona en Firebase Emulator local.');
}
test('Backup Spark: incluye raíces, subcolecciones y padres ausentes; restaura tipos y detecta corrupción', async () => {
  const projectId = 'demo-appsem-phase1';
  const env = await initializeTestEnvironment({
    projectId,
    firestore: { host: '127.0.0.1', port: 8080 }
  });
  const app = initializeApp({ projectId }, 'backup-suite');
  const db = getFirestore(app);
  const folder = await mkdtemp(join(tmpdir(), 'appsem-backup-ci-'));
  try {
    await env.clearFirestore();
    const ref = db.doc('apps/demo');
    await ref.set({
      title: 'Demo temporal', createdAt: new Timestamp(1700000000, 555123444),
      coordinate: new GeoPoint(-12.06, -77.03),
      binary: Buffer.from([0, 1, 2, 3, 255]),
      nested: { original: { yes: true }, '$appsemFirestoreBackupV1': 'es dato' },
      reference: ref
    });
    await db.doc('apps/demo/comments/c1').set({ comment: 'Hola', approved: false });
    // Documento padre apps/ausente NO existe, pero su subcolección SÍ.
    await db.doc('apps/ausente/comments/c2').set({ comment: 'Subcolección huérfana' });
    await db.doc('settings/site').set({ theme: 'dark', enabled: true });
    const { dir, manifest } = await createArchive(db, { projectId, outputRoot: folder });
    assert.equal(manifest.documents, 4);
    assert.ok(manifest.missingParentDocuments >= 1);
    assert.equal((await verifyArchive(dir)).manifest.documents, 4);
    await env.clearFirestore();
    const result = await restoreToEmulator(db, dir);
    assert.equal(result.count, 4);
    const restored = (await ref.get()).data();
    assert.equal(restored.title, 'Demo temporal');
    assert.equal(restored.createdAt.nanoseconds, 555123444);
    assert.equal(restored.coordinate.longitude, -77.03);
    assert.deepEqual(restored.binary, Buffer.from([0, 1, 2, 3, 255]));
    assert.equal(restored.reference.path, 'apps/demo');
    assert.equal(restored.nested['$appsemFirestoreBackupV1'], 'es dato');
    assert.equal((await db.doc('apps/ausente').get()).exists, false);
    assert.equal((await db.doc('apps/ausente/comments/c2').get()).exists, true);
    assert.equal((await db.doc('settings/site').get()).data().enabled, true);
    const archivePath = join(dir, 'documents.ndjson.gz');
    const corrupt = await readFile(archivePath);
    corrupt[0] = (corrupt[0] + 1) % 255;
    await writeFile(archivePath, corrupt);
    await assert.rejects(verifyArchive(dir), /Integridad fallida/);
  } finally {
    await env.clearFirestore();
    await env.cleanup();
    await app.delete();
    await rm(folder, { recursive: true, force: true });
  }
});
