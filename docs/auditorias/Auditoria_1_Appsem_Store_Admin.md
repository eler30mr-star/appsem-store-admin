# AUDITORÍA 1 — APPSEM STORE ADMIN

**Auditoría profesional de ingeniería de software, seguridad, arquitectura, experiencia de usuario y preparación de producción**  
**Fecha:** 13 de octubre de 2026  
**Proyecto evaluado:** eler30mr-star/appsem-store-admin  
**Rama:** main  
**Commit de referencia:** fc375b4738f94429cfb41118825dffe999359387  
**Documento:** Versión 1.0 — Auditoría 1  
**Estado:** evaluación estática y plan; implementación de correcciones pendiente.

> **Dictamen:** El panel administrativo tiene una base funcional aprovechable, pero presenta problemas prioritarios de seguridad de métricas, consistencia transaccional e incompatibilidad entre reglas y modelos de datos de los dos repositorios que comparten Firebase. No se recomienda certificarlo como robusto para producción sin cerrar estas brechas.

## 1. Alcance y metodología

Se evaluaron archivos de la aplicación administrativa React/Vite/Firebase y se contrastaron los componentes esenciales de la tienda pública. Este documento no certifica que los fallos se hayan reproducido en el entorno activo: se trata de un análisis estático del código observado.

**Archivos inspeccionados en Admin:** README.md, package.json, firestore.rules, src/firebase.js, src/config.js, src/App.jsx, src/main.jsx, vercel.json, src/components/ProtectedRoute.jsx, src/components/AdminLayout.jsx, src/pages/LoginPage.jsx, src/pages/DashboardPage.jsx, src/pages/AppsPage.jsx, src/pages/AppFormPage.jsx, src/pages/CommentsPage.jsx, src/services/appsService.js, src/data/categories.js y src/utils/slug.js.

**Tienda pública contrastada:** eler30mr-star/appsem-store — src/firebase.js, firestore.rules, src/services/appsService.js y package.json.

**Límites:** No se ejecutaron pruebas locales, compilación, análisis dinámico, pentesting ni benchmarks. No se comprobó cuál versión de las reglas de Firestore está desplegada en el proyecto webs-8b1bf ni se inspeccionó la configuración activa de Vercel. Todo riesgo requiere una prueba controlada antes de intervenir en producción.

## 2. Diagnóstico ejecutivo

El sistema separa pantallas y servicios, dispone de login Google, rutas protegidas, dashboard, alta/edición/publicación de aplicaciones y moderación de comentarios. Su arquitectura es suficientemente simple como para corregir problemas progresivamente sin una reescritura total.

**Principales riesgos:** (1) actualizaciones públicas de contadores susceptibles de abuso; (2) moderación con escrituras independientes; (3) eliminación de apps sin garantizar borrado de subcolecciones; (4) reglas de Firebase y contratos de datos incompatibles entre Admin y tienda; (5) validaciones y pruebas automatizadas insuficientes.

### 2.1 Evaluación orientativa de madurez

| Área | Índice /100 | Interpretación |
| --- | ---: | --- |
| Arquitectura | 72 | Estructura clara, pero falta esquema y control compartido. |
| Funcionalidad | 76 | Flujos visibles en código; falta prueba E2E. |
| Seguridad | 42 | Acceso y métricas requieren endurecimiento. |
| Datos | 43 | Riesgos de consistencia y compatibilidad. |
| Experiencia UI | 66 | Diseño organizado, sin auditoría completa de accesibilidad. |
| Rendimiento | 54 | Consultas secuenciales y sin benchmarks. |
| Pruebas | 22 | Sin scripts de test/lint/check localizados en package.json. |
| Despliegue | 51 | Vercel básico; sin validación completa de CI/CD. |

**Índice global preliminar:** 58/100, juicio profesional orientativo previamente asignado (no promedio aritmético ni puntuación certificable).

## 3. Hallazgos detallados

### INT-01 — CRÍTICO — Reglas Firestore divergentes entre Admin y tienda

**Evidencia:** Ambos repositorios apuntan al mismo projectId, pero en sus respectivos firestore.rules difieren el correo administrativo y parte de las operaciones públicas admitidas.

**Riesgo:** Desplegar las reglas de un repositorio puede bloquear operaciones del otro.

**Corrección:** Centralizar la versión de reglas, fijar un único responsable de despliegue y probar cada permiso de ambos clientes en Firebase Emulator Suite antes de publicar.

### SEC-01 — CRÍTICO — Manipulación de contadores públicos

**Evidencia:** Las reglas permiten actualizaciones acotadas de contadores de apps publicadas sin autenticación. La relación entre evento real y contador no está suficientemente vinculada ni protegida contra automatización.

**Riesgo:** Inflado de likes, valoraciones o descargas registradas.

**Corrección:** Operaciones verificadas desde backend, eventos idempotentes, controles antiabuso y validación del incremento. Los clics de descarga no equivalen a instalaciones reales.

### DAT-01 — CRÍTICO — Moderación sin atomicidad

**Evidencia:** approveComment, hideComment y removeComment en appsService.js escriben primero el comentario y después commentsCount o viceversa mediante escrituras separadas.

**Riesgo:** Conteos incorrectos bajo fallos, acciones repetidas o condiciones de carrera.

**Corrección:** Transacciones atómicas con comprobación del estado anterior y pruebas de concurrencia/fallos intermedios.

### DAT-02 — ALTO — Borrado incompleto del catálogo

**Evidencia:** deleteApp invoca deleteDoc en apps/{id}. Firestore no elimina automáticamente subcolecciones.

**Riesgo:** Likes, comentarios, ratings y descargas huérfanos, dificultades operativas y problemas de conservación.

**Corrección:** Preferir archivado reversible; para borrado definitivo, ejecutar eliminación administrada por servidor con inventario de subcolecciones, registro y restauración posible.

### SEC-02 — ALTO — Autorización basada únicamente en correo

**Evidencia:** ProtectedRoute y las reglas usan un correo autorizado. La condición administrativa de firestore.rules no comprueba explícitamente email_verified.

**Riesgo:** Defensa en profundidad insuficiente y administración de roles limitada.

**Corrección:** Comprobar correo verificado, evaluar custom claims, mantener reglas del lado del servidor y ensayar accesos denegados/autorizados.

### INT-02 — ALTO — Contratos de datos incompatibles

**Evidencia:** Admin utiliza campos updatedAt, ratingSum y subcolección downloads en ciertos flujos; la tienda pública usa metricsUpdatedAt, ratingAverage y downloadClicks.

**Riesgo:** Denegaciones de permisos y métricas inconsistentes.

**Corrección:** Contrato versionado único para app, métricas y subcolecciones; migración retrocompatible, comprobación antes/después y plan de reversión.

### REL-01 — ALTO — Garantías automatizadas insuficientes

**Evidencia:** package.json de Admin define dev, build y preview, pero no test, lint o check; no se localizó el workflow convencional .github/workflows/ci.yml.

**Riesgo:** Regresiones sin detección temprana.

**Corrección:** Introducir ESLint, test runner, tests Firestore con Emulator, E2E y GitHub Actions con checks de integración.

### VAL-01 — MEDIO — Validaciones débiles

**Evidencia:** validateAppPayload exige campos obligatorios, pero no comprueba de forma suficiente estructura de URL, unicidad de slug e integridad editorial.

**Riesgo:** Apps duplicadas por slug, links inválidos y metadatos incorrectos.

**Corrección:** Validación de esquema, condiciones de publicación, comprobación de unicidad y validación de recursos externos.

### PERF-01 — MEDIO — Consultas seriales de comentarios

**Evidencia:** loadAllComments recorre las apps y ejecuta getDocs en serie para la subcolección de cada app.

**Riesgo:** Aumento de latencia y lecturas con el crecimiento de catálogo.

**Corrección:** Evaluar collectionGroup, índices y paginación por cursor, con mediciones reales de coste/rendimiento.

### DAT-03 — MEDIO — Modelo de valoración impreciso

**Evidencia:** La tienda pública redondea ratingAverage en cada actualización; Admin utiliza ratingSum/ratingCount.

**Riesgo:** Error acumulativo y dos fuentes divergentes.

**Corrección:** Mantener suma y cantidad como datos canónicos; calcular promedio para presentación, con conciliación de registros existentes.

### UX-01 — MEDIO — Estados y recuperación de errores

**Evidencia:** Varios componentes presentan errores genéricos y falta verificar sistemáticamente estados de carga, mensajes y accesibilidad.

**Riesgo:** Operaciones confusas y recuperación difícil.

**Corrección:** Feedback diferenciado y accionable, accesibilidad, confirmaciones, protección de cambios no guardados y tests de navegación.

## 4. Compatibilidad Admin / tienda pública

Ambos utilizan el Firebase projectId **webs-8b1bf** y la configuración cliente correspondiente. La apiKey pública del SDK web no constituye por sí misma un secreto de servidor; la protección efectiva depende de reglas, identidad y backend.

| Elemento | Admin | Tienda pública |
| --- | --- | --- |
| Correo administrativo en reglas | eler30.mr@gmail.com | ceo.developer.appsem@gmail.com |
| Campo temporal de métricas | updatedAt | metricsUpdatedAt |
| Subcolección de descargas | downloads | downloadClicks |
| Valoración | ratingSum / ratingCount | ratingAverage / ratingCount |
| Reglas de Firestore | Definición propia | Definición propia |

**Condición obligatoria:** No desplegar reglas unilateralmente. Antes, identificar las reglas actualmente publicadas y probar contra ellas los dos clientes. La divergencia de código no demuestra por sí sola un fallo activo.

## 5. Plan maestro de mejora — ocho fases

### FASE 1 — Línea base y estabilización

**Objetivo:** Obtener una referencia verificable antes de intervenir.

**Acciones:**
- Registrar hash de inicio y versiones de Admin y tienda.
- Inventariar colecciones, rutas, campos y operaciones.
- Obtener la versión actualmente desplegada de reglas Firestore.
- Preparar entorno con Firebase Emulator y datos sintéticos.
- Reproducir defectos, documentar riesgo y criterios de no regresión.

**Entregable:** Línea base, matriz de trazabilidad y pruebas reproducibles.  
**Cierre:** Diagnóstico reproducible y alcance consensuado sin cambios accidentales en producción.

### FASE 2 — Seguridad y autorización

**Objetivo:** Proteger identidad, métricas y operaciones sensibles.

**Acciones:**
- Unificar reglas y despliegue de Firestore.
- Reforzar control de administrador con validación del token/claims.
- Trasladar agregaciones a backend verificado.
- Prevenir interacciones duplicadas, automatización y abuso.
- Probar todos los accesos permitidos y denegados.

**Entregable:** Reglas centrales y suite de seguridad.  
**Cierre:** Tests críticos de permisos aprobados y sin vías conocidas de incrementos arbitrarios.

### FASE 3 — Integridad y modelo de datos

**Objetivo:** Garantizar consistencia transaccional y compatibilidad.

**Acciones:**
- Definir contrato canónico de apps, comentarios y métricas.
- Resguardar datos y diseñar migración sin interrupción.
- Convertir moderación a transacciones.
- Implementar archivado y limpieza de subcolecciones controlada.
- Reconciliar promedios, sumas, recuentos y registros.

**Entregable:** Esquema versionado, migraciones, rollback y transacciones.  
**Cierre:** Sin pérdida de datos en pruebas; contadores consistentes aun ante fallos simulados.

### FASE 4 — Gestión profesional del catálogo

**Objetivo:** Estabilizar la publicación editorial.

**Acciones:**
- Validar campos, URL, enlaces legales, imágenes y metadatos.
- Garantizar slug único mediante mecanismo seguro.
- Introducir checks previos a publicación y vista previa.
- Prevenir dobles envíos y pérdida de edición.
- Validar crear, editar, publicar, ocultar y archivar en los dos clientes.

**Entregable:** Formulario confiable y checklist de publicación.  
**Cierre:** Flujos E2E probados sin pérdida de información.

### FASE 5 — Diseño UX/UI y accesibilidad

**Objetivo:** Lograr un panel consistente, compacto y usable.

**Acciones:**
- Estandarizar tipografía, navegación y componentes.
- Optimizar formularios, tablas, responsive y jerarquía visual.
- Mostrar errores accionables y estados de carga/vacío.
- Verificar teclado, contraste, foco, etiquetas y diálogos.
- Preservar identidad visual y funciones existentes.

**Entregable:** Diseño consistente con verificación escritorio/móvil.  
**Cierre:** Recorridos completos usables y accesibilidad comprobada.

### FASE 6 — Rendimiento y escalabilidad

**Objetivo:** Reducir latencias y lecturas evitables.

**Acciones:**
- Medir carga y coste de consultas antes de optimizar.
- Implementar paginación real basada en cursor.
- Evaluar collectionGroup para comentarios e índices adecuados.
- Optimizar consultas y ordenar datos sin cargar colecciones completas.
- Fijar presupuesto de latencia y criterios de regresión.

**Entregable:** Informe comparativo y consultas optimizadas.  
**Cierre:** Presupuestos medidos cumplidos con cargas representativas.

### FASE 7 — Aseguramiento de calidad y CI

**Objetivo:** Garantizar que futuras mejoras no rompan lo aprobado.

**Acciones:**
- Añadir lint y tests unitarios/integración.
- Verificar reglas con Firebase Emulator.
- Probar flujos E2E, concurrencia, regresiones y errores.
- Auditar dependencias y compatibilidad.
- Configurar CI en GitHub Actions y proteger main.

**Entregable:** Pipeline automatizado con reportes y gates.  
**Cierre:** Comprobaciones críticas verdes; sin defectos críticos abiertos en release candidate.

### FASE 8 — Producción y operación

**Objetivo:** Preparar liberación controlada y recuperación real.

**Acciones:**
- Separar ambientes y permisos de desarrollo/producción.
- Configurar alertas, errores y trazabilidad.
- Validar copias de seguridad y restauración.
- Documentar release, rollback y respuesta ante incidentes.
- Aprobar formalmente versión candidata tras pruebas.

**Entregable:** Acta de liberación y manual operativo.  
**Cierre:** Recuperación probada, despliegue verificado y aprobación documentada.

## 6. Matriz de aceptación

| Fase | Evidencia exigida |
| --- | --- |
| 1 | Línea base y casos de fallo reproducibles. |
| 2 | Tests de seguridad allow/deny e interacciones protegidas. |
| 3 | Transacciones consistentes y migración sin pérdida. |
| 4 | CRUD y publicación validados end-to-end. |
| 5 | Interfaz responsive, accesible y comprensible. |
| 6 | Benchmarks y presupuestos de rendimiento aprobados. |
| 7 | CI y regresiones críticas verificadas. |
| 8 | Despliegue y restauración ensayados, acta final. |

## 7. Dependencias y orden de ejecución

**Ruta:** Fase 1 → Fases 2 y 3 coordinadas → Fases 4 y 5 → Fase 6 → Fase 7 integral → Fase 8. Las pruebas se construyen desde Fase 1; la Fase 7 es su verificación integral.

No cambiar reglas Firestore sin comprobar ambos repositorios. Los cambios de esquema deben tener periodo de compatibilidad y plan de reversión.

## 8. Política de ingeniería del proyecto

1. No modificar funciones fuera del alcance de cada fase sin justificación y regresión.
2. Mantener cambios pequeños, revisables y reversibles.
3. No borrar campos ni datos de producción sin respaldo y prueba de migración.
4. Integrar en main únicamente tras validación.
5. Registrar archivos cambiados, commit base/final, evidencia de pruebas y pendientes.
6. No declarar terminado un trabajo solo porque compila.
7. Separar claramente auditoría, implementación, pruebas y liberación.
8. Coordinar siempre las modificaciones de Admin con la tienda pública.

## 9. Plan mínimo de pruebas

| Área | Pruebas necesarias |
| --- | --- |
| Autorización | Administrador autorizado, correo no autorizado, anónimo; acceso a apps, comentarios y métricas. |
| Métricas | Likes y ratings duplicados, incremento sin evento, escritura maliciosa y concurrencia. |
| Moderación | Doble aprobación, eliminación concurrente, ocultado y errores intermedios. |
| Catálogo | Slug duplicado, imagen rota, URL incorrecta, publicar/ocultar y navegación pública. |
| Eliminación | Archivado, limpieza completa de subcolecciones y restauración. |
| Rendimiento | Catálogo creciente, consultas e índices, latencia y límites. |
| Regresión | Los dos clientes contra las mismas reglas y contrato de datos. |

## 10. Estado final y límites

**Resultado:** La arquitectura base puede evolucionar sin reconstrucción. La prioridad principal es unificar reglas y modelos de Firebase antes de introducir funcionalidades nuevas. Después, asegurar transacciones, formularios, rendimiento y procesos operativos.

**Importante:** Esta Auditoría 1 es un documento de diagnóstico y plan. No afirma que se haya modificado el código, aplicado reglas, ejecutado migraciones ni resuelto defectos. El estado de implementación de las ocho fases es **pendiente**.

## 11. Trazabilidad de fuentes

- https://github.com/eler30mr-star/appsem-store-admin
- https://github.com/eler30mr-star/appsem-store-admin/blob/main/firestore.rules
- https://github.com/eler30mr-star/appsem-store-admin/blob/main/src/services/appsService.js
- https://github.com/eler30mr-star/appsem-store-admin/blob/main/src/pages/AppFormPage.jsx
- https://github.com/eler30mr-star/appsem-store-admin/blob/main/src/components/ProtectedRoute.jsx
- https://github.com/eler30mr-star/appsem-store-admin/blob/main/package.json
- https://github.com/eler30mr-star/appsem-store
- https://github.com/eler30mr-star/appsem-store/blob/main/firestore.rules
- https://github.com/eler30mr-star/appsem-store/blob/main/src/services/appsService.js

---
**Control documental:** Auditoría 1 · Versión 1.0 · 13/10/2026. Este archivo es la referencia editable de la auditoría del proyecto; el informe Word se entrega para descarga en la conversación.