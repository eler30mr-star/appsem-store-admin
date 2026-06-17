import { onAuthStateChanged, signOut } from 'firebase/auth';
import { ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ADMIN_EMAIL } from '../config';
import { auth } from '../firebase';

export default function ProtectedRoute({ children }) {
  const [state, setState] = useState({ loading: true, user: null, denied: false });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setState({ loading: false, user: null, denied: false });
        return;
      }

      if (user.email !== ADMIN_EMAIL) {
        await signOut(auth);
        setState({ loading: false, user: null, denied: true });
        return;
      }

      setState({ loading: false, user, denied: false });
    });

    return () => unsubscribe();
  }, []);

  if (state.loading) {
    return (
      <main className="auth-shell">
        <div className="loader-card">
          <span className="loader" />
          <p>Verificando acceso seguro...</p>
        </div>
      </main>
    );
  }

  if (state.denied) {
    return (
      <main className="auth-shell">
        <section className="auth-card compact-card">
          <div className="auth-icon danger">
            <ShieldAlert size={26} />
          </div>
          <h1>Acceso bloqueado</h1>
          <p>Este panel solo permite el correo administrador autorizado.</p>
          <strong>{ADMIN_EMAIL}</strong>
          <a className="primary-button" href="/login">Volver al inicio de sesión</a>
        </section>
      </main>
    );
  }

  if (!state.user) return <Navigate to="/login" replace />;

  return children;
}
