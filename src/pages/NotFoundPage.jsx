import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card compact-card">
        <h1>Página no encontrada</h1>
        <p>La ruta que intentas abrir no existe en el panel admin.</p>
        <Link className="primary-button" to="/dashboard">Volver al panel</Link>
      </section>
    </main>
  );
}
