import test from 'node:test';
import assert from 'node:assert/strict';
import { auditAppIntegrity, summarizeIntegrity } from '../../scripts/phase3/integrity-core.mjs';

test('Fase 3: discrepancias de comentarios son comprobables; eventos históricos no se presumen completos', () => {
  const app = {
    status: 'archived', featured: true, commentsCount: 1, likesCount: 9,
    ratingCount: 3, downloadsCount: 12, ratingSum: 12, ratingAverage: 4
  };
  const row = auditAppIntegrity({
    alias: 'pseudonimo-fixture', exists: true, app,
    events: {
      comments: [{ approved: true }, { approved: true }, { approved: false }],
      likes: [{ createdAt: 1 }],
      ratings: [{ rating: 5 }],
      downloadClicks: []
    }
  });
  assert.equal(row.metrics.commentsCount.verdict, 'mismatch');
  assert.equal(row.metrics.likesCount.verdict, 'historical-review');
  assert.equal(row.metrics.ratings.verdict, 'historical-review');
  assert.ok(row.issues.some(i => i.code === 'ARCHIVED_APP_FEATURED'));
  assert.ok(row.issues.some(i => i.code === 'APPROVED_COMMENTS_COUNT_MISMATCH'));
  const result = summarizeIntegrity([row], 'demo-appsem-phase3', 'emulator');
  assert.equal(result.summary.errors, 2);
  assert.equal(result.summary.existingApps, 1);
});

test('Fase 3: alias de padres inexistentes y ratings de eventos completos no implican migración', () => {
  const orphan = auditAppIntegrity({
    alias: 'missing-parent', exists: false, events: { likes: [{ createdAt: 1 }] }
  });
  assert.ok(orphan.issues.some(i => i.code === 'ORPHANED_SUBCOLLECTIONS'));
  const row = auditAppIntegrity({
    alias: 'example', exists: true,
    app: { status: 'published', commentsCount: 0, likesCount: 0, ratingCount: 2,
      downloadsCount: 0, ratingSum: 9, ratingAverage: 4.5 },
    events: { ratings: [{ rating: 4 }, { rating: 5 }] }
  });
  assert.equal(row.metrics.ratings.verdict, 'matches-observed-not-proof');
  assert.equal(row.metrics.ratingCount.verdict, 'observed-match-not-proof');
  assert.equal(row.issues.length, 0);
});
