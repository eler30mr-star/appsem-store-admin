/**
 * Comprobación aislada del respaldo REAL de Appsem Store.
 *
 * El secreto se introduce únicamente en GitHub Actions como secreto temporal.
 * Nunca se publica en el repositorio, en logs o en artefactos.
 * Solo permite Firestore Emulator local y el proyecto demo-*.
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { decryptBackup } from './encrypted.mjs';
import { restoreToEmulator } from './archive.mjs';

const DEMO_PROJECT = 'demo-appsem-phase2-recovery';
const encryptedFile = resolve(
  'backups/encrypted/appsem-firestore-2026-10-13T21-27-24-109Z-b3f473bd.appsem.enc'
);

async function countEmulatorDocuments(db) {
  let documents = 0;
  async function walk(collection) {
    for (const ref of await collection.listDocuments()) {
      if ((await ref.get()).exists) documents += 1;
      for (const child of await ref.listCollections()) await walk(child);
    }
  }
  for (const collection of await db.listCollections()) await walk(collection);
  return documents;
}

async function main() {
  // Fallar antes de crear archivos si no es un ensayo manual y aislado.
  if (process.env.GITHUB_ACTIONS !== 'true' ||
      process.env.GITHUB_EVENT_NAME !== 'workflow_dispatch' ||
      process.env.GCLOUD_PROJECT !== DEMO_PROJECT ||
      !/^(localhost|127\\.0\\.0\\.1):8080$/.test(process.env.FIRESTORE_EMULATOR_HOST || '') ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    throw new Error('Entorno denegado: únicamente GitHub Actions manual + Firebase Emulator demo.');
  }

  const passphrase = process.env.APPSEM_BACKUP_RECOVERY_PASSPHRASE;
  delete process.env.APPSEM_BACKUP_RECOVERY_PASSPHRASE;
  if (!passphrase || passphrase.length < 20) {
    throw new Error('Falta el secreto temporal APPSEM_BACKUP_RECOVERY_PASSPHRASE en GitHub Actions.');
  }

  const scratch = await mkdtemp(join(tmpdir(), 'appsem-recovery-'));
  let app;
  try {
    const recovered = await decryptBackup(encryptedFile, scratch, passphrase);
    if (recovered.manifest.sourceProjectId !== 'webs-8b1bf' ||
        !Number.isSafeInteger(recovered.manifest.documents) ||
        recovered.manifest.documents < 1) {
      throw new Error('El origen del respaldo no coincide con Firebase webs-8b1bf.');
    }
    app = initializeApp({ projectId: DEMO_PROJECT }, 'appsem-real-backup-recovery');
    const db = getFirestore(app);
    const restored = await restoreToEmulator(db, recovered.dir);
    const count = await countEmulatorDocuments(db);
    if (restored.count !== recovered.manifest.documents ||
        count !== restored.count) {
      throw new Error('La cantidad recuperada no coincide con la restaurada en Emulator.');
    }
    console.info('PASS: respaldo real descifrado, íntegro y restaurado solo en Firebase Emulator.');
    console.info('Documentos verificados:', count);
    console.info('Proyecto destino: demo-* (Firestore Emulator, nunca producción).');
    console.info('No se han publicado datos ni artefactos descifrados.');
  } finally {
    if (app) await deleteApp(app);
    await rm(scratch, { recursive: true, force: true });
  }
}

try {
  await main();
} catch (error) {
  // No imprimir valores privados ni rutas de datos, solo un mensaje controlado.
  console.error('FAIL: recuperación aislada fallida.');
  if (/secreto temporal|Entorno denegado|origen del respaldo|cantidad recuperada/i.test(error.message)) {
    console.error(error.message);
  } else {
    console.error('No pudo descifrarse, verificarse o restaurarse el respaldo en Emulator.');
  }
  process.exitCode = 1;
}
