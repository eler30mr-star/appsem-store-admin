/**
 * Seguridad del ensayo de recuperación: las escrituras deben quedarse en
 * GitHub Actions manual y Firestore Emulator estrictamente local.
 */
export function recoveryEnvironmentIssues(env) {
  const issues = [];
  if (env.GITHUB_ACTIONS !== 'true') issues.push('not-github-actions');
  if (env.GITHUB_EVENT_NAME !== 'workflow_dispatch') issues.push('not-manual-dispatch');
  if (env.GCLOUD_PROJECT !== 'demo-appsem-phase2-recovery') issues.push('wrong-demo-project');
  if (!['127.0.0.1:8080', 'localhost:8080'].includes(env.FIRESTORE_EMULATOR_HOST)) {
    issues.push('wrong-emulator-host');
  }
  if (env.GOOGLE_APPLICATION_CREDENTIALS) issues.push('unexpected-google-credentials');
  if (env.FIREBASE_SERVICE_ACCOUNT_JSON) issues.push('unexpected-firebase-service-account');
  return issues;
}

export function assertRecoveryEnvironment(env) {
  const issues = recoveryEnvironmentIssues(env);
  if (issues.length) {
    // Solo códigos de guardas; no revelar valores del entorno o secretos.
    throw new Error('Entorno denegado: ' + issues.join(','));
  }
}
