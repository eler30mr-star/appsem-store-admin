# Contrato Firebase observado — Fase 1

Documento de caracterización del comportamiento vigente; NO es una nueva definición normativa. Fuente: código de main en ambos repositorios según las referencias de README.md de esta carpeta.

## 1. Proyecto compartido

**Firebase projectId:** webs-8b1bf. Se identifica a partir de src/firebase.js de ambos clientes. La apiKey del SDK web es una configuración cliente, no una credencial administrativa. La protección depende de Auth, reglas y backend.

Los repositorios contienen versiones distintas de firestore.rules, por lo que NO se puede suponer cuál está aplicada en el proyecto activo sin consultar Firebase Console.

## 2. Diferencias críticas

| Aspecto | Admin | Tienda pública |
| --- | --- | --- |
| Rol administrador en reglas | email: eler30.mr@gmail.com | email: ceo.developer.appsem@gmail.com |
| Timestamp de métricas públicas | updatedAt | metricsUpdatedAt |
| Registro de clics | apps/{id}/downloads | apps/{id}/downloadClicks |
| Acumulación de rating | ratingSum + ratingCount | ratingAverage + ratingCount |
| Reglas de comentarios | longitud del texto 2 a 600 | longitud del texto 5 a 800 |
| Creación de comentario | approved=false | approved=false; createdAt == request.time |
| Destino | Admin publica y modera | Cliente consulta y envía interacciones |

**Impacto:** las reglas no son intercambiables. Desplegar una versión sin coordinar ambos clientes puede romper escrituras o accesos.

## 3. Documento apps/{appId}

Admin crea title, slug, categoryKey, category, shortDescription, fullDescription, iconUrl, bannerUrl, screenshots[], playStoreUrl, privacyPolicyUrl, termsUrl, legalNoticeUrl, accountDeletionUrl, securityReportUrl, packageName, appSize, operatingSystem, minAndroidVersion, currentVersion, lastUpdate, languages, offlineUse, containsAds, inAppPurchases, ageRating, price, developer, featured, status, createdAt y updatedAt.

Contadores iniciales en Admin: likesCount=0, downloadsCount=0, ratingCount=0, ratingSum=0, ratingAverage=0, commentsCount=0.

**Estados:** published visible al público; draft no publicado. Los documentos app con estados diferentes quedan fuera de la lectura pública si las reglas lo exigen.

## 4. Subcolecciones

- apps/{appId}/comments/{commentId}: name, comment, approved, createdAt; el administrador añade approvedAt/updatedAt según operación.
- apps/{appId}/likes/{likeId}: createdAt; identificador basado en cliente local en tienda.
- apps/{appId}/ratings/{ratingId}: rating, createdAt.
- apps/{appId}/downloads/{downloadId}: formato del Admin rules, no coincide con tienda.
- apps/{appId}/downloadClicks/{clickId}: formato tienda con targetUrl, createdAt.

La tienda utiliza getClientId() persistido en localStorage como identidad de interacción, no una identidad autenticada; borrar el almacenamiento o cambiar navegador puede permitir otra interacción.

## 5. Decisiones pendientes de Fases 2 y 3

- Una única fuente de verdad para firestore.rules y despliegue.
- Rol administrativo explícito, correo verificado y pruebas de acceso.
- Evento verificable, agregación protegida e idempotencia de métricas.
- Modelo canónico de ratings con suma y cantidad, migración de promedio legado.
- Un nombre único de subcolección de clics y reglas compatibles.
- Esquema versionado, estrategias de lectura retrocompatible y migración gradual.

**Prohibición operativa en Fase 1:** no publicar estas reglas, no reemplazar documentos ni borrar colecciones. Esta fase establece evidencia, no soluciones desplegadas.

## 6. Tercera variante: reglas aportadas por el usuario (13/10/2026)

Se almacenó `docs/fase-01/FIRESTORE_REGLAS_REPORTADAS_2026-10-13.rules`. Es una **referencia suministrada por el usuario**, no una extracción de la configuración de Firebase y no reemplaza los dos archivos `firestore.rules` de las aplicaciones.

| Aspecto | Admin GitHub | Tienda GitHub | Reglas aportadas |
| --- | --- | --- | --- |
| Correo admin | eler | otro correo | eler |
| Timestamp métricas | updatedAt | metricsUpdatedAt | metricsUpdatedAt |
| Clics subcolección | downloads | downloadClicks | downloadClicks |
| Rating público | ratingSum + count | ratingAverage + count | ratingAverage + count |
| Correo verificado exigido | no | no | no |
| Resistencia a métricas anónimas falsas | insuficiente | insuficiente | insuficiente |

**Compatibilidad:** las reglas aportadas se alinean mejor con el frontend de Admin para la identidad y con el frontend público para los nombres de campos e interacciones. No obstante, mantienen problemas graves de integridad en contadores y promedios, y no garantizan unicidad de eventos ni impiden spam. Test suite: 17/17 escenarios ejecutados en GitHub Actions #38438813839.

Antes de cambiar reglas productivas se requiere respaldo, identidad de despliegue confirmada y migración coordinada entre los dos repositorios.
