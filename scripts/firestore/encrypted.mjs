/**
 * APPSEM FIRESTORE — Archivo protegido para repositorios PÚBLICOS.
 * AES-256-GCM con salt+nonce aleatorios y scrypt N=131072/r=8/p=1.
 * La contraseña de descifrado NUNCA se guarda en Git.
 * El contenido cifrado incluye el manifest JSON y documents.ndjson.gz.
 */
import { createCipheriv, createDecipheriv, createHash, pbkdf2 as pbkdf2Cb, randomBytes, scrypt as scryptCb } from 'node:crypto';
import { promisify } from 'node:util';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, open, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { verifyArchive } from './archive.mjs';

const MAGIC = Buffer.from('APPSEM-BACKUP-1\n');
const FORMAT = 'appsem-encrypted-firestore-v1';
const TAG_SIZE = 16;
const KDF = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
const scrypt = promisify(scryptCb);
const pbkdf2 = promisify(pbkdf2Cb);
const headerMax = 2048;

function checkPass(passphrase) {
  if (typeof passphrase !== 'string' || passphrase.length < 20 ||
      passphrase.length > 4096 || /\u0000/.test(passphrase)) {
    throw new Error('La frase secreta debe tener entre 20 y 4096 caracteres.');
  }
}

async function derive(passphrase, salt, header) {
  if (header?.kdf === 'pbkdf2-sha256') {
    if (header.iterations !== 600000) throw new Error('Parámetros PBKDF2 no soportados.');
    return pbkdf2(passphrase, salt, header.iterations, 32, 'sha256');
  }
  return scrypt(passphrase, salt, 32, KDF);
}

async function readExact(file, size, offset) {
  const buffer = Buffer.alloc(size);
  let cursor = 0;
  while (cursor < size) {
    const { bytesRead } = await file.read(buffer, cursor, size - cursor, offset + cursor);
    if (!bytesRead) throw new Error('Archivo cifrado incompleto.');
    cursor += bytesRead;
  }
  return buffer;
}

async function readHeader(path) {
  const fd = await open(path, 'r');
  try {
    const info = await fd.stat();
    if (info.size < MAGIC.length + 4 + TAG_SIZE + 1) throw new Error('Archivo cifrado incompleto.');
    const magic = await readExact(fd, MAGIC.length, 0);
    if (!magic.equals(MAGIC)) throw new Error('No es un respaldo cifrado Appsem.');
    const n = (await readExact(fd, 4, MAGIC.length)).readUInt32BE();
    if (n > headerMax || n < 15) throw new Error('Cabecera de respaldo inválida.');
    const buf = await readExact(fd, n, MAGIC.length + 4);
    const header = JSON.parse(buf.toString('utf8'));
    if (header.format !== FORMAT || header.algo !== 'aes-256-gcm' ||
        !((header.kdf === 'scrypt' && header.N === KDF.N && header.r === KDF.r && header.p === KDF.p) ||
          (header.kdf === 'pbkdf2-sha256' && header.iterations === 600000)) ||
        !/^[0-9a-f]{32}$/.test(header.salt) ||
        !/^[0-9a-f]{24}$/.test(header.iv)) {
      throw new Error('Cabecera o parámetros criptográficos no soportados.');
    }
    const start = MAGIC.length + 4 + n;
    if (info.size <= start + TAG_SIZE) throw new Error('Contenido de respaldo vacío.');
    const tag = await readExact(fd, TAG_SIZE, info.size - TAG_SIZE);
    return { header, headerBytes: buf, start, end: info.size - TAG_SIZE - 1, tag };
  } finally {
    await fd.close();
  }
}

export async function encryptBackup(plainDir, destination, passphrase) {
  checkPass(passphrase);
  const { manifest } = await verifyArchive(plainDir);
  const full = resolve(destination);
  if (!full.endsWith('.appsem.enc')) throw new Error('Extensión requerida: .appsem.enc');
  const salt = randomBytes(16), iv = randomBytes(12);
  const key = await derive(passphrase, salt);
  const headerBytes = Buffer.from(JSON.stringify({
    format: FORMAT, algo: 'aes-256-gcm', kdf: 'scrypt',
    N: KDF.N, r: KDF.r, p: KDF.p,
    salt: salt.toString('hex'), iv: iv.toString('hex')
  }), 'utf8');
  const n = Buffer.alloc(4);
  n.writeUInt32BE(headerBytes.length);
  const tmp = full + '.partial-' + randomBytes(8).toString('hex');
  try {
    await mkdir(resolve(full, '..'), { recursive: true, mode: 0o700 });
    const fh = await open(tmp, 'wx', 0o600);
    try {
      await fh.writeFile(Buffer.concat([MAGIC, n, headerBytes]));
    } finally {
      await fh.close();
    }
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(headerBytes);
    const manBuf = Buffer.from(JSON.stringify(manifest), 'utf8');
    const length = Buffer.alloc(4);
    length.writeUInt32BE(manBuf.length);
    async function* source() {
      yield length;
      yield manBuf;
      yield* createReadStream(join(plainDir, 'documents.ndjson.gz'));
    }
    await pipeline(Readable.from(source()), cipher, createWriteStream(tmp, { flags: 'a', mode: 0o600 }));
    const fp = await open(tmp, 'a');
    try { await fp.writeFile(cipher.getAuthTag()); } finally { await fp.close(); }
    // Nunca sobreescribir un respaldo anterior: los nombres son únicos.
    try { await stat(full); throw new Error('Ya existe el archivo de destino.'); }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
    await rename(tmp, full);
    return { file: full, bytes: (await stat(full)).size, documents: manifest.documents };
  } catch (error) {
    await rm(tmp, { force: true });
    throw error;
  } finally {
    key.fill(0);
  }
}

export async function decryptBackup(encryptedFile, targetRoot, passphrase) {
  checkPass(passphrase);
  const path = resolve(encryptedFile);
  const { header, headerBytes, start, end, tag } = await readHeader(path);
  const key = await derive(passphrase, Buffer.from(header.salt, 'hex'), header);
  await mkdir(resolve(targetRoot), { recursive: true, mode: 0o700 });
  const dir = await mkdtemp(join(resolve(targetRoot), 'restored-'));
  const staging = join(dir, 'bundle.private');
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(header.iv, 'hex'));
    decipher.setAAD(headerBytes);
    decipher.setAuthTag(tag);
    await pipeline(createReadStream(path, { start, end }), decipher,
      createWriteStream(staging, { flags: 'wx', mode: 0o600 }));
    const fd = await open(staging, 'r');
    let prefix, manifestBytes;
    try {
      prefix = await readExact(fd, 4, 0);
      const n = prefix.readUInt32BE();
      if (n <= 10 || n > 65536) throw new Error('Manifiesto descifrado inválido.');
      manifestBytes = await readExact(fd, n, 4);
    } finally { await fd.close(); }
    const manifest = JSON.parse(manifestBytes.toString('utf8'));
    await writeFile(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n',
      { flag: 'wx', mode: 0o600 });
    await pipeline(createReadStream(staging, { start: 4 + manifestBytes.length }),
      createWriteStream(join(dir, 'documents.ndjson.gz'), { flags: 'wx', mode: 0o600 }));
    await rm(staging);
    const verified = await verifyArchive(dir);
    return { dir, manifest: verified.manifest };
  } catch (e) {
    await rm(dir, { recursive: true, force: true });
    throw new Error('No se pudo descifrar/verificar la copia. Contraseña incorrecta o archivo dañado. ' + e.message);
  } finally {
    key.fill(0);
  }
}

/** Contraseña introducida solo en terminal interactiva; no aparece en argumentos ni logs. */
export async function askHidden(label) {
  const input = process.stdin;
  if (!input.isTTY || typeof input.setRawMode !== 'function') {
    throw new Error('Usa una terminal PowerShell interactiva; no se aceptan contraseñas por argumentos o variables.');
  }
  process.stdout.write(label);
  const originalRaw = Boolean(input.isRaw);
  let secret = '';
  return new Promise((resolve, reject) => {
    function cleanup() {
      input.off('data', onData);
      input.setRawMode(originalRaw);
      input.pause();
      process.stdout.write('\n');
    }
    function onData(chunk) {
      for (const char of String(chunk)) {
        if (char === '\u0003') { cleanup(); reject(new Error('Cancelado.')); return; }
        if (char === '\r' || char === '\n') { cleanup(); resolve(secret); return; }
        if (char === '\b' || char === '\x7f') { secret = secret.slice(0, -1); continue; }
        if (char.charCodeAt(0) >= 32 && secret.length < 4096) secret += char;
      }
    }
    input.setEncoding('utf8');
    input.setRawMode(true);
    input.resume();
    input.on('data', onData);
  });
}

/**
 * Revisa el formato de un archivo cifrado del repositorio sin contraseña.
 * Solo valida estructura, longitud y parámetros del encabezado:
 * NO verifica etiqueta AES-GCM, contraseña, contenido ni restaurabilidad.
 * Nunca devuelve salt, nonce, tag ni ningún dato descifrado.
 */
export async function inspectEncryptedBackup(filePath) {
  const path = resolve(filePath);
  const { header, start, end } = await readHeader(path);
  const { size } = await stat(path);
  return {
    format: header.format,
    cipher: header.algo,
    kdf: header.kdf,
    bytes: size,
    ciphertextBytes: end - start + 1
  };
}
