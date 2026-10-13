/**
 * Crea formato APPSEM-BACKUP-1 compatible con restore/decrypt CLI existente.
 * PBKDF2-SHA256 porque scrypt no está disponible en Web Crypto.
 * Nunca envía claves ni documentos sin cifrar a GitHub.
 */
const enc = new TextEncoder();
const MAGIC = enc.encode('APPSEM-BACKUP-1\n');
const TAG_LENGTH = 16;
const ITERATIONS = 600000;
const MAX_PLAIN_BYTES = 24 * 1024 * 1024;
export const ENCRYPTED_BACKUP_EXT = '.appsem.enc';

function hex(bytes) {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}
function base64(bytes) {
  let result = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    result += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(result);
}
export function backupBase64(bytes) { return base64(bytes); }

function ensurePassphrase(passphrase) {
  if (typeof passphrase !== 'string' || passphrase.length < 20 || passphrase.length > 4096 ||
      passphrase.includes('\0')) {
    throw new Error('La frase de cifrado debe contener al menos 20 caracteres.');
  }
}
function joinBytes(...parts) {
  const total = parts.reduce((acc, b) => acc + b.byteLength, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) { output.set(p, offset); offset += p.byteLength; }
  return output;
}
function readHex(hexString) {
  if (typeof hexString !== 'string' || hexString.length % 2) throw new Error('Hexadecimal inválido');
  return new Uint8Array(hexString.match(/../g).map(x => parseInt(x, 16)));
}
async function sha256(bytes) {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
}
async function deriveKey(passphrase, salt) {
  const raw = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({
    name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS
  }, raw, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function gzip(data) {
  if (typeof CompressionStream === 'undefined') {
    throw new Error('Este navegador no admite CompressionStream. Usa Chrome actualizado.');
  }
  const body = new Blob([data]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(body).arrayBuffer());
}

export async function sealFirestoreRecords({ records, passphrase, projectId = 'webs-8b1bf' }) {
  ensurePassphrase(passphrase);
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error('No hay documentos que respaldar. Revisa el acceso y los datos de Firestore.');
  }
  const contents = records.map(item => JSON.stringify(item)).join('\n') + '\n';
  const bytes = enc.encode(contents);
  if (bytes.byteLength > MAX_PLAIN_BYTES) {
    throw new Error('La exportación supera 24 MiB. Usa el respaldo Admin SDK para colecciones grandes.');
  }
  const gz = await gzip(bytes);
  const now = new Date().toISOString();
  const manifest = {
    schema: 'appsem-firestore-manual-backup-v1',
    sourceProjectId: projectId,
    sourceDatabase: '(default)',
    startedAt: now,
    completedAt: now,
    snapshotIsAtomic: false,
    exportedWith: 'admin-browser-firebase-auth-v1',
    coverage: 'apps and known child collections of existing apps only',
    documents: records.length,
    missingParentDocuments: null,
    rootCollections: 1,
    archiveFile: 'documents.ndjson.gz',
    archiveBytes: gz.byteLength,
    archiveSha256: await sha256(gz)
  };
  const manifestBytes = enc.encode(JSON.stringify(manifest));
  const length = new Uint8Array(4);
  new DataView(length.buffer).setUint32(0, manifestBytes.byteLength, false);
  const plaintext = joinBytes(length, manifestBytes, gz);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const headerBytes = enc.encode(JSON.stringify({
    format: 'appsem-encrypted-firestore-v1', algo: 'aes-256-gcm', kdf: 'pbkdf2-sha256',
    iterations: ITERATIONS, salt: hex(salt), iv: hex(iv)
  }));
  const headerLength = new Uint8Array(4);
  new DataView(headerLength.buffer).setUint32(0, headerBytes.byteLength, false);
  const key = await deriveKey(passphrase, salt);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: headerBytes, tagLength: 128 }, key, plaintext
  ));
  // AES-GCM de Web Crypto devuelve ciphertext + 16-byte auth tag.
  if (ciphertext.byteLength < TAG_LENGTH) throw new Error('Error de cifrado.');
  const file = joinBytes(MAGIC, headerLength, headerBytes, ciphertext);
  if (file.byteLength > 24 * 1024 * 1024) {
    throw new Error('El respaldo cifrado supera 24 MiB. Requiere otra vía de almacenamiento.');
  }
  // Verificación antes de permitir publicar en GitHub.
  const decoded = await unsealFirestoreBytes(file, passphrase);
  if (decoded.manifest.archiveSha256 !== manifest.archiveSha256 ||
      decoded.manifest.documents !== manifest.documents) {
    throw new Error('La comprobación criptográfica del respaldo falló.');
  }
  return { file, manifest, sha256: await sha256(file) };
}

export async function unsealFirestoreBytes(bytes, passphrase) {
  ensurePassphrase(passphrase);
  const file = new Uint8Array(bytes);
  if (file.byteLength < MAGIC.length + 4 + 4 + 16 ||
      !MAGIC.every((b, i) => file[i] === b)) {
    throw new Error('No es un archivo de respaldo Appsem.');
  }
  const n = new DataView(file.buffer, file.byteOffset + MAGIC.length, 4).getUint32(0, false);
  if (n < 15 || n > 2048) throw new Error('Cabecera inválida.');
  const begin = MAGIC.length + 4;
  const headerBytes = file.subarray(begin, begin + n);
  const header = JSON.parse(new TextDecoder().decode(headerBytes));
  if (header.format !== 'appsem-encrypted-firestore-v1' ||
      header.algo !== 'aes-256-gcm' || header.kdf !== 'pbkdf2-sha256' ||
      header.iterations !== ITERATIONS || !/^[0-9a-f]{32}$/.test(header.salt) ||
      !/^[0-9a-f]{24}$/.test(header.iv)) {
    throw new Error('Formato criptográfico no reconocido.');
  }
  const key = await deriveKey(passphrase, readHex(header.salt));
  const clear = new Uint8Array(await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: readHex(header.iv), additionalData: headerBytes, tagLength: 128 },
    key, file.subarray(begin + n)
  ));
  const manifestLength = new DataView(clear.buffer, clear.byteOffset, 4).getUint32(0, false);
  if (manifestLength > 65536 || manifestLength < 10) throw new Error('Manifiesto inválido.');
  const manifest = JSON.parse(new TextDecoder().decode(clear.subarray(4, 4 + manifestLength)));
  const compressed = clear.subarray(4 + manifestLength);
  if (manifest.archiveBytes !== compressed.byteLength ||
      manifest.archiveSha256 !== await sha256(compressed)) {
    throw new Error('Archivo de datos alterado o incompleto.');
  }
  return { manifest, compressed };
}

export async function gitBlobSha1(bytes) {
  const prefix = enc.encode('blob ' + bytes.byteLength + '\0');
  const digest = await crypto.subtle.digest('SHA-1', joinBytes(prefix, bytes));
  return hex(new Uint8Array(digest));
}
