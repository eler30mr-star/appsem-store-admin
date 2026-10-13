import { verifyArchive } from './archive.mjs';

const folder = process.argv[2];
if (!folder || process.argv.length !== 3) {
  console.error('Uso: npm run firestore:verify -- "RUTA_DEL_RESPALDO"');
  process.exit(2);
}
try {
  const { manifest } = await verifyArchive(folder);
  console.log('Copia íntegra (SHA-256 y registros): ' + manifest.documents + ' documentos.');
  console.log('Proyecto origen declarado: ' + manifest.sourceProjectId);
  console.log('Inicio: ' + manifest.startedAt + '; fin: ' + manifest.completedAt);
  console.log('Nota: verificación local no sustituye una restauración de ensayo.');
} catch (error) {
  console.error('ERROR AL VERIFICAR: ' + error.message);
  process.exitCode = 1;
}
