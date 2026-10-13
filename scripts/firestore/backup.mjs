/**
 * Copia de datos Firestore de SOLO lectura.
 * NO incluye Storage, Auth ni índices/reglas (estos últimos se conservan en Git).
 */
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { resolve } from 'node:path';
import { createArchive } from './archive.mjs';

const expected = 'webs-8b1bf';
const args = process.argv.slice(2);
if (process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('El comando de respaldo real no se ejecuta con FIRESTORE_EMULATOR_HOST.');
  process.exit(2);
}
if (!args.includes('--confirm-read') || !args.includes('--project=' + expected)) {
  console.error('Uso: npm run firestore:backup -- --project=webs-8b1bf --confirm-read');
  console.error('Requiere Application Default Credentials con acceso de lectura a Firestore.');
  process.exit(2);
}
const argument = args.find((item) => item.startsWith('--out='));
const out = argument ? argument.slice('--out='.length) : 'backups/firestore';
const app = initializeApp({ projectId: expected, credential: applicationDefault() });
try {
  console.log('Iniciando exportación de SOLO LECTURA (puede consumir cuota de lecturas).');
  const { dir, manifest } = await createArchive(getFirestore(app), {
    outputRoot: resolve(out),
    projectId: expected
  });
  console.log('Copia guardada en: ' + dir);
  console.log('Documentos: ' + manifest.documents);
  console.log('SHA-256: ' + manifest.archiveSha256);
  console.log('Verificación: npm run firestore:verify -- "' + dir + '"');
  console.log('Conservar fuera del repositorio, preferiblemente cifrada y en dos ubicaciones.');
} catch (error) {
  console.error('RESPALDO NO COMPLETADO: ' + error.message);
  process.exitCode = 1;
} finally {
  await app.delete();
}
