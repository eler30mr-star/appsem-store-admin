import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { sealFirestoreRecords, unsealFirestoreBytes } from '../../src/services/browserBackupEncryption.js';
import { decryptBackup } from '../../scripts/firestore/encrypted.mjs';

test('El navegador genera archivo cifrado que se recupera con CLI Node', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'appsem-interop-'));
  const password = 'Frase secreta de prueba de treinta caracteres';
  const records = [{ path: 'apps/demo',
    fields: { $appsemFirestoreBackupV1: 'map', fields: { title: 'Solo ejemplo' } } }];
  try {
    const { file, manifest } = await sealFirestoreRecords({ records, passphrase: password });
    assert.equal(manifest.documents, 1);
    await assert.rejects(unsealFirestoreBytes(file, 'Frase incorrecta de treinta caracteres'));
    const changed = file.slice();
    changed[changed.length - 25] ^= 1;
    await assert.rejects(unsealFirestoreBytes(changed, password));
    const path = join(dir, 'copia.appsem.enc');
    await writeFile(path, file);
    const restored = await decryptBackup(path, dir, password);
    assert.equal(restored.manifest.documents, 1);
    assert.ok((await readFile(join(restored.dir, 'documents.ndjson.gz'))).length > 10);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
