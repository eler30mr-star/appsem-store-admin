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


## Segundo lote — Backend confiable de tienda pública (14/10/2026)

**Código implementado en `eler30mr-star/appsem-store` (main); despliegue productivo de reglas NO efectuado.**

- API Vercel `api/interaction.js` con Firebase Admin SDK (credenciales únicamente en Vercel, sin secretos en Git), Turnstile Siteverify (hostname + action), validación de entrada, HMAC-SHA256 sobre IDs/IP.
- `server/metricsCore.js` usa transacción Firestore para comprobar app publicada, deduplicar eventos y limitar acciones por IP/15 min; crea registro de like/rating/descarga y modifica el contador conjuntamente.
- Compatibilidad con likes y ratings del esquema anterior (ID de localStorage).
- El cliente `src/services/appsService.js` conmuta a la API **solo** con `VITE_METRICS_BACKEND=server`. Por defecto el modo anterior sigue operativo hasta la migración coordinada. No ha cambiado Firestore de producción.
- `scripts/check-metrics-env.mjs` impide compilar modo backend si faltan variables/secretos declarados.
- Pruebas de validación, límites y antifraude más lint y Vite en GitHub Actions, sin conectar a Firebase real.

**Manual técnico de migración:** [Tienda pública — Fase 2](https://github.com/eler30mr-star/appsem-store/blob/main/docs/FASE_02_METRICAS_SEGURAS.md).

### Siguiente paso operacional — no automatizable sin acceso de infraestructura

Configurar secretos de servicio Firebase y Turnstile en Vercel, validar el backend en entorno aislado, comprobar recuperación de la copia real de GitHub y realizar **un solo corte coordinado** de cliente + reglas. No aplicar la candidata `docs/fase-02/firestore.hardened.rules` de antemano: causaría denegaciones en likes, ratings y descargas mientras la tienda utilice Firestore desde el navegador.

**Reserva de seguridad:** ID de navegador reiniciable y CAPTCHAs no eliminan totalmente el abuso; se requieren monitoreo y política de retención de cuotas. El backend tampoco garantiza por sí solo que un clic sea una instalación.
