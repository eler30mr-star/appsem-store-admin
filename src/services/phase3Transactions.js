/**
 * Fase 3: operaciones atómicas e idempotentes del panel administrativo.
 * Todas las lecturas ocurren antes de escribir en Firestore.
 * No se borran apps ni subcolecciones: se archivan y restauran a borrador.
 * Este módulo no inicia conexiones externas; recibe db explícitamente.
 */
import { doc, runTransaction, serverTimestamp, increment } from 'firebase/firestore';

const APP_STATES = new Set(['draft', 'published', 'archived']);
const COMMENT_ACTIONS = new Set(['approve', 'hide', 'remove']);

function checkedCount(value) {
  if (value === undefined || value === null) return 0;
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error('El contador de comentarios requiere conciliación antes de continuar.');
  }
  return value;
}

export async function moderateCommentAtomic(db, comment, action) {
  if (!COMMENT_ACTIONS.has(action) || !comment?.appId || !comment?.id) {
    throw new Error('Operación de moderación inválida.');
  }
  const appRef = doc(db, 'apps', comment.appId);
  const commentRef = doc(db, 'apps', comment.appId, 'comments', comment.id);

  return runTransaction(db, async (tx) => {
    const appSnapshot = await tx.get(appRef);
    const commentSnapshot = await tx.get(commentRef);
    if (!appSnapshot.exists()) throw new Error('La aplicación ya no existe.');
    if (!commentSnapshot.exists()) {
      if (action === 'remove') return { changed: false, deleted: true };
      throw new Error('El comentario ya no existe.');
    }

    const wasApproved = commentSnapshot.data().approved === true;
    const willBeApproved = action === 'approve';
    const delta = action === 'remove' ? (wasApproved ? -1 : 0) :
      Number(willBeApproved) - Number(wasApproved);
    const currentCount = checkedCount(appSnapshot.data().commentsCount);
    if (currentCount + delta < 0) {
      throw new Error('Contador inconsistente: concilia los comentarios antes de moderar.');
    }

    if (action !== 'remove' && wasApproved === willBeApproved) {
      return { changed: false, approved: wasApproved };
    }

    if (action === 'remove') {
      tx.delete(commentRef);
    } else if (willBeApproved) {
      tx.update(commentRef, {
        approved: true,
        approvedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } else {
      tx.update(commentRef, {
        approved: false,
        updatedAt: serverTimestamp()
      });
    }
    if (delta !== 0) {
      tx.update(appRef, {
        commentsCount: increment(delta),
        updatedAt: serverTimestamp()
      });
    }
    return { changed: true, deleted: action === 'remove', delta };
  });
}

export async function archiveAppAtomic(db, appId) {
  if (!appId) throw new Error('Identificador de aplicación requerido.');
  const appRef = doc(db, 'apps', appId);
  return runTransaction(db, async (tx) => {
    const snapshot = await tx.get(appRef);
    if (!snapshot.exists()) throw new Error('La aplicación no existe.');
    if (snapshot.data().status === 'archived') return { changed: false };
    tx.update(appRef, {
      status: 'archived', featured: false,
      archivedAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
    return { changed: true };
  });
}

export async function restoreAppAtomic(db, appId) {
  if (!appId) throw new Error('Identificador de aplicación requerido.');
  const appRef = doc(db, 'apps', appId);
  return runTransaction(db, async (tx) => {
    const snapshot = await tx.get(appRef);
    if (!snapshot.exists()) throw new Error('La aplicación no existe.');
    if (snapshot.data().status !== 'archived') return { changed: false };
    // Nunca volver a publicar automáticamente al restaurar.
    tx.update(appRef, {
      status: 'draft', featured: false,
      restoredAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
    return { changed: true };
  });
}

export async function updatePublicationAtomic(db, appId, target) {
  if (!appId || !['draft', 'published'].includes(target)) {
    throw new Error('Estado de publicación inválido.');
  }
  const appRef = doc(db, 'apps', appId);
  return runTransaction(db, async (tx) => {
    const snapshot = await tx.get(appRef);
    if (!snapshot.exists()) throw new Error('La aplicación no existe.');
    if (!APP_STATES.has(snapshot.data().status)) {
      throw new Error('Estado de aplicación desconocido.');
    }
    if (snapshot.data().status === 'archived') {
      throw new Error('Primero restaura la aplicación archivada a borrador.');
    }
    if (snapshot.data().status === target) return { changed: false };
    tx.update(appRef, { status: target, updatedAt: serverTimestamp() });
    return { changed: true };
  });
}
