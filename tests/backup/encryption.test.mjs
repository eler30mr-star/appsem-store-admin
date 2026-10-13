import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { encryptBackup, decryptBackup } from '../../scripts/firestore/encrypted.mjs';

test('Github público: backup sintético cifrado se recupera; clave incorrecta/corrupción se rechaza', async () => {
  const root = await mkdtemp(join(tmpdir(), 'appsem-encrypted-unit-'));
  const password = 'Frase larga de prueba sintética 2026-no-usar';
  const plain = join(root, 'private');
  const archive = join(root, 'safe.appsem.enc');
  try {
    await mkdir(plain);
    const line = JSON.stringify({
      path: 'apps/demo',
      fields: { '$appsemFirestoreBackupV1': 'map', fields: { title: 'App ficticia' } }
    }) + '\n';
    const payload = gzipSync(Buffer.from(line));
    await writeFile(join(plain, 'documents.ndjson.gz'), payload);
    const sha = createHash('sha256').update(payload).digest('hex');
    const manifest = { schema: 'appsem-firestore-manual-backup-v1', sourceProjectId: 'demo-tests',
      archiveFile: 'documents.ndjson.gz', archiveBytes: payload.length,
      archiveSha256: sha, documents: 1 };
    await writeFile(join(plain, 'manifest.json'), JSON.stringify(manifest));
    const encrypted = await encryptBackup(plain, archive, password);
    assert.ok(encrypted.bytes > 100);
    const restored = await decryptBackup(archive, root, password);
    try {
      assert.equal(restored.manifest.documents, 1);
      assert.equal(restored.manifest.archiveSha256, sha);
      assert.deepEqual(await readFile(join(restored.dir, 'documents.ndjson.gz')), payload);
    } finally { await rm(restored.dir, { force: true, recursive: true }); }
    await assert.rejects(decryptBackup(archive, root, 'Frase incorrecta de más de veinte caracteres'));
    const tampered = await readFile(archive);
    tampered[tampered.length - 22] ^= 1;
    await writeFile(archive, tampered);
    await assert.rejects(decryptBackup(archive, root, password));
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
