# Fase 3 — Segunda entrega: auditoría de integridad (solo lectura)
**Fecha:** 14/10/2026 · **Proyecto:** Appsem Store Admin · **No cierra Fase 3**

## Alcance
Se añadió una inspección exclusivamente de lectura, separada de la UI y de las métricas públicas:
- Comprueba \`commentsCount\` contra la cantidad de comentarios con \`approved === true\`.
- Contrasta eventos observados de \`likes\`, \`ratings\` y \`downloadClicks\` con los contadores, **sin asumir que el historial es completo** (incluidas interacciones previas a Fase 2).
- Presenta \`ratingSum\`/\`ratingAverage\` y suma de estrellas observadas; solo señala una revisión, sin aplicar valores derivados al servidor.
- Detecta apps con estados desconocidos, archivadas destacadas, registros de aprobación inválidos y posibles subcolecciones huérfanas (padre ausente).
- Reconoce \`downloads\` como colección heredada, pero **no la mezcla** con \`downloadClicks\`.
- Produce JSON determinista anonimizado; los identificadores de aplicaciones son alias HMAC con clave privada externa, no IDs reales. No registra nombres, comentarios, identificadores de eventos, IP ni credenciales.
- Límites estrictos de referencias y eventos; si se exceden, el reporte falla completo (no presenta resultados parciales como definitivos).

## Pruebas seguras
\`\`\`bash
npm ci
npm run test:phase3:integrity
\`\`\`
Prueba con el Firebase Emulator local, sin usar el Firebase productivo. El CI de GitHub ejecuta automáticamente esta suite en cada PR a \`main\`.

Para auditar explícitamente el Emulator ya levantado en el puerto 8080:
\`\`\`bash
PHASE3_AUDIT_KEY="solo-demo-clave-minimo-16" FIRESTORE_EMULATOR_HOST="127.0.0.1:8080" \
  node scripts/phase3/audit-integrity.mjs --project=demo-appsem-phase3 --read-emulator
\`\`\`

## Producción: prohibido por defecto
La herramienta **no lee producción sin** un proyecto explícito, una confirmación especial, una clave de HMAC y credenciales Application Default Credentials (ADC) de lectura. El código no ejecuta escrituras.
\`\`\`bash
# SOLO tras autorización y revisión de costes/permisos; NO se ejecutó en esta entrega.
PHASE3_AUDIT_KEY="<clave-privada-no-compartida>" \
  node scripts/phase3/audit-integrity.mjs --project=webs-8b1bf --confirm-production-read-only
\`\`\`
Guardar el informe fuera del repositorio. Los hashes HMAC siguen siendo pseudónimos; no publicar informes innecesariamente. Pueden existir costes de lectura en Firestore. **Nunca** suministrar credenciales en tickets, chat o código.

## Interpretación y siguientes pasos
- \`error\` en \`APPROVED_COMMENTS_COUNT_MISMATCH\` es una discordancia medible de documentos presentes.
- \`review\` en likes, ratings o descargas **no es prueba de un error**: los eventos legados, buckets y políticas de retención pueden hacer incompleto el inventario.
- Un promedio igual al calculado con eventos conservados no certifica que todos los eventos históricos existan.
- No se agrega ningún \`update\`, \`delete\`, \`set\` ni transacción de corrección al auditor.
- Próxima entrega: respaldo nuevo y validado, revisión del informe real bajo autorización y un plan de dry-run/rollback por app. Aún falta confirmar deployment Production y pruebas funcionales con app sintética.

**Invariantes:** no modificar Firestore Rules, backend Turnstile/HMAC ni operaciones actuales de moderación.
