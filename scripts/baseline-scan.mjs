/**
 * Diagnóstico estático descriptivo de Fase 1.
 * No valida las reglas desplegadas, permisos efectivos o integridad de datos vivos.
 * Los hallazgos detectados NO hacen fallar el proceso: son riesgos pendientes.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceFiles = [
  'package.json',
  'firestore.rules',
  'src/App.jsx',
  'src/components/ProtectedRoute.jsx',
  'src/pages/CommentsPage.jsx',
  'src/services/appsService.js',
  'src/utils/slug.js',
  'src/utils/formatters.js',
  'src/data/categories.js',
];
const sources = {};
const fingerprints = [];

for (const path of sourceFiles) {
  const data = readFileSync(resolve(root, path), 'utf8');
  sources[path] = data;
  fingerprints.push({
    path,
    bytes: Buffer.byteLength(data, 'utf8'),
    sha256: createHash('sha256').update(data).digest('hex'),
  });
}

const rules = sources['firestore.rules'];
const service = sources['src/services/appsService.js'];
const observedSignals = [
  {
    id: 'SEC-01',
    detected: rules.includes('isLikeCounterUpdate()') &&
      rules.includes('isDownloadCounterUpdate()') &&
      rules.includes('allow update: if isAdmin()'),
    meaning: 'El código define incrementos de métricas admitidos también fuera de isAdmin.',
  },
  {
    id: 'SEC-02',
    detected: rules.includes('request.auth.token.email') && !rules.includes('email_verified'),
    meaning: 'La función administradora coteja correo pero no exige email_verified.',
  },
  {
    id: 'DAT-01',
    detected: service.includes('export async function approveComment') &&
      service.includes('commentsCount: increment(1)') &&
      !service.includes('runTransaction'),
    meaning: 'La moderación actualiza comentarios y contador sin transacción explícita.',
  },
  {
    id: 'DAT-02',
    detected: service.includes('export async function deleteApp') &&
      service.includes("return deleteDoc(doc(db, 'apps', appId));"),
    meaning: 'El borrado directo del documento padre no incluye subcolecciones.',
  },
  {
    id: 'PERF-01',
    detected: service.includes('for (const app of apps)') &&
      service.includes('await getDocs(commentsQuery)'),
    meaning: 'Las consultas de comentarios se ejecutan secuencialmente por app.',
  },
];
const report = {
  schema: 'appsem-admin-phase1-static-scan-v1',
  kind: 'static-observation-only',
  warning: 'Detección textual, no prueba de seguridad ni auditoría del Firebase desplegado.',
  fingerprints,
  observedSignals,
};
if (process.argv.includes('--json')) {
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
} else {
  console.log('APPSEM STORE ADMIN - Línea base estática (solo lectura)');
  for (const item of observedSignals) {
    console.log((item.detected ? 'OBSERVADO' : 'NO DETECTADO') + ' ' + item.id + ': ' + item.meaning);
  }
  console.log('Archivos con huella SHA-256:', fingerprints.length);
  console.log('Advertencia: NO DETECTADO no equivale a corregido; requiere pruebas.');
}
