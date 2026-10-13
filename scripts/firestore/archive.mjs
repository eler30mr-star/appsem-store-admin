import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { finished, pipeline } from 'node:stream/promises';
import { createGunzip, createGzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { encode, decode, assertDocumentPath } from './codec.mjs';

const SCHEMA = 'appsem-firestore-manual-backup-v1';
const MAX_DOCS = 1000000;

async function sha256(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

function filename(dir) { return join(dir, 'documents.ndjson.gz'); }

export async function createArchive(db, { outputRoot, projectId }) {
  if (!projectId || typeof projectId !== 'string') throw new Error('Falta projectId.');
  const root = resolve(outputRoot);
  await mkdir(root, { recursive: true, mode: 0o700 });
  const dir = await mkdtemp(join(root, 'backup-'));
  const staging = join(dir, 'documents.ndjson');
  const output = createWriteStream(staging, { flags: 'wx', mode: 0o600 });
  const startedAt = new Date().toISOString();
  let documents = 0;
  let emptyAncestors = 0;
  let rootCollections = 0;
  try {
    async function traverse(collection) {
      // listDocuments incluye referencias de padres ausentes con subcolecciones.
      const refs = await collection.listDocuments();
      for (const ref of refs) {
        const snap = await ref.get();
        if (snap.exists) {
          assertDocumentPath(snap.ref.path);
          const line = JSON.stringify({ path: snap.ref.path, fields: encode(snap.data()) }) + '\n';
          await new Promise((ok, fail) => output.write(line, (error) => error ? fail(error) : ok()));
          documents++;
          if (documents > MAX_DOCS) throw new Error('Límite de seguridad de documentos superado.');
        } else {
          emptyAncestors++;
        }
        // Importante: recorrer aun si el documento padre no existe.
        for (const child of await ref.listCollections()) await traverse(child);
      }
    }
    for (const collection of await db.listCollections()) {
      rootCollections++;
      await traverse(collection);
    }
    output.end();
    await finished(output);
    await pipeline(createReadStream(staging), createGzip({ level: 6 }),
      createWriteStream(filename(dir), { flags: 'wx', mode: 0o600 }));
    await rm(staging);
    const manifest = {
      schema: SCHEMA,
      sourceProjectId: projectId,
      sourceDatabase: '(default)',
      startedAt,
      completedAt: new Date().toISOString(),
      snapshotIsAtomic: false,
      rootCollections,
      documents,
      missingParentDocuments: emptyAncestors,
      archiveFile: 'documents.ndjson.gz',
      archiveBytes: (await stat(filename(dir))).size,
      archiveSha256: await sha256(filename(dir))
    };
    // El manifiesto aparece solo tras terminar correctamente el archivo.
    await writeFile(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n',
      { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    return { dir, manifest };
  } catch (error) {
    output.destroy();
    await rm(dir, { force: true, recursive: true });
    throw error;
  }
}

async function* records(directory) {
  const stream = createReadStream(filename(directory)).pipe(createGunzip());
  const reader = createInterface({ input: stream, crlfDelay: Infinity });
  try {
    for await (const line of reader) {
      if (!line.trim()) continue;
      if (line.length > 16 * 1024 * 1024) throw new Error('Registro demasiado grande.');
      const record = JSON.parse(line);
      if (!record || typeof record !== 'object') throw new Error('Registro JSON inválido.');
      assertDocumentPath(record.path);
      if (!record.fields || record.fields.$appsemFirestoreBackupV1 !== 'map') {
        throw new Error('El documento no contiene un mapa de campos válido.');
      }
      yield record;
    }
  } finally {
    reader.close();
    stream.destroy();
  }
}

export async function verifyArchive(directory) {
  const dir = resolve(directory);
  const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8'));
  if (manifest.schema !== SCHEMA || manifest.archiveFile !== 'documents.ndjson.gz' ||
      typeof manifest.sourceProjectId !== 'string' ||
      !Number.isSafeInteger(manifest.documents) || manifest.documents < 0 ||
      manifest.documents > MAX_DOCS || !/^[a-f0-9]{64}$/.test(manifest.archiveSha256)) {
    throw new Error('Manifiesto inválido o versión no soportada.');
  }
  const actualSize = (await stat(filename(dir))).size;
  const actualHash = await sha256(filename(dir));
  if (actualSize !== manifest.archiveBytes || actualHash !== manifest.archiveSha256) {
    throw new Error('Integridad fallida: archivo comprimido modificado o incompleto.');
  }
  let counted = 0;
  const unique = new Set();
  for await (const record of records(dir)) {
    if (unique.has(record.path)) throw new Error('Documento duplicado en la copia.');
    unique.add(record.path);
    counted++;
    if (counted > MAX_DOCS) throw new Error('Número máximo de documentos excedido.');
  }
  if (counted !== manifest.documents) throw new Error('Cantidad de documentos incorrecta.');
  return { dir, manifest };
}

export async function restoreToEmulator(db, dir) {
  const verified = await verifyArchive(dir);
  let count = 0;
  let batch = db.batch();
  let pending = 0;
  for await (const record of records(verified.dir)) {
    // El .set es intencional solo sobre el EMULADOR; el CLI impone guardas.
    batch.set(db.doc(record.path), decode(record.fields, db));
    pending++;
    count++;
    if (pending === 200) {
      await batch.commit();
      batch = db.batch();
      pending = 0;
    }
  }
  if (pending) await batch.commit();
  if (count !== verified.manifest.documents) throw new Error('Cantidad restaurada distinta de la copia.');
  return { count, manifest: verified.manifest };
}
