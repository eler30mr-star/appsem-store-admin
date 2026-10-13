import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decryptBackup, askHidden } from './encrypted.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const filename = process.argv[2];
if (!filename || process.argv.length !== 3 || !filename.endsWith('.appsem.enc')) {
  console.error('Uso: npm run firestore:decrypt -- "backups/encrypted/NOMBRE.appsem.enc"');
  process.exit(2);
}
try {
  const secret = await askHidden('Frase secreta de recuperación: ');
  const result = await decryptBackup(filename, resolve(root, 'backups/firestore'), secret);
  console.log('COPIA RESTAURADA LOCALMENTE:', result.dir);
  console.log('Documentos verificados:', result.manifest.documents);
  console.log('Puedes usar esta carpeta SOLO con el restaurador del emulador.');
  console.log('No agregues los archivos descifrados a Git.');
} catch (e) {
  console.error('Error al recuperar el respaldo:', e.message);
  process.exitCode = 1;
}
