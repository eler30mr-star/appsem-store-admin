import test from 'node:test';
import assert from 'node:assert/strict';
import { createSlug } from '../../src/utils/slug.js';
import { CATEGORIES, getCategoryLabel } from '../../src/data/categories.js';
import { formatDate, formatNumber, formatRating } from '../../src/utils/formatters.js';

test('slug: normaliza tildes, espacios y signos', () => {
  assert.equal(createSlug('  Biblia Única y Fe!  '), 'biblia-unica-y-fe');
});

test('slug: agrupa guiones y espacios', () => {
  assert.equal(createSlug('Biblia--- Universal   2'), 'biblia-universal-2');
});

test('slug: vacío produce cadena vacía', () => {
  assert.equal(createSlug(''), '');
});

test('slug: nombres equivalentes pueden colisionar (comportamiento vigente)', () => {
  assert.equal(createSlug('Café'), createSlug('Cafe'));
});

test('categorías: claves de catálogo únicas', () => {
  assert.equal(new Set(CATEGORIES.map(({ key }) => key)).size, CATEGORIES.length);
});

test('categorías: conserva correspondencias legadas', () => {
  for (const key of ['cristianas', 'christian', 'bible']) {
    assert.equal(getCategoryLabel(key), 'Libros y referencias');
  }
});

test('categorías: clave desconocida se presenta como Otros', () => {
  assert.equal(getCategoryLabel('no-existe'), 'Otros');
});

test('rating: usa suma/cantidad si ambas existen', () => {
  assert.equal(formatRating({ ratingCount: 3, ratingSum: 14, ratingAverage: 2 }), '4.7');
});

test('rating: compatibilidad con promedio legado', () => {
  assert.equal(formatRating({ ratingCount: 2, ratingAverage: 4.5 }), '4.5');
});

test('rating: sin valoraciones muestra cero', () => {
  assert.equal(formatRating({}), '0.0');
});

test('fecha: valor ausente o inválido tiene fallback', () => {
  assert.equal(formatDate(null), 'Sin fecha');
  assert.equal(formatDate('fecha-inválida'), 'Sin fecha');
});

test('formato numérico: representa correctamente 0', () => {
  assert.equal(formatNumber(null), '0');
});
