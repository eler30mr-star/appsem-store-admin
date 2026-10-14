# APPSEM STORE — DOCUMENTO DE AVANCE Y CONTINUIDAD
**Fecha de corte:** 14 de octubre de 2026 (Perú)  
**Proyecto:** Appsem Store (tienda pública) + Appsem Store Admin (panel)  
**Fase actual:** **FASE 3 — Integridad y modelo de datos**  
**Estado:** **EN DESARROLLO. Primera entrega fusionada y validada en Emulator; no es el cierre de la fase.**  
**Base de datos compartida:** Firebase `webs-8b1bf`.

> Este documento es el punto de entrada para continuar en un chat nuevo. Distingue lo implementado, lo probado y lo que no está desplegado ni verificado. No repetir la Fase 2, no usar datos reales para pruebas destructivas y no modificar controles de seguridad aprobados salvo fallo reproducible.

## 1. Repositorios, referencias y fuente de requisitos

| Recurso | Referencia |
|---|---|
| **Appsem Store Admin** | https://github.com/eler30mr-star/appsem-store-admin |
| **Appsem Store pública** | https://github.com/eler30mr-star/appsem-store |
| **Plan original de 8 fases** | `docs/auditorias/Auditoria_1_Appsem_Store_Admin.md` (en repo Admin) |
| **Contrato de Fase 3 v1** | `docs/fase-03/README.md` (en repo Admin) |
| **Código de primera entrega Fase 3** | [PR #10](https://github.com/eler30mr-star/appsem-store-admin/pull/10), **fusionado en `main`** |
| **Commit de primera entrega en `main`** | `1ce91cd620bf0a073c72167d46c64b004a275c71` |
| **CI de `main` tras la fusión** | [Actions #38652005845](https://github.com/eler30mr-star/appsem-store-admin/actions/runs/38652005845), **SUCCESS** |
| **CI del PR** | [Actions #38651856327](https://github.com/eler30mr-star/appsem-store-admin/actions/runs/38651856327), **SUCCESS** |
| **Cierre Fase 2** | `docs/fase-02/ACTIVACION_COORDINADA.md` (en repo Admin) |

El plan de Fase 3 exige: **contrato canónico versionado**, **moderación atómica**, **archivado/retención**, **conciliación de estadísticas** y **migraciones reversibles**; el cierre requiere verificar consistencia y no pérdida ante fallos.

## 2. Fases anteriores y estado productivo conocido

- **Fase 1 — Línea base/respaldo:** cerrada. El respaldo cifrado tomado el 13/10/2026 se descifró y restauró exitosamente en Firebase Emulator, con **31 documentos**. Esta evidencia es **histórica**; no representa una copia actual de los cambios posteriores.
- **Fase 2 — Seguridad:** cerrada funcionalmente. Turnstile real, backend Vercel + Firebase Admin, cliente con métricas protegidas, reglas reforzadas Firestore publicadas y verificadas desde SDK anónimo. El propietario confirmó que Me gusta, valoración, comentario y descarga funcionan; después de publicar reglas confirmó poder **aprobar comentarios desde Admin**.
- **Variables productivas de Store configuradas en Fase 2:** `METRICS_BACKEND_ENABLED=true`, `VITE_METRICS_BACKEND=server`, claves Turnstile y credencial privada de Firebase Admin en Vercel. **No exponer valores ni rotar HMAC sin migración**.
- **Reglas actuales:** versión reforzada; referencia `docs/fase-02/firestore.hardened.rules`. **No desplegar `firestore.rules` antiguo** de ninguno de los repositorios. El propietario conserva copia privada de reglas anteriores.
- Fase 3 **no ha cambiado** las reglas ni el servidor de métricas público.

## 3. Fase 3 — LO IMPLEMENTADO y validado en código

### 3.1 Moderación transaccional — Primera entrega

En `src/services/phase3Transactions.js`:
- `moderateCommentAtomic(db, comment, 'approve' | 'hide' | 'remove')`: en **una transacción Firestore**, lee el estado **real** del comentario y la aplicación y actualiza comentario y `commentsCount` juntos.
- Aprobar dos veces no suma dos veces; ocultar dos veces no resta dos veces; eliminar un comentario pendiente no cambia recuento y eliminar uno aprobado decrementa una vez.
- Si el contador histórico es inválido o la operación lo dejaría negativo, **rechaza toda la transacción sin escrituras parciales**. En ese caso hay que conciliar; no alterar el contador a ojo.
- `src/services/appsService.js` ya utiliza estas transacciones para aprobar, ocultar y eliminar comentarios.

### 3.2 Archivado reversible, sin pérdida de subcolecciones

- Se sustituyó el borrado simple de un documento `apps/{id}` por `archiveAppAtomic`: escribe `status: archived`, `featured: false` y timestamps, **sin eliminar datos**.
- `restoreAppAtomic` restaura a `status: draft`; **no publica automáticamente**.
- `updatePublicationAtomic` impide publicar una app archivada antes de restaurarla.
- `src/pages/AppsPage.jsx` contiene controles **Archivar** y **Restaurar**, y filtro de archivadas.
- `updateApp` protege la edición directa de una app archivada; no puede reactivarse por entrar al formulario mediante URL.
- Sin borrado físico masivo ni limpieza irreversible de subcolecciones.

### 3.3 Contrato canónico compatible v1

`docs/fase-03/README.md` define, sin migración destructiva:
- Estados `draft`, `published`, `archived`.
- Contadores `likesCount`, `downloadsCount`, `ratingCount`, `ratingSum`, `ratingAverage`, `commentsCount`.
- `commentsCount` significa **comentarios aprobados**; el backend de nuevos likes/ratings/downloads usa Firestore Admin.
- Subcolecciones: `comments`, `likes`, `ratings`, `downloadClicks`. Conservar eventos e identificadores heredados.
- `ratingSum` exacto solo cuando existe y es consistente; con históricos sin registros completos, los promedios pueden ser aproximados. **No inventar valores históricos**.
- `updatedAt` editorial y `metricsUpdatedAt` de métricas cumplen funciones diferentes.

### 3.4 Pruebas ejecutadas

- Nueva suite: `tests/phase3/integrity-emulator.test.mjs`.
- Comando: `npm run test:phase3:integrity`.
- Ejecución solo en **Firebase Emulator**, proyecto ficticio `demo-appsem-phase3`.
- Verifica repetición y concurrencia al aprobar, ocultación/eliminación sin doble recuento, ausencia de escrituras con contador incoherente, archivado y restauración con subcolecciones intactas, bloqueo de publicación de archivadas.
- Integrada como puerta de calidad en `.github/workflows/fase-01-baseline.yml`; además CI ejecuta build Vite, suites anteriores y reglas de Emulator.
- **Resultado:** PR y `main` **SUCCESS** (enlaces en tabla de la sección 1). Estas pruebas **no** equivalen a probar el panel actualizado en producción.

## 4. LIMITACIÓN DEL DESPLIEGUE — PRIMER PENDIENTE

**La primera entrega de Fase 3 está en GitHub `main`, pero NO está confirmada en Production de Vercel.** Se intentó realizar el despliegue manual de Admin y Vercel devolvió **HTTP 402: `api-deployments-free-per-day`**, debido al límite diario del plan Hobby. No interpretar los despliegues READY de tipo *preview* (`target: null`) como confirmación de producción.

**Al retomar:**
1. Consultar en Vercel el **deployment asociado al dominio de producción de `appsem-store-admin`**, su `target`, estado y SHA. Contrastar con el commit de Fase 3 `1ce91cd620bf0a073c72167d46c64b004a275c71` (o un SHA posterior que contenga los cambios).
2. Si Production sigue anterior y el límite permite despliegues, desplegar `main` en **Production** y confirmar `READY` y el SHA correcto. Si continúa HTTP 402, **no repetir indefinidamente**, dejar documentado el bloqueo.
3. Con una app **de prueba** (no con una app publicada real), comprobar desde Admin: archivar → desaparece de tienda pública → conserva likes/comentarios/ratings → restaurar como borrador → publicar explícitamente.
4. Verificar moderación con **comentario de prueba**, incluida repetición del botón; no usar contenido real para pruebas de eliminación.
5. **No cambiar reglas de Firestore**, no volver al cliente heredado, no modificar Turnstile/HMAC.

## 5. SIGUIENTES ENTREGAS QUE FALTAN — prioridad

### P1 — Conciliación en modo solo lectura (PRÓXIMA TAREA DE DESARROLLO)

Crear `scripts/phase3/audit-integrity.mjs` y un reporte `docs/fase-03/...`:
- Por cada app (tanto publicada como archivada/borrador), comparar `commentsCount` con número de comentarios aprobados existentes.
- Comparar `likesCount`, `ratingCount` y `downloadsCount` con documentos de evento cuando sea viable; tener cuidado con eventos legados, registros por buckets y posible retención incompleta.
- Comparar `ratingSum`, `ratingAverage` y valoraciones individuales **sin redondear prematuramente**; marcar como `unknown` o `historical-approximation` cuando no sea demostrable.
- Detectar documentos potencialmente huérfanos y estados/campos inconsistentes.
- Producir informe determinista y anonimizado; **no imprimir comentarios, IDs de visitantes, direcciones IP ni secretos**.
- Probar con fixtures en Emulator que incluyan apps correctas, contador desajustado, ratings legados y archivadas. **No editar datos productivos**.

### P2 — Migración corregida y reversible

Solo después de auditar:
- Obtener **backup reciente** del estado actual (el de 31 documentos es anterior a las interacciones de Fase 2).
- Implementar **dry-run** de correcciones: diferencias antes/después, operación por app, validación de cambios concurrentes, idempotencia, límite de lotes y rollback parcial.
- Probar que fallos simulados **no producen pérdida de datos**. No ejecutar correcciones en producción sin revisar el informe y proteger datos nuevos.

### P3 — Retención y eliminación definitiva controlada

- Conservar el **archivado** como opción predeterminada.
- Si se requiere eliminar físicamente, hacerlo mediante una operación administrativa de servidor que inventaríe y borre **todas** las subcolecciones controladamente, con política de retención, confirmación expresa, respaldo y auditoría. **No añadir botón destructivo al frontend** en esta etapa.

### P4 — Cierre de Fase 3

- Formalizar esquema versionado y compatibilidad entre Admin/Store.
- Verificar nuevos campos y contadores con tráfico concurrente en Emulator.
- Verificar formulario/editor, archivado y moderación en entorno desplegado sin afectar apps reales.
- Entregar documentación final de migración, reconciliación, evidencia de no pérdida y estado productivo verificable.
- Solo entonces marcar Fase 3 completada y pasar a la **Fase 4 — Gestión profesional del catálogo**.

## 6. Riesgos y reglas de continuidad

- **Importante:** las estadísticas históricas de Fase 2 no garantizan que `commentsCount` haya estado sincronizado antes de las transacciones. Si aparece error `concilia`, diagnosticar y corregir con herramientas auditables, no suprimir la guarda.
- No borrar `apps/{id}` directamente: Firestore **no elimina** automáticamente sus subcolecciones.
- El Admin utiliza el usuario con correo verificado confirmado durante Fase 2. Mantener esas reglas.
- No afirmar pruebas E2E productivas de las funcionalidades nuevas mientras Vercel no despliegue y se verifique.
- Avanzar con PR pequeños y fusionar `main` solo si Firebase Emulator + integración + build pasan.
- El proyecto continúa en **Fase 3 abierta**; la primera entrega está terminada y fusionada, pero la conciliación/migración y verificación productiva siguen pendientes.

## 7. Instrucción para retomar en un nuevo chat

> Continúa Appsem Store / Appsem Store Admin desde `docs/fase-03/AVANCE_Y_PENDIENTES_2026-10-14.md` en GitHub. La Fase 2 quedó cerrada. La primera entrega de Fase 3 (moderación atómica y archivado reversible) está fusionada en Admin main, commit `1ce91cd`, y aprobó Actions `38652005845`. Su publicación en Vercel Production está pendiente de confirmación por límite HTTP 402 del plan Hobby. Verifica primero el despliegue productivo y no confundas Preview READY con Production; después implementa la auditoría de integridad read-only con tests en Firebase Emulator. No modifiques reglas ni datos reales. Mantén el documento de avance actualizado y continúa las siguientes tareas de Fase 3 antes de cerrarla.


## 8. Continuación de Fase 3 — Segunda entrega (14/10/2026)
**Entrega de desarrollo:** auditoría de integridad read-only (P1 del apartado 5), sin migrar ni alterar datos.

- \`scripts/phase3/integrity-core.mjs\`: comparación pura de contadores y eventos observados, con distinción explícita entre discrepancias exactas de comentarios y diferencias históricas no concluyentes de likes/ratings/downloads.
- \`scripts/phase3/audit-integrity.mjs\`: lector Firebase Admin SDK acotado, alias HMAC para apps, hallazgo de padres huérfanos y protección de producción por flags explícitos. Ninguna escritura de datos.
- \`tests/phase3/audit-integrity-core.test.mjs\` y \`tests/phase3/audit-integrity-emulator.test.mjs\`: cobertura de errores, casos legados, ausencia de PII y no modificación en Emulator.
- \`docs/fase-03/AUDITORIA_INTEGRIDAD_SOLO_LECTURA.md\`: contrato, uso seguro y significado de resultados.
- Comando: \`npm run phase3:audit:read-only -- --project=demo-appsem-phase3 --read-emulator\` (requiere Emulator activo y \`PHASE3_AUDIT_KEY\` externa).
- **Verificación CI:** completada, tanto PR como main; ver sección 9 (enlaces oficiales a Actions).
- **Vercel consultado en esta continuación:** último Production READY encontrado: \`7c6f14f9242ddae7b86a3dca1826f04b19de26e4\`, anterior a \`1ce91cd\`. Las versiones más recientes encontradas fueron \`target: null\` (Preview). No se han probado Archivar/Restaurar en producción.
- **La Fase 3 continúa abierta.** Siguientes prioridades: deployment Production verificable, audit real autorizado y solo lectura, respaldo **reciente**, dry-run de reconciliación, rollback y controles E2E. No ejecutar corrección sin revisar hallazgos.


## 9. Resultado verificado de la segunda entrega — 14/10/2026
- **PR #11 fusionado en `main`:** https://github.com/eler30mr-star/appsem-store-admin/pull/11
- **SHA de integración:** `d142a0d961d9833cb31a5bcdbf0e4c372876706e`.
- **CI del PR:** https://github.com/eler30mr-star/appsem-store-admin/actions/runs/38653374301 — **SUCCESS**.
- **CI tras integrar en `main`:** https://github.com/eler30mr-star/appsem-store-admin/actions/runs/38653510663 — **SUCCESS** (Firebase Emulator, Fase 3, integración de Fase 2 y build Vite).
- **Despliegue:** intento explícito de Production para el SHA `d142a0d` rechazado por Vercel con **HTTP 402** `api-deployments-free-per-day`; respuesta solicitó esperar **86400 segundos (24 horas)**. No hay un Production READY nuevo verificado. **No repetir despliegues hoy** y no declarar los botones publicados.
- **Auditoría de datos reales:** NO ejecutada. Sólo código integrado y pruebas sintéticas de Emulator.
- **Trabajo siguiente:** verificar cuándo desaparezca el límite, publicar `main` como Production y comprobar SHA/dominio; después pruebas funcionales con app sintética, informe read-only autorizado, copia de seguridad actualizada y preparación de migración reversible.
- **Fase 3:** continúa **ABIERTA**. No ejecutar borrados ni migraciones de datos ni cambiar reglas de Firestore.
