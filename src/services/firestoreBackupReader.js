import { Bytes, DocumentReference, GeoPoint, Timestamp, collection, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { ADMIN_EMAIL } from '../config';

const MARKER = '$appsemFirestoreBackupV1';
const SUBCOLLECTIONS = ['likes', 'ratings', 'downloadClicks', 'comments'];
const MAX_RECORDS = 100000;

export function encodeValue(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return { [MARKER]: 'number', value: 'NaN' };
    if (value === Infinity) return { [MARKER]: 'number', value: 'Infinity' };
    if (value === -Infinity) return { [MARKER]: 'number', value: '-Infinity' };
    if (Object.is(value, -0)) return { [MARKER]: 'number', value: '-0' };
    return value;
  }
  if (value instanceof Timestamp) {
    return { [MARKER]: 'timestamp', seconds: value.seconds, nanoseconds: value.nanoseconds };
  }
  if (value instanceof GeoPoint) {
    return { [MARKER]: 'geopoint', latitude: value.latitude, longitude: value.longitude };
  }
  if (value instanceof Bytes) {
    return { [MARKER]: 'bytes', base64: value.toBase64() };
  }
  if (value instanceof DocumentReference) {
    return { [MARKER]: 'reference', path: value.path };
  }
  if (Array.isArray(value)) return value.map(encodeValue);
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return {
      [MARKER]: 'map',
      fields: Object.fromEntries(Object.entries(value).map(([key, field]) => [key, encodeValue(field)]))
    };
  }
  throw new Error('Se encontró un tipo Firestore no soportado; no se generará copia incompleta.');
}

export async function readAppsemFirestore(onProgress = () => {}) {
  const user = auth.currentUser;
  if (!user || user.email !== ADMIN_EMAIL) {
    throw new Error('Inicia sesión con la cuenta administradora para crear el respaldo.');
  }
  const token = await user.getIdTokenResult();
  if (token.claims.email !== ADMIN_EMAIL ||
      token.claims.email_verified !== true ||
      user.emailVerified !== true) {
    throw new Error('La sesión no corresponde al administrador autorizado.');
  }
  if (db.app.options.projectId !== 'webs-8b1bf') {
    throw new Error('Proyecto Firebase inesperado: respaldo bloqueado.');
  }

  onProgress('Leyendo catálogo completo...');
  const root = await getDocs(collection(db, 'apps'));
  const documents = [];
  const counts = { apps: root.size, likes: 0, ratings: 0, downloadClicks: 0, comments: 0 };

  function addRecord(snapshot) {
    if (documents.length >= MAX_RECORDS) throw new Error('Límite de documentos alcanzado. Se canceló la exportación.');
    documents.push({ path: snapshot.ref.path, fields: encodeValue(snapshot.data()) });
  }
  for (const app of root.docs) {
    addRecord(app);
    for (const name of SUBCOLLECTIONS) {
      onProgress('Leyendo ' + (documents.length) + ' documentos; ' + name + ' de ' + app.id + '...');
      // No se omiten errores de permisos ni de red: copia incompleta = fallo.
      const snapshot = await getDocs(collection(db, 'apps', app.id, name));
      counts[name] += snapshot.size;
      snapshot.docs.forEach(addRecord);
    }
  }
  documents.sort((a, b) => a.path.localeCompare(b.path));
  onProgress('Lectura completada: ' + documents.length + ' documentos.');
  return { documents, counts };
}

export const BROWSER_BACKUP_SCOPE = 'apps y subcolecciones conocidas de documentos apps existentes; no descubre subcolecciones bajo padres inexistentes ni colecciones raíz ajenas a apps';
