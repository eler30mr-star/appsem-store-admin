# Matriz de regresión — Fase 1

La columna Estado distingue caracterización local de pendientes de integración. P indica prueba pendiente; A indica prueba inicial aprobada sobre una copia aislada exacta de las utilidades inspeccionadas. No implica que el build completo o Firestore hayan sido ejecutados.

| Caso | Prioridad | Comprobación | Evidencia / resultado | Estado |
| --- | --- | --- | --- | --- |
| UT-01 | Media | Slug elimina tildes y normaliza espacios | Node test | A |
| UT-02 | Media | Slug agrupa separadores | Node test | A |
| UT-03 | Media | Slug vacío | Node test | A |
| UT-04 | Alta | Slug puede colisionar con nombres equivalentes | Node test de caracterización; falta prevención en servicio | A |
| UT-05 | Baja | No hay duplicados de claves de categorías | Node test | A |
| UT-06 | Media | Categorías legadas mapeadas | Node test | A |
| UT-07 | Baja | Categoría desconocida: Otros | Node test | A |
| UT-08 | Alta | Media basada en ratingSum/ratingCount | Node test | A |
| UT-09 | Media | Fallback a ratingAverage legado | Node test | A |
| UT-10 | Media | Media sin valoraciones | Node test | A |
| UT-11 | Baja | Fecha inválida usa fallback | Node test | A |
| UT-12 | Baja | Número nulo muestra cero | Node test | A |
| AUTH-01 | Crítica | Anónimo no crea/edita/elimina apps | Firebase Emulator; regla realmente publicada por confirmar | P |
| AUTH-02 | Crítica | Usuario con correo no autorizado no administra | Firebase Emulator | P |
| AUTH-03 | Crítica | Administrador verificado puede operar | Firebase Emulator | P |
| AUTH-04 | Alta | Email no verificado queda denegado | Firebase Emulator tras diseño de regla | P |
| RULE-01 | Crítica | Admin y tienda funcionan con UNA regla | Emulador doble cliente | P |
| MET-01 | Crítica | No se puede incrementar contador sin evento válido | Emulador; vulnerabilidad conocida por fuente | P |
| MET-02 | Crítica | Likes/ratings duplicados no modifican la suma | Emulador + simultaneidad | P |
| MET-03 | Alta | Clics de descarga y contador se mantienen sincronizados | Emulador; comparar subcolecciones | P |
| COM-01 | Crítica | Doble aprobación no duplica commentsCount | Emulador/concurrencia | P |
| COM-02 | Crítica | Fallo parcial no corrompe commentsCount | Emulador con fallo simulado | P |
| COM-03 | Alta | Ocultar y borrar actualizan contador una sola vez | Emulador | P |
| CAT-01 | Alta | Crear, editar, publicar y ocultar visibles correctamente | E2E Admin + tienda | P |
| CAT-02 | Alta | No se publican slugs duplicados | E2E / reglas futuras | P |
| CAT-03 | Alta | Eliminación sin registros huérfanos | Emulador, política borrado | P |
| PERF-01 | Media | Latencia de comentarios para 1, 20 y 100 apps | Benchmarks con datos sintéticos | P |
| BUILD-01 | Alta | Build reproducible limpio | Lockfile + npm ci + build | P |
| UX-01 | Media | Formulario bloquea links incorrectos y conserva cambios | UI/E2E | P |

## Procedimiento seguro

1. Registrar commit exacto, Node/npm, versiones de herramientas y huellas SHA-256.
2. Utilizar exclusivamente proyecto y datos de prueba en emulador; nunca datos reales para tests destructivos.
3. Configurar ambos clientes para el mismo emulador y una única versión de reglas candidata.
4. Adjuntar logs, caso aprobado/fallido y enlace al commit para cada prueba.
5. Mantener en P los casos que no se hayan ejecutado: una lectura de código NO equivale a una prueba aprobada.

La matriz es incremental: su cierre se actualizará al finalizar Fase 1 y fases siguientes.


## Continuación: pruebas de Emulator Suite añadidas

Los siguientes casos ahora tienen código en tests/firestore/rules-compat.test.mjs, pero mantienen estado **preparado, no ejecutado** hasta que conste una ejecución de GitHub Actions o local con dependencias instaladas:

- FIRE-01 (Admin): visitante solo lee apps publicadas.
- FIRE-02 (Admin): visitante no crea ni altera títulos.
- FIRE-03 (Admin): usuario sin correo autorizado no administra.
- FIRE-04 (Admin): se documenta que contador anónimo puede incrementarse (defecto abierto).
- FIRE-05 (Admin): evento downloadClicks del cliente público es rechazado.
- FIRE-06 (Tienda): visitante lee apps publicadas, no borradores.
- FIRE-07 (Tienda): el correo autorizado en Admin queda sin privilegios con reglas de tienda.
- FIRE-08 (Tienda): acepta downloadClicks.
- FIRE-09 (Tienda): contador anónimo también incrementable (defecto abierto).
- FIRE-10 (Tienda): no acepta formato de timestamp de Admin.

**IMPORTANTE:** las pruebas son de caracterización, no de seguridad corregida. Ninguna prueba escribe en la base de producción.

## Evidencia CI de casos de caracterización

**Ejecución 38433378975**: FIRE-01..FIRE-10 ejecutados satisfactoriamente en Firebase Emulator, el 13/10/2026. **10/10 caracterizaciones aprobadas**, incluyendo casos que evidencian errores. Los casos AUTH-01..MET-03 de la matriz original requieren ampliar pruebas de seguridad específicas para el futuro contrato único y siguen **pendientes de corrección**. Una caracterización aprobada no elimina una vulnerabilidad.

## Reglas aportadas — prueba de línea base (pendiente resultado de CI)

El archivo `tests/firestore/reported-rules.test.mjs` contiene 17 escenarios: lectura pública, acceso admin/terceros, email_verified=false, bloqueos de edición, incrementos sin evento, ratingAverage arbitrario, timestamps, downloadClicks, URL no HTTP, likes, comentarios y borradores. La prueba de vulnerabilidades **debe pasar** si demuestra el defecto existente. No es un criterio de seguridad solucionada.

## Pruebas aportadas, resultado comprobado

FIRE-REPORTED-01..17: **17/17 aprobadas** mediante GitHub Actions #38438813839 con Firebase Emulator. Se suman a 10/10 pruebas Firestore anteriores y 12/12 pruebas unitarias. Las pruebas de caracterización que demuestran una vulnerabilidad **son éxitos de detección**, no evidencias de que la vulnerabilidad esté corregida.

Estado de seguridad de métricas: **abierto — alto/crítico**. Estado de verificación de reglas efectivamente desplegadas: **pendiente**.
