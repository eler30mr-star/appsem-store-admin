/**
 * Fase 3: analizador PURO. Nunca importa Firebase ni realiza escrituras.
 * Un reporte no demuestra que el historial de eventos esté completo.
 */
const COUNT_KEYS = ['commentsCount', 'likesCount', 'ratingCount', 'downloadsCount'];
const VALID_STATES = new Set(['draft', 'published', 'archived']);
const VALID_COLLECTIONS = ['comments', 'likes', 'ratings', 'downloadClicks', 'downloads'];

function validCount(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

export function auditAppIntegrity({ alias, exists, app = {}, events = {}, unknownCollections = 0 }) {
  const issues = [];
  const addIssue = (code, severity) => issues.push({ code, severity });
  const metrics = {};
  const counts = Object.fromEntries(
    COUNT_KEYS.map(key => [key, validCount(app[key]) ? app[key] : null])
  );
  const lists = Object.fromEntries(
    VALID_COLLECTIONS.map(key => [key, Array.isArray(events[key]) ? events[key] : []])
  );
  const observed = {
    commentsCount: lists.comments.filter(c => c?.approved === true).length,
    likesCount: lists.likes.length,
    ratingCount: lists.ratings.length,
    downloadsCount: lists.downloadClicks.length
  };

  if (!exists) {
    if (Object.values(lists).some(v => v.length > 0) || unknownCollections > 0) {
      addIssue('ORPHANED_SUBCOLLECTIONS', 'error');
    }
    return {
      alias, parentExists: false, status: null, unknownSubcollections: unknownCollections,
      metrics: {}, issues
    };
  }

  const status = VALID_STATES.has(app.status) ? app.status : 'invalid';
  if (status === 'invalid') addIssue('INVALID_APP_STATUS', 'error');
  if (status === 'archived' && app.featured === true) {
    addIssue('ARCHIVED_APP_FEATURED', 'error');
  }

  for (const key of COUNT_KEYS) {
    const stored = counts[key];
    const value = observed[key];
    const exact = key === 'commentsCount';
    metrics[key] = {
      stored,
      observed: value,
      evidence: exact ? 'approved-comments' : 'partial-event-inventory',
      verdict: stored === null ? 'invalid-counter'
        : stored === value ? (exact ? 'matches' : 'observed-match-not-proof')
          : (exact ? 'mismatch' : 'historical-review')
    };
    if (stored === null) addIssue('INVALID_' + key.toUpperCase(), 'error');
    else if (stored !== value) {
      addIssue(exact ? 'APPROVED_COMMENTS_COUNT_MISMATCH'
        : 'HISTORICAL_' + key.toUpperCase() + '_DIFFERENCE', exact ? 'error' : 'review');
    }
  }

  const malformedComments = lists.comments.filter(
    c => c?.approved !== true && c?.approved !== false
  ).length;
  if (malformedComments) addIssue('COMMENTS_WITH_INVALID_APPROVAL_STATE', 'review');

  const ratings = lists.ratings.map(r => r?.rating);
  const validRatings = ratings.filter(r => Number.isInteger(r) && r >= 1 && r <= 5);
  if (ratings.length !== validRatings.length) {
    addIssue('INVALID_RATING_EVENTS', 'review');
  }
  const allEventsAccountedFor = counts.ratingCount !== null
    && counts.ratingCount === ratings.length
    && ratings.length === validRatings.length;
  const observedRatingSum = validRatings.reduce((sum, n) => sum + n, 0);
  const ratingSum = Number.isSafeInteger(app.ratingSum) && app.ratingSum >= 0
    ? app.ratingSum : null;
  const ratingAverage = typeof app.ratingAverage === 'number'
    && Number.isFinite(app.ratingAverage) && app.ratingAverage >= 0
    && app.ratingAverage <= 5 ? app.ratingAverage : null;
  metrics.ratings = {
    storedSum: ratingSum, storedAverage: ratingAverage,
    observedValidEvents: validRatings.length,
    observedSum: observedRatingSum,
    evidence: allEventsAccountedFor ? 'observed-parity-not-completeness-proof'
      : 'insufficient-history',
    verdict: 'historical-review'
  };
  if (ratingSum === null || ratingAverage === null) {
    addIssue('INVALID_OR_MISSING_RATING_AGGREGATE', 'review');
  } else if (allEventsAccountedFor) {
    const expectedAverage = ratings.length ? observedRatingSum / ratings.length : 0;
    if (ratingSum !== observedRatingSum) addIssue('RATING_SUM_DIFFERS_FROM_EVENTS', 'review');
    if (Math.abs(ratingAverage - expectedAverage) > 0.005000001) {
      addIssue('RATING_AVERAGE_DIFFERS_FROM_EVENTS', 'review');
    }
    if (ratingSum === observedRatingSum
      && Math.abs(ratingAverage - expectedAverage) <= 0.005000001) {
      metrics.ratings.verdict = 'matches-observed-not-proof';
    }
  } else {
    addIssue('RATING_HISTORY_NOT_RECONCILABLE', 'review');
  }

  if (lists.downloads.length) {
    addIssue('LEGACY_DOWNLOADS_COLLECTION_PRESENT', 'review');
  }
  if (unknownCollections > 0) addIssue('UNKNOWN_SUBCOLLECTIONS', 'review');

  return {
    alias, parentExists: true, status, unknownSubcollections: unknownCollections,
    metrics, issues
  };
}

export function summarizeIntegrity(rows, projectId, mode) {
  return {
    schemaVersion: 'appsem-integrity-audit-v1',
    mode, projectId,
    advisory: 'Solo lectura. Las diferencias historicas NO autorizan una migracion ni demuestran registros completos.',
    summary: {
      appReferences: rows.length,
      existingApps: rows.filter(r => r.parentExists).length,
      orphanParents: rows.filter(r => !r.parentExists).length,
      errors: rows.reduce((n, r) => n + r.issues.filter(i => i.severity === 'error').length, 0),
      reviews: rows.reduce((n, r) => n + r.issues.filter(i => i.severity === 'review').length, 0)
    },
    apps: rows
  };
}
