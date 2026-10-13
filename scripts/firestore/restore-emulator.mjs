/**
 * Restauración SOLO en proyecto de emulador con ID demo-*.
 * Por diseño no admite projectIds reales ni endpoints de red externos.
 */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { verifyArchive, restoreToEmulator } from './archive.mjs';

const folder = process.argv[2];
const host = process.env.FIRESTORE_EMULATOR_HOST || '';
const project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || '';
if (!folder || !/^(localhost|127\.0\.0\.1):8080$/.test(host) ||
    !/^demo-[a-z0-9-]+$/.test(project)) {
  console.error('Bloqueado: requiere FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 y GCLOUD_PROJECT=demo-...');
  process.exit(2);
}
try {
  const verified = await verifyArchive(folder);
  if (!process.argv.includes('--apply')) {
    console.log('Simulación segura: ' + verified.manifest.documents + ' documentos íntegros.');
    console.log('Para ensayar la restauración SOLO EN EMULADOR, añadir --apply.');
  } else {
    const app = initializeApp({ projectId: project });
    try {
      const restored = await restoreToEmulator(getFirestore(app), folder);
      console.log('Restauración de ensayo terminada: ' + restored.count + ' documentos (demo).');
    } finally {
      await app.delete();
    }
  }
} catch (error) {
  console.error('No se pudo verificar/restaurar: ' + error.message);
  process.exitCode = 1;
}
