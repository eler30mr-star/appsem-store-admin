import test from 'node:test';
import assert from 'node:assert/strict';
import { GeoPoint, Timestamp } from 'firebase-admin/firestore';
import { encode, decode, assertDocumentPath } from '../../scripts/firestore/codec.mjs';

const fakeDb = { doc: (path) => ({ path }) };

test('Timestamp preserva segundos y nanosegundos', () => {
  const result = decode(encode(new Timestamp(1697200000, 123456789)), fakeDb);
  assert.equal(result.seconds, 1697200000);
  assert.equal(result.nanoseconds, 123456789);
});
test('GeoPoint preserva latitud y longitud', () => {
  const result = decode(encode(new GeoPoint(-12.06, -77.03)), fakeDb);
  assert.equal(result.latitude, -12.06);
  assert.equal(result.longitude, -77.03);
});
test('Blob binario conserva bytes originales', () => {
  assert.deepEqual(decode(encode(Buffer.from([0, 1, 2, 127, 255])), fakeDb),
    Buffer.from([0, 1, 2, 127, 255]));
});
test('Campos con nombre de marcador se preservan como mapa de usuario', () => {
  const input = { '$appsemFirestoreBackupV1': 'texto real', nested: { n: 2 } };
  assert.deepEqual(decode(encode(input), fakeDb), input);
});
test('NaN y valores numéricos especiales preservados', () => {
  const v = decode(encode({ a: NaN, b: Infinity, c: -Infinity, d: -0 }), fakeDb);
  assert.ok(Number.isNaN(v.a));
  assert.equal(v.b, Infinity);
  assert.equal(v.c, -Infinity);
  assert.ok(Object.is(v.d, -0));
});
test('Rutas Firestore inválidas rechazadas', () => {
  for (const path of ['', 'apps', 'apps/x/comments', 'apps//', 'apps/../x/y']) {
    assert.throws(() => assertDocumentPath(path));
  }
  assert.doesNotThrow(() => assertDocumentPath('apps/id/comments/registro'));
});
test('Valores desconocidos no se restauran por aproximación', () => {
  assert.throws(() => decode({ '$appsemFirestoreBackupV1': 'misterio' }, fakeDb));
});
