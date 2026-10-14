# Fase 3 — Integridad y contrato de datos v1

**Proyecto:** Appsem Store + Appsem Store Admin  
**Firebase:** `webs-8b1bf`  
**Estado:** implementación incremental; NO migrar ni borrar datos reales automáticamente  
**Referencia:** `docs/auditorias/Auditoria_1_Appsem_Store_Admin.md`

## 1. Contrato canónico compatible

| Documento / ruta | Campos canónicos y semántica |
|---|---|
| `apps/{appId}` | `title`, `slug`, `status`, `featured`, `createdAt`, `updatedAt`, metadatos editoriales |
| `status` | `draft` (privada), `published` (pública), `archived` (no pública y recuperable) |
| `likesCount` | Entero no negativo; eventos únicos en `apps/{id}/likes` |
| `downloadsCount` | Clics contabilizados, **no equivale a instalaciones**; eventos en `apps/{id}/downloadClicks` |
| `ratingCount` | Número entero de valoraciones |
| `ratingSum` | Suma de estrellas cuando es válida; fuente canónica para calcular `ratingAverage` |
| `ratingAverage` | Presentación redondeada a 2 decimales por backend nuevo; puede provenir de promedio legado |
| `commentsCount` | Número de comentarios **aprobados**; actualizar junto al estado del comentario en una transacción |
| `apps/{id}/comments/{commentId}` | `name`, `comment`, `approved`, `createdAt`, `approvedAt?`, `updatedAt?` |
| `apps/{id}/likes/{id}` | `createdAt`; soporta ID legado y HMAC del backend |
| `apps/{id}/ratings/{id}` | `rating` (1–5), `createdAt`; soporta ID legado y HMAC |
| `apps/{id}/downloadClicks/{id}` | `targetUrl`, `createdAt`; **no** usar colección heredada `downloads` para nuevas escrituras |
| `metricsLimits`, `commentsLimits` | Cuotas internas del backend Admin SDK, nunca leer desde cliente público |

### Compatibilidad con el legado
- No renombrar colecciones ni borrar `ratingAverage`, `updatedAt` o documentos de visitante existentes.
- El nuevo servidor usa `metricsUpdatedAt` para métricas; la edición Admin usa `updatedAt`. Son timestamps con propósitos distintos.
- `ratingSum` puede no existir o reflejar cálculos históricos. El backend de Fase 2 usa `ratingAverage × ratingCount` como fallback; **no convertir valores históricos a sumas exactas sin cotejar registros**.
- Solo `published` es públicamente legible conforme a Firestore Rules vigente; `archived` y `draft` no son visibles.

## 2. Entrega inicial de Fase 3 — Moderación transaccional
En `src/services/phase3Transactions.js` se implementa:
- **Aprobar:** leer padre + comentario antes de escribir; cambiar `approved: true` y `commentsCount +1` atómicamente si no estaba aprobado.
- **Ocultar:** cambiar a `approved: false` y `commentsCount -1` atómicamente si estaba aprobado.
- **Eliminar comentario:** borrar comentario y decrementar contador en la **misma transacción** solo si estaba aprobado.
- Todas las operaciones toman **estado real de Firestore** (no el objeto desactualizado de la UI), admiten repetición sin doble contabilización y rechazan un contador negativo/inválido.
- Si el contador legado ya era incoherente, la operación que lo haría negativo **falla sin escrituras**. Procede hacer conciliación, no ocultar silenciosamente el error.

## 3. Archivado en lugar de borrado incompleto

- Antes, `deleteApp` borraba únicamente `apps/{id}`, dejando subcolecciones huérfanas. Esa ruta deja de usarse.
- **Archivar**: actualiza el documento a `status: archived`, `featured: false`, `archivedAt`, `updatedAt` de forma transaccional. Conserva comentarios, likes, ratings, downloads, imágenes y métricas.
- **Restaurar**: vuelve a `status: draft` sin publicar automáticamente, guarda `restoredAt` y conserva los datos originales.
- No permitir que el botón Publicar salte el archivo: debe restaurarse primero.
- No se incorpora en esta entrega borrado físico de apps o limpieza de subcolecciones: eso exigirá inventario, respaldo reciente, plan legal de retención, previsualización y una operación administrativa separada del cliente web.

## 4. Conciliación y migración futura (NO ejecutadas)

**Pendiente fase 3:** preparar un informe en modo solo lectura que compare, por aplicación:
- `commentsCount` frente a cantidad real de documentos `comments.approved == true`;
- `likesCount`, `ratingCount`, `downloadsCount` frente a eventos existentes, sin confundir eventos legado y nuevo backend;
- `ratingSum` y `ratingAverage` frente a suma exacta de `rating` en documentos existentes (si no se conservan todos, señalar desconocido, nunca inventar).
- subcolecciones en `apps` ausentes u otras discrepancias.

La **migración real** requiere respaldo reciente y recuperable, modo dry-run, reporte firmado, confirmación de conflictos, idempotencia, lote limitado, reversión de cada aplicación y tests de Emulator. No se ejecuta contra producción en esta entrega.

## 5. Pruebas y protección de producción

`npm run test:phase3:integrity` ejecuta Emulator con proyecto `demo-appsem-phase3`, sin acceder a datos reales:
- aprobar dos veces / concurrentemente;
- ocultar sin contadores negativos;
- borrar comentario pendiente/aprobado de forma idempotente;
- fallar en contador históricamente inconsistente sin modificar documentos;
- archivar conservando las subcolecciones y bloquear publicación;
- restaurar como borrador con datos intactos.

**No modificar** reglas Firebase ni activar funciones de borrado masivo al desplegar este cambio. Las garantías de prueba se limitan al código y a Emulator; producción se verificará funcionalmente después de incorporar el PR.


## Estado operativo de la primera entrega (14/10/2026)

- **GitHub main:** implementación entregada en commit `1ce91cd620bf0a073c72167d46c64b004a275c71` ([PR #10](https://github.com/eler30mr-star/appsem-store-admin/pull/10)).
- **Pruebas:** CI del PR [#38651856327](https://github.com/eler30mr-star/appsem-store-admin/actions/runs/38651856327) y de main [#38652005845](https://github.com/eler30mr-star/appsem-store-admin/actions/runs/38652005845) **SUCCESS**, incluyendo transacciones de Fase 3, Firebase Emulator, integración de Fase 2 y Vite build.
- **Producción:** no publicada la nueva entrega. Vercel rechazó el despliegue manual con HTTP 402 `api-deployments-free-per-day`, límite diario de despliegues en plan Hobby. El último deployment Production verificado era anterior a `1ce91cd`; no afirmar que los botones Archivar/Restaurar ya están disponibles en la web.
- **Pendiente de entrega productiva:** crear despliegue Production desde `main` cuando el límite de Vercel permita nuevos deploys; comprobar SHA READY, abrir Admin y probar archivado/restauración con **app de prueba** (no con una publicada real), y moderación repetida con comentarios sintéticos o preparados. No publicar cambios de reglas.
- **Pendiente fase 3:** conciliación read-only de métricas y diseño/ensayo de migración reversible sin pérdida de datos.
