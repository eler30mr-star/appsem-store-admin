# Fase 2 — Seguridad, control de acceso y métricas

**Estado:** EN CURSO. Trabajo inicial aislado; no se han cambiado reglas de Firebase en producción.

## Hallazgos activos

- **SEC-02:** reglas actuales autorizan al administrador por correo sin `email_verified`. Se endurece el cliente Admin y se construye una candidata de reglas que exige correo verificado.
- **SEC-01:** contadores públicos `likesCount`, `downloadsCount`, `ratingAverage` y `ratingCount` se modifican directamente por visitantes. Las reglas actuales no comprueban que la agregación proceda de eventos auténticos; las transacciones del navegador NO son un mecanismo de confianza.
- **INT-01:** Admin y tienda comparten `webs-8b1bf`. Ninguna de sus versiones `firestore.rules` debe desplegarse unilateralmente.

## Primer lote implementado

1. Validación de `emailVerified` y de `email_verified` en el token Firebase Auth del acceso Admin, manteniendo cuenta autorizada.
2. Candidata de reglas única `docs/fase-02/firestore.hardened.rules`: permite lectura pública solo de apps publicadas, comentarios nuevos pendientes, moderación administrativa; niega actualización pública de agregados y escritura directa de interacciones.
3. Pruebas adversariales en Emulator: correo verificado/no verificado, suplantación, actualización de contadores, eventos falsos, lectura de borradores y comentarios moderados.

## Dependencia obligatoria antes de desplegar la candidata

**La tienda pública actual invoca `runTransaction` y `writeBatch` directamente desde `src/services/appsService.js` para likes, valoraciones y descargas. Desplegar las reglas candidatas bloquearía esas tres funciones.** Se necesita primero un backend confiable que ejecute transacciones Firestore desde el servidor con control de idempotencia, validación, cuota/antispam y secretos fuera del navegador. Se deberá elegir y probar su infraestructura compatible con Spark; no se presupone que Cloud Functions estén disponibles en Spark.

Ninguna política basada solo en un ID de localStorage demuestra una identidad real. Un servidor tampoco evita por sí solo abuso distribuido: requiere controles adicionales.

## Próximos hitos

1. Backend confiable para métricas (interacciones idempotentes, validación, mitigación de spam), integrado con la tienda y con pruebas de compatibilidad.
2. Ensayo con Firebase Emulator y clientes Admin/tienda (incluidas estadísticas y restauración), plan de reversión.
3. Implementar protección de despliegue para asegurar una sola fuente de verdad de reglas.
4. Tras respaldo restaurable verificado, aprobar y ejecutar publicación coordinada de reglas y backend; monitorear rechazos/permisos.

**Estado de producción:** reglas actuales intactas. **No marcar Fase 2 terminada** hasta eliminar vías arbitrarias y comprobar funcionalidad real de las métricas.
