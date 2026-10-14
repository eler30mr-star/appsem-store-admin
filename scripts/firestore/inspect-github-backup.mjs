/** Inspección pasiva: NO pide clave, NO descifra ni usa Firebase. */
import { inspectEncryptedBackup } from './encrypted.mjs';

const filepath = process.argv[2];
if (process.argv.length !== 3 || !filepath || !filepath.endsWith('.appsem.enc')) {
  console.error('Uso: node scripts/firestore/inspect-github-backup.mjs backups/encrypted/ARCHIVO.appsem.enc');
  process.exit(2);
}
try {
  const result = await inspectEncryptedBackup(filepath);
  if (result.ciphertextBytes <= 0) throw new Error('El contenido cifrado está vacío.');
  console.log('PASS: envoltura del respaldo cifrado estructuralmente válida.');
  console.log('Formato:', result.format);
  console.log('Cifrado:', result.cipher, 'KDF:', result.kdf);
  console.log('Archivo en bytes:', result.bytes, 'contenido cifrado:', result.ciphertextBytes);
  console.log('NO SE HA VERIFICADO LA RECUPERACIÓN: requiere contraseña privada y restauración en Emulator.');
} catch (error) {
  console.error('FAIL: archivo cifrado no válido:', error.message);
  process.exitCode = 1;
}
