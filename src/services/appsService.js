import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { getCategoryLabel } from '../data/categories';
import { DEFAULT_DEVELOPER } from '../config';

const appsRef = collection(db, 'apps');

function cleanText(value) {
  return String(value || '').trim();
}

function parseScreenshots(value) {
  if (Array.isArray(value)) return value.map(cleanText).filter(Boolean);

  return String(value || '')
    .split('\n')
    .map(cleanText)
    .filter(Boolean);
}

export function buildAppPayload(formData, mode = 'create') {
  const categoryKey = cleanText(formData.categoryKey) || 'otros';
  const payload = {
    title: cleanText(formData.title),
    slug: cleanText(formData.slug),
    categoryKey,
    category: getCategoryLabel(categoryKey),
    shortDescription: cleanText(formData.shortDescription),
    fullDescription: cleanText(formData.fullDescription),
    iconUrl: cleanText(formData.iconUrl),
    bannerUrl: cleanText(formData.bannerUrl),
    screenshots: parseScreenshots(formData.screenshots),
    playStoreUrl: cleanText(formData.playStoreUrl),
    privacyPolicyUrl: cleanText(formData.privacyPolicyUrl),
    termsUrl: cleanText(formData.termsUrl),
    legalNoticeUrl: cleanText(formData.legalNoticeUrl),
    accountDeletionUrl: cleanText(formData.accountDeletionUrl),
    securityReportUrl: cleanText(formData.securityReportUrl),
    packageName: cleanText(formData.packageName),
    appSize: cleanText(formData.appSize),
    operatingSystem: cleanText(formData.operatingSystem) || 'Android',
    minAndroidVersion: cleanText(formData.minAndroidVersion),
    currentVersion: cleanText(formData.currentVersion),
    lastUpdate: cleanText(formData.lastUpdate),
    languages: cleanText(formData.languages),
    offlineUse: cleanText(formData.offlineUse),
    containsAds: cleanText(formData.containsAds),
    inAppPurchases: cleanText(formData.inAppPurchases),
    ageRating: cleanText(formData.ageRating),
    price: cleanText(formData.price),
    developer: cleanText(formData.developer) || DEFAULT_DEVELOPER,
    featured: Boolean(formData.featured),
    status: cleanText(formData.status) || 'draft',
    updatedAt: serverTimestamp(),
  };

  if (mode === 'create') {
    return {
      ...payload,
      likesCount: 0,
      downloadsCount: 0,
      ratingCount: 0,
      ratingSum: 0,
      ratingAverage: 0,
      commentsCount: 0,
      createdAt: serverTimestamp(),
    };
  }

  return payload;
}

export function validateAppPayload(payload) {
  const errors = {};

  if (!payload.title) errors.title = 'El nombre de la app es obligatorio.';
  if (!payload.slug) errors.slug = 'El slug es obligatorio.';
  if (!payload.shortDescription) errors.shortDescription = 'La descripción corta es obligatoria.';
  if (!payload.fullDescription) errors.fullDescription = 'La descripción completa es obligatoria.';
  if (!payload.iconUrl) errors.iconUrl = 'El icono por URL es obligatorio.';
  if (!payload.playStoreUrl) errors.playStoreUrl = 'El enlace de Google Play es obligatorio.';
  if (!payload.privacyPolicyUrl) errors.privacyPolicyUrl = 'La política de privacidad de la app es obligatoria.';

  return errors;
}

export function subscribeToApps(callback, onError) {
  const q = query(appsRef, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const apps = snapshot.docs.map((document) => ({
        id: document.id,
        ...document.data(),
      }));
      callback(apps);
    },
    onError
  );
}

export async function getApp(appId) {
  const snapshot = await getDoc(doc(db, 'apps', appId));
  if (!snapshot.exists()) throw new Error('La app no existe.');
  return { id: snapshot.id, ...snapshot.data() };
}

export async function createApp(formData) {
  const payload = buildAppPayload(formData, 'create');
  const errors = validateAppPayload(payload);

  if (Object.keys(errors).length > 0) {
    const error = new Error('Revisa los campos obligatorios.');
    error.fields = errors;
    throw error;
  }

  return addDoc(appsRef, payload);
}

export async function updateApp(appId, formData) {
  const payload = buildAppPayload(formData, 'edit');
  const errors = validateAppPayload(payload);

  if (Object.keys(errors).length > 0) {
    const error = new Error('Revisa los campos obligatorios.');
    error.fields = errors;
    throw error;
  }

  return updateDoc(doc(db, 'apps', appId), payload);
}

export async function deleteApp(appId) {
  return deleteDoc(doc(db, 'apps', appId));
}

export async function updateAppStatus(appId, status) {
  return updateDoc(doc(db, 'apps', appId), {
    status,
    updatedAt: serverTimestamp(),
  });
}

export async function loadAllComments(apps = []) {
  const results = [];

  for (const app of apps) {
    const commentsRef = collection(db, 'apps', app.id, 'comments');
    const commentsQuery = query(commentsRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(commentsQuery);

    snapshot.forEach((commentDocument) => {
      results.push({
        id: commentDocument.id,
        appId: app.id,
        appTitle: app.title,
        ...commentDocument.data(),
      });
    });
  }

  return results.sort((a, b) => {
    const aTime = a.createdAt?.seconds || 0;
    const bTime = b.createdAt?.seconds || 0;
    return bTime - aTime;
  });
}

export async function approveComment(comment) {
  await updateDoc(doc(db, 'apps', comment.appId, 'comments', comment.id), {
    approved: true,
    approvedAt: serverTimestamp(),
  });

  if (!comment.approved) {
    await updateDoc(doc(db, 'apps', comment.appId), {
      commentsCount: increment(1),
      updatedAt: serverTimestamp(),
    });
  }
}

export async function hideComment(comment) {
  await updateDoc(doc(db, 'apps', comment.appId, 'comments', comment.id), {
    approved: false,
    updatedAt: serverTimestamp(),
  });

  if (comment.approved) {
    await updateDoc(doc(db, 'apps', comment.appId), {
      commentsCount: increment(-1),
      updatedAt: serverTimestamp(),
    });
  }
}

export async function removeComment(comment) {
  await deleteDoc(doc(db, 'apps', comment.appId, 'comments', comment.id));

  if (comment.approved) {
    await updateDoc(doc(db, 'apps', comment.appId), {
      commentsCount: increment(-1),
      updatedAt: serverTimestamp(),
    });
  }
}
