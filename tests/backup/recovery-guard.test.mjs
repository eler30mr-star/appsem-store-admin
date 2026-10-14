import test from 'node:test';
import assert from 'node:assert/strict';
import { recoveryEnvironmentIssues, assertRecoveryEnvironment } from '../../scripts/firestore/recovery-guard.mjs';

const safe = {
  GITHUB_ACTIONS: 'true',
  GITHUB_EVENT_NAME: 'workflow_dispatch',
  GCLOUD_PROJECT: 'demo-appsem-phase2-recovery',
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080'
};

test('aceptar únicamente localhost o 127.0.0.1 con puerto 8080', () => {
  for (const host of ['127.0.0.1:8080', 'localhost:8080']) {
    assert.doesNotThrow(() => assertRecoveryEnvironment({ ...safe, FIRESTORE_EMULATOR_HOST: host }));
  }
});

test('denegar destinos distintos del Emulator local exacto', () => {
  for (const host of ['127\\.0\\.0\\.1:8080', '127.0.0.1:8081',
    '0.0.0.0:8080', '192.168.0.2:8080', 'firestore.googleapis.com:443', '', undefined]) {
    assert.ok(recoveryEnvironmentIssues({ ...safe, FIRESTORE_EMULATOR_HOST: host }).includes('wrong-emulator-host'));
  }
});

test('denegar ejecutores no manuales, proyectos reales y credenciales externas', () => {
  const unsafe = [
    { ...safe, GITHUB_ACTIONS: undefined },
    { ...safe, GITHUB_EVENT_NAME: 'push' },
    { ...safe, GCLOUD_PROJECT: 'webs-8b1bf' },
    { ...safe, GOOGLE_APPLICATION_CREDENTIALS: '/tmp/service-account.json' },
    { ...safe, FIREBASE_SERVICE_ACCOUNT_JSON: '{"private_key":"redacted"}' }
  ];
  for (const env of unsafe) assert.throws(() => assertRecoveryEnvironment(env), /Entorno denegado/);
});
