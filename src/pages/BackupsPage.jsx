import { useState } from 'react';
import { DatabaseBackup, Download, ExternalLink, LockKeyhole } from 'lucide-react';
import { readAppsemFirestore, BROWSER_BACKUP_SCOPE } from '../services/firestoreBackupReader';
import { sealFirestoreRecords } from '../services/browserBackupEncryption';
import { uploadEncryptedBackupToGitHub } from '../services/githubBackupUpload';

function makeFilename() {
  const date = new Date().toISOString().replace(/[:.]/g, '-');
  const suffix = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map(n => n.toString(16).padStart(2, '0')).join('');
  return 'appsem-firestore-' + date + '-' + suffix + '.appsem.enc';
}
function downloadFile(bytes, filename) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export default function BackupsPage() {
  const [passphrase, setPassphrase] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  async function backup(destination) {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      if (passphrase.length < 20 || passphrase !== confirmation) {
        throw new Error('La frase de cifrado debe tener al menos 20 caracteres y coincidir.');
      }
      if (destination === 'github' && token.trim().length < 20) {
        throw new Error('Introduce un token de GitHub con permiso Contents: write sobre este repositorio.');
      }
      const { documents, counts } = await readAppsemFirestore(setProgress);
      setProgress('Cifrando y verificando copia...');
      const { file, manifest } = await sealFirestoreRecords({ records: documents, passphrase });
      const filename = makeFilename();
      if (destination === 'github') {
        setProgress('Subiendo archivo CIFRADO a GitHub...');
        const published = await uploadEncryptedBackupToGitHub(file, filename, token);
        setResult({ ...published, documents: manifest.documents, counts, destination });
      } else {
        downloadFile(file, filename);
        setResult({ filename, documents: manifest.documents, counts, destination });
      }
      setProgress('Proceso completado.');
    } catch (err) {
      setError(err.message || 'No se pudo generar el respaldo.');
      setProgress('');
    } finally {
      setToken(''); // nunca guardar el token GitHub de forma persistente
      setBusy(false);
    }
  }

  return (
    <div className="page-stack">
      <section className="surface backup-panel">
        <div className="section-header">
          <div>
            <span className="eyebrow">Seguridad y recuperación</span>
            <h2><DatabaseBackup size={24} aria-hidden="true" /> Respaldo de Firestore</h2>
          </div>
        </div>
        <p>Esta herramienta utiliza tu sesión administrativa de Firebase para leer las apps,
          sus comentarios, likes, valoraciones y clics de descarga. No modifica ningún dato.</p>
        <div className="alert backup-warning">
          <strong>GitHub es público.</strong> Solo se sube el archivo cifrado. Guarda tu frase secreta
          fuera de GitHub: sin ella no podrás recuperar los datos.
        </div>

        <div className="backup-inputs">
          <label htmlFor="backup-pass">Frase secreta para cifrar (mínimo 20 caracteres)</label>
          <input id="backup-pass" type="password" autoComplete="new-password" value={passphrase}
            disabled={busy} onChange={event => setPassphrase(event.target.value)} />
          <label htmlFor="backup-confirm">Confirmar frase secreta</label>
          <input id="backup-confirm" type="password" autoComplete="new-password" value={confirmation}
            disabled={busy} onChange={event => setConfirmation(event.target.value)} />
          <label htmlFor="github-token">Token GitHub (solo necesario para guardarlo directamente en GitHub)</label>
          <input id="github-token" type="password" autoComplete="off" spellCheck={false}
            value={token} disabled={busy}
            placeholder="Token temporal, no se guarda"
            onChange={event => setToken(event.target.value)} />
          <small>
            <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">
              Crear token GitHub de acceso limitado
            </a>
            {' '}— selecciona únicamente appsem-store-admin y permiso de repositorio Contents: Read and write.
          </small>
        </div>
        <div className="backup-actions">
          <button className="primary-button" type="button" disabled={busy} onClick={() => backup('github')}>
            <LockKeyhole size={18} /> {busy ? 'Procesando...' : 'Guardar copia cifrada en GitHub'}
          </button>
          <button className="ghost-button" type="button" disabled={busy} onClick={() => backup('download')}>
            <Download size={18} /> Descargar copia cifrada
          </button>
        </div>
        {progress && <p role="status" aria-live="polite">{progress}</p>}
        {error && <div className="alert error" role="alert">{error}</div>}
        {result && (
          <div className="alert success" role="status">
            <strong>{result.destination === 'github' ? 'Respaldo cifrado confirmado en GitHub.' : 'Copia cifrada descargada.'}</strong>
            <p>{result.documents} documentos ({result.counts.apps} apps) · {result.path || result.filename}</p>
            {result.url && <a href={result.url} target="_blank" rel="noreferrer">Ver copia en GitHub <ExternalLink size={14} /></a>}
          </div>
        )}
      </section>
      <section className="surface backup-panel">
        <h3>Alcance de este respaldo</h3>
        <p>{BROWSER_BACKUP_SCOPE}. Esta opción no exporta Firebase Authentication,
          Cloud Storage ni los índices. Para un respaldo administrativo exhaustivo,
          incluyendo padres inexistentes u otras colecciones raíz, utiliza la herramienta
          de Firebase Admin SDK documentada en el proyecto.</p>
        <p><strong>Recuperación:</strong> descarga el archivo de GitHub y utiliza el comando
          <code> npm run firestore:decrypt </code> con la misma frase secreta; para probar restauración
          utiliza el emulador. No existe restauración automática sobre producción.</p>
      </section>
    </div>
  );
}
