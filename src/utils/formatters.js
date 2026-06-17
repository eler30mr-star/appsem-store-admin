export function formatNumber(value = 0) {
  return new Intl.NumberFormat('es-PE').format(Number(value || 0));
}

export function formatRating(app) {
  const ratingCount = Number(app?.ratingCount || 0);
  const ratingSum = Number(app?.ratingSum || 0);
  const legacyAverage = Number(app?.ratingAverage || 0);

  if (ratingCount > 0 && ratingSum > 0) return (ratingSum / ratingCount).toFixed(1);
  if (legacyAverage > 0) return legacyAverage.toFixed(1);
  return '0.0';
}

export function formatDate(value) {
  if (!value) return 'Sin fecha';
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';

  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
