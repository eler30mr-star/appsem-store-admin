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
