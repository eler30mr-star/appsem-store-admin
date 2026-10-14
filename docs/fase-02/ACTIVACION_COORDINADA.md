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
