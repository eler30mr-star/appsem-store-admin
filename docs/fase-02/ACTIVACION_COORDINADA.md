# Fase 2 — Protocolo de activación coordinada

**Estado:** preparado y probado en Firebase Emulator; no desplegado a Firebase de producción.

## Comprobaciones antes del lanzamiento

- **Respaldo recuperable:** verificar la frase privada del propietario, descifrar la copia real `backups/encrypted/*.appsem.enc` y ensayar restauración en Emulator. La existencia del archivo por sí sola no demuestra que pueda recuperarse.
- **Código probado:** Actions #38582818238 (Admin: 46 pruebas Firestore y 7 de integración, verdes). La tienda publica su API en `api/interaction.js`.
- **Servidor preparado:** configurar exclusivamente en Vercel las variables de servidor indicadas en [el manual de la tienda](https://github.com/eler30mr-star/appsem-store/blob/main/docs/FASE_02_METRICAS_SEGURAS.md). Mantener secretos fuera del repositorio y del navegador.
- **Prueba previa:** ensayar la API en entorno separado con datos ficticios; confirmar rechazos 403/429 y que no hay duplicados, fallos de cuotas o secretos expuestos.
- **Clientes y caché:** revisar el service worker y las versiones del navegador, para evitar que clientes antiguos sigan escribiendo directamente en Firestore.

## Publicación coordinada

1. Validar la disponibilidad del backend Vercel con las credenciales y Turnstile configurados.
2. Activar la tienda con `VITE_METRICS_BACKEND=server`, comprobar que interacciones nuevas pasan exclusivamente por la API.
3. Aplicar las reglas candidatas `docs/fase-02/firestore.hardened.rules` **solo cuando** el cliente ya esté usando el servidor.
4. Comprobar que la escritura directa pública en Firestore queda bloqueada sin romper catálogo, comentarios, likes, valoraciones ni descargas.
5. Registrar métricas, errores y denegaciones durante la ventana de cambio.

Los pasos 2 y 3 ocurren en servicios diferentes y **no son atómicos**. Deben hacerse con supervisión y posibilidad de revertir el despliegue del cliente y restaurar la configuración previa de reglas. Nunca reemplazar datos reales sin determinar antes su estado y el alcance del incidente.

**Reserva:** hasta disponer de credenciales autorizadas, prueba de recuperación y comprobaciones de Vercel, la Fase 2 sigue abierta. Ninguna acción de este documento se ejecutó en producción.

## Verificación REAL de recuperabilidad (14/10/2026)

**Requisito de restauración: APROBADO**, ver [GitHub Actions #38615610469](https://github.com/eler30mr-star/appsem-store-admin/actions/runs/38615610469).

- Se utilizó exclusivamente el archivo real cifrado `backups/encrypted/appsem-firestore-2026-10-13T21-27-24-109Z-b3f473bd.appsem.enc` y un secreto temporal de GitHub Actions suministrado por el propietario.
- Resultado registrado: `PASS: respaldo real descifrado, íntegro y restaurado solo en Firebase Emulator.`
- **31 documentos verificados**: descifrados, validados y restaurados en un Firestore Emulator con ID ficticio `demo-appsem-phase2-recovery`; el recuento de lectura coincide con los documentos del manifiesto.
- El workflow no tenía credenciales de Firebase productivo, no generó artefactos descifrados y limpió los datos temporales al terminar.
- Un primer intento, [#38613781391](https://github.com/eler30mr-star/appsem-store-admin/actions/runs/38613781391), falló **antes del descifrado** por un error en la validación de la dirección local del emulador; corregido en `main` (`94cdd82`) y repetido exitosamente.

**Acción privada urgente del propietario:** eliminar de GitHub `Settings → Secrets and variables → Actions` el secreto temporal `APPSEM_BACKUP_RECOVERY_PASSPHRASE`. Conservar la frase original en custodia privada fuera de GitHub.

La aprobación de recuperación cierra el requisito de backup restaurable, **no** implica que el backend de métricas ya esté autenticado frente a Firebase real, que Cloudflare Siteverify haya sido comprobado en live ni que se hayan publicado reglas endurecidas. Mantener deshabilitados `VITE_METRICS_BACKEND=server` y `METRICS_BACKEND_ENABLED=true` hasta superar las pruebas de activación coordinada. El respaldo no incluye Firebase Authentication, Storage ni índices.

## Validación real no destructiva de Vercel + Firebase + Cloudflare (14/10/2026)

Prueba ejecutada durante build productivo de Vercel para el commit de tienda `c5c1215e8de8dd4ddf11a564976904433425865b`, deployment `dpl_DSYth7rAJ6Cp1WBoy5ATvUFArdcF` (**READY**). Función de diagnóstico ejecutada solo porque se activó temporalmente `PHASE2_READINESS_CHECK=true`, sin activar `METRICS_BACKEND_ENABLED` ni `VITE_METRICS_BACKEND`.

- **Firebase Admin real — PASS:** Vercel autenticó la cuenta de servicio y consultó como máximo 1 documento Firestore en modo lectura, sin mostrar datos ni realizar escrituras.
- **Cloudflare Siteverify real — PASS negativo:** se envió deliberadamente un token falso y Cloudflare respondió con rechazo `invalid-input-response`, no con error de secreto. **No implica una prueba positiva de Turnstile real**.
- **Sitio — READY:** build y despliegue finalizados, frontend anterior sigue activo.
- Después de la prueba se cambió `PHASE2_READINESS_CHECK` a `false` para futuras compilaciones. Solo se registraron estados genéricos, sin secretos ni valores de documentos.
- **Siguientes pruebas antes de endurecer reglas:** token Turnstile legítimo (hostname + action) en dominio real, ensayos E2E de interacción con control de permisos y plan de reversión para transición cliente/reglas. No publicar reglas nuevas unilateralmente.

Ver código reproducible: [scripts/check-phase2-live-readiness.mjs](https://github.com/eler30mr-star/appsem-store/blob/main/scripts/check-phase2-live-readiness.mjs).

## Prueba positiva de Turnstile disponible (14/10/2026)

- Tienda pública commit `bacef0d47f99df5d3e38268a419f8083e144e785`, [PR #5](https://github.com/eler30mr-star/appsem-store/pull/5), suite GitHub Actions [#38620848941](https://github.com/eler30mr-star/appsem-store/actions/runs/38620848941) **SUCCESS**.
- Despliegue `dpl_BE2VHpHJkyHBjeUVwCThFdVbx4kj` en Vercel Production **READY**.
- Se habilitó temporalmente `PHASE2_TURNSTILE_PROBE_ENABLED=true` solo en Production. Página `https://appsem-store.vercel.app/api/turnstile-probe` confirmada **HTTP 200 HTML** y JavaScript estático confirmado **HTTP 200**. El backend normal `/api/interaction` sigue respondiendo **HTTP 503 de backend apagado**.
- La nueva prueba solo envía el token a Cloudflare Siteverify con hostname y `action` esperados, **sin importar Firebase ni escribir eventos**. Todavía **PENDIENTE el resultado manual de un visitante**: no afirmar que un token humano fue aceptado antes de ver respuesta real.
- Tras la prueba, deshabilitar flag temporal y retirar código de prueba, publicando limpieza de producción. Luego abordar transición coordinada de cliente y reglas.
