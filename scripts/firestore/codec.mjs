import { DocumentReference, GeoPoint, Timestamp } from 'firebase-admin/firestore';

const TAG = '$appsemFirestoreBackupV1';

export function encode(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return { [TAG]: 'number', value: 'NaN' };
    if (value === Infinity) return { [TAG]: 'number', value: 'Infinity' };
    if (value === -Infinity) return { [TAG]: 'number', value: '-Infinity' };
    if (Object.is(value, -0)) return { [TAG]: 'number', value: '-0' };
    return value;
  }
  if (value instanceof Timestamp) {
    return { [TAG]: 'timestamp', seconds: value.seconds, nanoseconds: value.nanoseconds };
  }
  if (value instanceof GeoPoint) {
    return { [TAG]: 'geopoint', latitude: value.latitude, longitude: value.longitude };
  }
  if (value instanceof DocumentReference) {
    return { [TAG]: 'reference', path: value.path };
  }
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return { [TAG]: 'bytes', base64: Buffer.from(value).toString('base64') };
  }
  if (Array.isArray(value)) return value.map(encode);
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return {
      [TAG]: 'map',
      fields: Object.fromEntries(Object.entries(value).map(([key, val]) => [key, encode(val)]))
    };
  }
  throw new Error('Tipo Firestore no compatible: ' + Object.prototype.toString.call(value));
}

export function decode(value, db) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map((item) => decode(item, db));
  if (!value || typeof value !== 'object') throw new Error('Dato de respaldo inválido.');
  const kind = value[TAG];
  switch (kind) {
    case 'number':
      if (value.value === 'NaN') return NaN;
      if (value.value === 'Infinity') return Infinity;
      if (value.value === '-Infinity') return -Infinity;
      if (value.value === '-0') return -0;
      throw new Error('Número especial no admitido.');
    case 'timestamp':
      if (!Number.isSafeInteger(value.seconds) || !Number.isInteger(value.nanoseconds) ||
          value.nanoseconds < 0 || value.nanoseconds > 999999999) throw new Error('Timestamp inválido.');
      return new Timestamp(value.seconds, value.nanoseconds);
    case 'geopoint':
      return new GeoPoint(value.latitude, value.longitude);
    case 'reference':
      assertDocumentPath(value.path);
      return db.doc(value.path);
    case 'bytes':
      if (typeof value.base64 !== 'string' ||
          !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value.base64)) {
        throw new Error('Blob base64 inválido.');
      }
      return Buffer.from(value.base64, 'base64');
    case 'map':
      if (!value.fields || typeof value.fields !== 'object' || Array.isArray(value.fields)) {
        throw new Error('Mapa de Firestore inválido.');
      }
      return Object.fromEntries(Object.entries(value.fields).map(([key, val]) => [key, decode(val, db)]));
    default:
      throw new Error('Tipo de respaldo desconocido. No se importará.');
  }
}

export function assertDocumentPath(path) {
  if (typeof path !== 'string' || path.length > 6144) throw new Error('Ruta Firestore inválida.');
  const parts = path.split('/');
  if (parts.length < 2 || parts.length % 2 !== 0 ||
      parts.some((part) => !part || part === '.' || part === '..' || /[\u0000-\u001f]/.test(part))) {
    throw new Error('Ruta de documento Firestore inválida.');
  }
}
