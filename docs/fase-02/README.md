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


## Tercer lote — Integración real en Emulator verificada (14/10/2026)

Se ejecutaron conjuntamente las reglas candidatas de Admin y el código real del servidor de la tienda pública. El workflow descarga la versión `main` del repositorio `appsem-store` para ensayar su backend con Firebase Admin SDK y datos ficticios en un proyecto `demo-*`.

**Resultado: [GitHub Actions #38582818238](https://github.com/eler30mr-star/appsem-store-admin/actions/runs/38582818238) — SUCCESS.** Pruebas Firestore 46/46 y pruebas de integración 7/7, todas aprobadas.

Se verificó: rechazo de incrementos públicos, lectura restringida de likes y valoraciones, likes/rating/descargas transaccionales, deduplicación, bloqueo de borradores y compatibilidad con IDs antiguos. La prueba encontró un error real al deduplicar descargas sin validar antes la URL; quedó corregido en la tienda pública (commit `9fb452f`).

**Producción:** la tienda y Firebase siguen usando las reglas vigentes. Todavía falta ensayo de restauración del respaldo cifrado, configuración autorizada de credenciales en Vercel y despliegue coordinado del cliente y las reglas. No activar las reglas nuevas de forma aislada.


## Cuarto lote — API HTTP comprobada con datos de Emulator (14/10/2026)

Se amplió la suite de integración para llamar al endpoint **real** de Vercel `api/interaction.js` desde Node, usando Firebase Admin SDK conectado únicamente a Firestore Emulator y una respuesta simulada de Cloudflare Siteverify.

**Evidencia final:**
- [Tienda pública: GitHub Actions #38588521353](https://github.com/eler30mr-star/appsem-store/actions/runs/38588521353) — SUCCESS, **17/17** pruebas, ESLint y compilación Vite correctas.
- [Admin: GitHub Actions #38588594279](https://github.com/eler30mr-star/appsem-store-admin/actions/runs/38588594279) — SUCCESS, **46/46** pruebas de reglas y **15/15** pruebas de integración con Emulator, además de las pruebas de línea base y respaldo.
- Revisión cruzada reproducible: el workflow de Admin importa una revisión **fijada por SHA** de `appsem-store`; no depende de una rama `main` cambiante en medio de las pruebas.

**Comprobaciones nuevas:** POST del sitio autorizado, desafío Turnstile válido/inválido, idempotencia de like, cálculo de rating, rechazo de enlaces ajenos y descargas no autorizadas, errores 403/413/415, manejo de HTTP/2 sin `Content-Length`, rechazo de JSON excesivo aunque se anuncie un tamaño inferior, GET de estado, apagado de backend cuando no está habilitado y verificación estructural de variables Firebase/Vercel antes de compilar.

**Seguridad de las pruebas:** sin claves de producción; la API de ensayo requiere explícitamente `METRICS_EMULATOR_TEST=true`, hostname loopback y proyecto ficticio `demo-*`, y se bloquea en Vercel real. La simulación Turnstile **no prueba Cloudflare real ni el despliegue live**.

**Pendientes para activar:** comprobación de recuperación de la copia cifrada real; credenciales y Turnstile de Vercel; preview segura y monitorizada; cambio coordinado de frontend y reglas Firestore. La Fase 2 permanece abierta, sin escrituras de producción desde esta auditoría.
