# Fase 1 — Línea base y estabilización (Auditoría 1)

**Fecha de referencia:** 13/10/2026  
**Estado:** INICIADA; documentación y pruebas unitarias iniciales registradas. La verificación de Firebase desplegado y las pruebas de integración continúan PENDIENTES.  
**Alcance:** solo el repositorio administrativo. La tienda pública se inspeccionó en modo lectura.  
**Política:** no alterar ni desplegar reglas, migraciones ni código funcional hasta completar las pruebas y diseñar la compatibilidad.

## 1. Congelación lógica de referencias

| Repositorio | Rama | Commit evaluado |
| --- | --- | --- |
| eler30mr-star/appsem-store-admin | main | 906f054a1745db59e0397221b8b0e19c72ba9b9f |
| eler30mr-star/appsem-store | main | e1e66d971251341f758dc3048eda6cb964188512 |

El commit de Admin es el que registra Auditoría 1; antecede a los archivos de esta Fase 1. La publicación activa de Firestore NO se ha identificado ni verificado desde Firebase Console: los archivos del repositorio pueden no corresponder con las reglas publicadas.

## 2. Inventario de arquitectura (confirmado por árbol Git)

**Admin — React/Vite:** punto de entrada src/main.jsx; rutas en src/App.jsx; autenticación src/firebase.js + src/components/ProtectedRoute.jsx + src/pages/LoginPage.jsx; diseño src/components/AdminLayout.jsx y src/styles.css; pantallas DashboardPage, AppsPage, AppFormPage y CommentsPage; persistencia Firestore en src/services/appsService.js; configuración src/config.js; helpers categories, slug y formatters; despliegue SPA mediante vercel.json. Existe firestore.rules en raíz. Se encontró Auditoria_1_Appsem_Store_Admin.md bajo docs/auditorias.

**Tienda pública:** React/Vite, src/services/appsService.js, src/services/clientId.js, firestore.rules, firestore.indexes.json, páginas públicas y assets. Los dos clientes usan el mismo Firebase projectId (webs-8b1bf).

**Dependencias Admin registradas:** React 18.3.1, react-dom 18.3.1, react-router-dom 6.30.1, firebase 10.14.1, vite 5.4.19, @vitejs/plugin-react 4.3.4 y lucide-react 0.468.0. No se observó package-lock.json ni otro lockfile en el árbol de Admin; no hay garantía de instalación reproducible verificada. No se identificó pipeline de CI en el árbol inicial.

## 3. Flujos actuales que deben preservarse

1. Login Google mediante popup; acceso visual condicionado por correo; Firestore protege operaciones por reglas.
2. Dashboard: suscripción de apps y agregación local de estadísticas.
3. Catálogo: filtrar, crear, editar, publicar/ocultar y eliminar.
4. Formulario: descripción, categoría, imágenes externas, vínculos legales y datos técnicos.
5. Comentarios: cargar por app; aprobar, ocultar o eliminar.
6. Tienda pública: consultar solo apps publicadas, registrar likes, ratings, comentarios pendientes y clics de descarga.

## 4. Reproducción estática de riesgos: NO equivale a explotación confirmada

| ID | Comportamiento verificable en fuente | Validación dinámica futura |
| --- | --- | --- |
| SEC-01 | Reglas permiten incrementos públicos restringidos, sin validación robusta de evento real. | Firestore Emulator, abuso repetido e intentos anónimos. |
| SEC-02 | Reglas Admin comparan correo, sin requisito explícito email_verified. | Pruebas de autorización negativas/positivas. |
| DAT-01 | Moderación utiliza escrituras separadas para comentario y contador. | Fallo entre escrituras y operaciones concurrentes. |
| DAT-02 | deleteApp elimina el documento padre. | Verificar subcolecciones y recuperación. |
| INT-01/02 | Admin y tienda difieren en correo admitido, campos y subcolecciones. | Ambas apps ante UNA versión de reglas compartidas. |
| VAL-01 | Slug se deriva localmente sin comprobación de unicidad en servicio. | Intentar publicar títulos equivalentes. |
| PERF-01 | Comentarios se consultan secuencialmente por aplicación. | Medir con N aplicaciones y comentarios simulados. |

La observación de dos títulos que producen el mismo slug se cubre como caso de caracterización en tests; no significa que exista un duplicado real en producción.

## 5. Comprobaciones automatizadas añadidas

- npm run test:baseline — 12 tests con node:test, sin dependencias nuevas.
- npm run baseline:scan — inventario textual y huellas SHA-256 de archivos críticos del Admin.
- npm run baseline:scan -- --json — salida estructurada para seguimiento.

El escáner informa de riesgos presentes en el código; **no** ejecuta Firebase, no publica nada y no debe confundirse con una prueba de seguridad. Que una señal desaparezca solo significa que hay que revisar manualmente la nueva implementación.

## 6. Pendientes antes de cerrar Fase 1

- [x] Congelar referencias Git de ambos repositorios.
- [x] Inventariar módulos, colecciones, flujos y dependencias.
- [x] Registrar divergencias Admin/tienda y matriz de riesgos.
- [x] Añadir pruebas unitarias iniciales de comportamiento existente.
- [x] Preparar escáner estático de huellas, sin efecto sobre producción.
- [ ] Confirmar por consola Firebase qué reglas e índices están desplegados.
- [ ] Preparar y ejecutar Firebase Emulator Suite con datos totalmente ficticios.
- [ ] Ejecutar matriz integrada allow/deny y flujos multi-cliente.
- [ ] Establecer un respaldo verificable y procedimiento de rollback antes de cambios sensibles.
- [ ] Ejecutar npm ci / instalación reproducible y npm run build en checkout limpio tras fijar lockfile, sin introducir cambios funcionales imprevistos.

**Criterio de cierre:** evidencias reproducibles y línea base firmada para Admin y tienda; los puntos pendientes anteriores impiden marcar Fase 1 como 100 % completada.

Referencias adicionales: CONTRATO_FIREBASE_ACTUAL.md, MATRIZ_REGRESION.md y REGISTRO_EJECUCION.md.


## 7. Continuación: integración preparada (13/10/2026)

Se añadió una batería inicial de 10 casos de caracterización de Firestore contra dos versiones distintas de reglas: la de Admin y una copia fijada desde la tienda pública, commit e1e66d9. La copia se encuentra en tests/firestore/fixtures/public-firestore.rules y no es una nueva regla para desplegar.

También se incorporó firebase.phase1.json (configuración **exclusiva de emulador**) y el flujo .github/workflows/fase-01-baseline.yml con permisos GitHub de solo lectura; no utiliza credenciales ni despliega nada.

**Reproducción con Node 22, Java 21 y acceso a npm:**

    npm install
    npm run test:baseline
    npm run build
    npm run test:firestore

El comando test:firestore inicia y detiene automáticamente el Firestore Emulator con proyecto ficticio demo-appsem-phase1. El test exige FIRESTORE_EMULATOR_HOST antes de acceder a Firestore. Los casos SEC-01 prueban que el defecto sigue presente; un resultado verde representa una línea base, NO la eliminación del problema.

**Limitaciones:** la ejecución local de la suite de integración y compilación depende de instalar paquetes y el emulador; se documentará su resultado real en el registro de ejecución. La versión de reglas desplegada en webs-8b1bf sigue sin verificarse. Falta fijar package-lock.json después de una instalación reproducible.

## 8. Resultado de la ejecución automatizada de Fase 1

**CI aprobado:** https://github.com/eler30mr-star/appsem-store-admin/actions/runs/38433378975

Ejecución con Node 22 y Java 21 en GitHub Actions: instalación correcta, 12 pruebas base aprobadas, escáner ejecutado, Vite compilado y 10 escenarios de reglas Firestore aprobados en emulador. El emulador confirmó diferencias críticas entre Admin y tienda y un contador público manipulable (SEC-01). Todo ocurrió contra el proyecto ficticio `demo-appsem-phase1`.

**Estado:** fase 1 técnicamente avanzada, pero todavía abierta por no haberse contrastado las reglas desplegadas en `webs-8b1bf`, ni completado la restauración/backup operacional. Se añade exportación del lockfile de dependencias en CI para fijar instalaciones reproducibles posteriormente.

## 9. Reproducibilidad de dependencias

Se generó `package-lock.json` mediante GitHub Actions, sin modificar versiones declaradas en package.json. La CI cambia su instalación de `npm install` a `npm ci` para asegurar versiones transitivas fijadas. El flujo con permiso temporal de escritura se eliminó tras utilizarse una sola vez.

**Pendiente aún para cierre total:** verificación externa de reglas realmente desplegadas de Firebase, respaldo/restauración seguro en producción y consolidación formal de la línea base tras el último CI.

**Última ejecución CI comprobada:** [#38434289201](https://github.com/eler30mr-star/appsem-store-admin/actions/runs/38434289201) — **SUCCESS** con `npm ci`, build y 22 pruebas de caracterización (12 unitarias + 10 Firestore). Quedan pendientes la inspección de reglas activas y la recuperación/restauración de producción.

## 10. Reglas suministradas por el usuario (13/10/2026)

Se recibió una versión completa de Firestore Rules en el chat, archivada literalmente como [FIRESTORE_REGLAS_REPORTADAS_2026-10-13.rules](FIRESTORE_REGLAS_REPORTADAS_2026-10-13.rules). **Origen: texto aportado por el usuario; no se ha consultado la configuración de la consola Firebase para comprobar su despliegue real.** No reemplaza `firestore.rules` del repositorio ni despliega reglas.

Esta versión coincide con el correo administrativo usado por Admin y con `metricsUpdatedAt`, `ratingAverage` y `downloadClicks` utilizados por la tienda pública. Contiene un riesgo crítico conocido: admite incrementos de likes/descargas y modificación de promedios sin vincularlos con registros válidos. Tampoco exige `email_verified` para el administrador.

Se incorporaron 17 subpruebas de caracterización en `tests/firestore/reported-rules.test.mjs` para registrar de manera verificable permisos, denegaciones y debilidades. Estas pruebas **esperan los comportamientos actuales, incluso los inseguros**, y su resultado aprobado no significa que las vulnerabilidades estén corregidas.

**Falta para cierre definitivo de Fase 1:** confirmación independiente del despliegue desde la consola Firebase, respaldo/restauración verificables y acuerdo de política de conservación. El resto de evidencia automatizada ya existe.

**Actualización verificada 13/10/2026:** [GitHub Actions #38438813839](https://github.com/eler30mr-star/appsem-store-admin/actions/runs/38438813839): **SUCCESS**, 39 escenarios de caracterización (12 unitarios, 10 Firestore históricos y 17 de reglas aportadas). Se preserva la copia textual en `FIRESTORE_REGLAS_REPORTADAS_2026-10-13.rules`. Esta es la versión declarada por el usuario, no una descarga de Firebase Console. Persisten SEC-01 y SEC-02. El cierre operacional de Fase 1 requiere confirmar despliegue vigente y respaldo/restauración.

## 11. Aclaración del responsable del proyecto — reglas operativas confirmadas

**Confirmación directa del propietario:** Las reglas copiadas a `FIRESTORE_REGLAS_REPORTADAS_2026-10-13.rules` **son las reglas que tiene actualmente en Firebase Firestore**, según declaración explícita del responsable en esta conversación (13/10/2026).

El pendiente anterior «confirmar qué reglas están publicadas» queda **CERRADO por confirmación del propietario**. No debe exigirse otra comprobación de consola para avanzar. Se conserva la distinción documental: confirmación del propietario, no extracción automática de consola.

**Único pendiente operativo de Fase 1:** verificar un respaldo recuperable/restauración de Firestore antes de cambios sensibles de producción. Se puede iniciar Fase 2 en emulador sin esperar ese respaldo.

## 12. Herramienta de copia manual en Spark

Se preparó un proceso de respaldo solo-lectura sin necesidad de activar Blaze. Manual: [RESPALDO_MANUAL_SPARK.md](RESPALDO_MANUAL_SPARK.md). Incluye todos los documentos y subcolecciones, manifiesto e integridad SHA-256, modo de ensayo solo en Emulator, protección contra subir backups/credenciales a Git y tests sintéticos.

**No se debe confundir tener el programa con tener la copia real.** Falta que el propietario lo ejecute con sus credenciales autorizadas en Windows, valide resultados y ensaye la restauración. No es una instantánea transaccional.
