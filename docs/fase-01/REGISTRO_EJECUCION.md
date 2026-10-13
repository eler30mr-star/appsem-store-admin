# Registro de ejecución — Fase 1

**Fecha de trabajo:** 13/10/2026  
**Repositorios de referencia:** Admin 906f054a1745db59e0397221b8b0e19c72ba9b9f; tienda e1e66d971251341f758dc3048eda6cb964188512.

## Acciones realizadas

1. Consultado el árbol Git de ambos repositorios en main; confirmado acceso en modo lectura a la tienda.
2. Inspeccionados componentes clave de rutas, autenticación, catálogo, moderación, servicios, reglas y utilidades.
3. Comparados proyectos Firebase, roles, subcolecciones, campos de métricas, reglas y contadores.
4. Identificadas ausencias del repositorio Admin: lockfile y workflow CI no aparecen en el árbol inspeccionado.
5. Preparados 12 tests nativos node:test; ejecutados en entorno aislado Linux/Node 22.16.0, sobre copias de las utilidades obtenidas de los archivos de GitHub.
6. Resultado: **12 tests aprobados, 0 fallos**. No hubo servidor Firebase ni compilación de la SPA durante esa ejecución.
7. Registrados comando y escáner descriptivo para reproducir en el checkout real del repositorio.

## Estado de verificación

| Verificación | Estado |
| --- | --- |
| Acceso e inventario Git | Realizado |
| Comparación estática de contratos Firestore | Realizada |
| Tests unitarios de utilidades (copia aislada) | 12/12 aprobados |
| Tests ejecutados contra checkout fresco de GitHub | Pendiente |
| npm install/npm ci y npm run build | Pendiente |
| Firebase Emulator Suite | Pendiente |
| Reglas realmente desplegadas | Desconocidas / pendiente |
| Datos reales y copias de seguridad | No inspeccionados ni alterados |
| Publicación o modificación de Firebase/Vercel | No realizada |

## Comandos de reproducción local (desde raíz del Admin)

1. node --version  (recomendado Node 20 o superior)
2. npm run test:baseline
3. npm run baseline:scan
4. npm run baseline:scan -- --json  (salida estructurada)

No se añadieron dependencias ni se realizaron cambios al tiempo de ejecución de la aplicación. Los tests se ejecutan sobre módulos puros del repositorio. El escáner textual no tiene poder para verificar permisos desplegados ni para demostrar que un riesgo ha sido corregido.

**Decisión:** Fase 1 abierta; no habilitar Fase 2 como concluida ni anunciar preparación de producción.


## Continuación — configuración de integración

Se preparó un flujo CI de GitHub Actions (Node 22 + Java 21) con npm install, 12 tests unitarios, escáner estático, compilación Vite y 10 tests Firestore en emulator. Se fijaron dependencias de desarrollo en package.json (@firebase/rules-unit-testing 3.0.4, firebase-tools 14.19.1) por compatibilidad con SDK Firebase 10 y Node/Java usados. No se cambió ninguna dependencia de producción.

**Nota de honestidad:** no se reclama el éxito de compilación, npm install ni tests de emulador sin ver el resultado efectivo del workflow. Si CI falla, registrar el error y corregir exclusivamente infraestructura/pruebas de Fase 1. La versión de reglas activa del Firebase real continúa desconocida.

## CI: primera ejecución y reparación de pruebas (13/10/2026)

- Workflow https://github.com/eler30mr-star/appsem-store-admin/actions/runs/38433138835 — dependencia npm, 12 tests básicos, escáner estático y compilación Vite: correctos.
- Los tests Firebase no arrancaron los casos porque el harness llamó `env.loadFirestoreRules`, método inexistente en @firebase/rules-unit-testing 3.0.4 (API v9).
- Corrección: inicializar RulesTestEnvironment con `firestore.rules` por cada escenario; limpiar recursos y datos entre casos. No se modificaron las reglas reales.
- El resultado de la ejecución nueva se verificará por separado; no se marcarán los 10 casos como aprobados hasta su ejecución efectiva.

## Ejecución verificada: GitHub Actions #38433378975 (13/10/2026)

URL: https://github.com/eler30mr-star/appsem-store-admin/actions/runs/38433378975

- Instalación npm: **PASS**
- 12 pruebas unitarias nativas Node: **PASS**
- Escáner estático: **PASS**
- `npm run build`: **PASS**
- Firebase Emulator: **10 subpruebas (1 test padre) PASS, 0 fallos**
- Resultado global de workflow: **SUCCESS**
- Versión Admin evaluada: `df012724310589f9b59131f44cfdaab904d7e469`
- No hubo despliegue de Firebase, Vercel ni uso de claves de producción.
- Se **confirmó** vía emulator que las reglas de Admin y tienda difieren en permisos; además, un visitante puede incrementar likesCount según las reglas actuales. Son fallos abiertos, aunque las pruebas de caracterización pasen.
- La versión efectiva de reglas del proyecto Firestore `webs-8b1bf` sigue sin comprobarse: la suite utiliza exclusivamente `demo-appsem-phase1`.

Los tests no implican un sistema seguro ni cerrado. Para cerrar Fase 1 también falta un respaldo/rollback validado e inspeccionar las reglas publicadas con acceso autorizado.

## Lockfile registrado y control temporal retirado

- Acción 38434014823 completada correctamente: https://github.com/eler30mr-star/appsem-store-admin/actions/runs/38434014823
- package-lock.json generado sobre Node 22, comprobado en main; commit de generación `f8dfb729649b7a888b2754920d68b553a80a2148`.
- Blob SHA de package-lock.json: `d35ba81cc7298ec604d6ca4f3a765c35880cfc75`.
- Flujo temporal de escritura `fase-01-lockfile-once.yml` eliminado en commit `44023c86487cb55c76d9a6a82cd2126b8dea411e`.
- A partir de ahora el pipeline principal utiliza `npm ci` contra el lockfile y mantiene permisos de lectura; falta confirmar la primera ejecución de este pipeline.

## Verificación final del pipeline reproducible

**Workflow #38434289201:** https://github.com/eler30mr-star/appsem-store-admin/actions/runs/38434289201

Resultado: **SUCCESS**. Se comprobaron instalación con `npm ci` desde `package-lock.json`, 12 pruebas unitarias, escaneo estático, compilación Vite y las 10 subpruebas Firestore del emulador. La aplicación y reglas operativas no se modificaron. El proyecto de emulación utilizado es `demo-appsem-phase1`.

**Cierre operativo de Fase 1: PENDIENTE** de verificar las reglas efectivamente publicadas de `webs-8b1bf` y un respaldo/restauración antes de modificar producción. La línea base de GitHub y su CI sí están verificadas. Esta fase no corrige SEC-01 ni incompatibilidades INT-01/02; se reservan para las fases posteriores.

## Recepción de reglas compartidas por el usuario — 13/10/2026

- Texto recibido íntegro por chat y copiado a `docs/fase-01/FIRESTORE_REGLAS_REPORTADAS_2026-10-13.rules`.
- **Estado de procedencia:** aportado por usuario; no verificable aún directamente contra Firebase Console.
- No se cambiaron reglas productivas, configuración de Firebase, documentos reales ni lógica de la aplicación.
- Se prepararon **17 pruebas nuevas de caracterización** con proyecto emulado `demo-appsem-phase1`; resultados de ejecución anotados mediante enlace CI tras completarse.
- Riesgos observados: contador incrementable por terceros sin evento, ratingAverage arbitrario, administración sin verificación explícita, URLs de downloadClicks sin whitelist.

## CI aprobada para reglas suministradas — 13/10/2026

- Commit de prueba: `0c31cf7b3887f52658415de365f8625d72013394`.
- Workflow: https://github.com/eler30mr-star/appsem-store-admin/actions/runs/38438813839
- Resultado: **SUCCESS**; instalación `npm ci`, 12 tests de utilidades, análisis de huellas, compilación Vite, 10 casos previos de Firestore y 17 casos nuevos de reglas proporcionadas.
- **Total de escenarios de caracterización: 39 (12 unitarios + 27 Firestore), todos aprobados.** Los 27 Firestore se desglosan en 10 casos originales y 17 nuevos.
- El Emulator Suite confirmó en las reglas aportadas incrementos públicos de contadores sin documento de interacción, promedio de valoración arbitrario, correo administrativo sin `email_verified` y aceptación de `targetUrl` sin restricción de protocolo.
- Las restricciones de lectura de borradores, edición de datos sensibles y moderación privada también se confirmaron en el emulador.
- **Limitación:** el archivo de reglas fue proporcionado por el usuario. No hay consulta autenticada que demuestre que coincide byte a byte con las reglas desplegadas en `webs-8b1bf`. La validación de respaldos y restauración también continúa pendiente.
- La primera ejecución de esta nueva suite falló por una llamada incorrecta a la API del fixture; se reparó en el commit indicado. El resultado verde citado corresponde a la ejecución posterior.

## Corrección de estado — confirmación expresa del propietario

El responsable aclaró el **13/10/2026** que el archivo `FIRESTORE_REGLAS_REPORTADAS_2026-10-13.rules` corresponde **exactamente a sus reglas actualmente activas en Firebase**. Esta confirmación del propietario resuelve la solicitud pendiente de identificación de reglas: **CERRADO**. Las anotaciones anteriores que las describen como no confirmadas reflejan el estado antes de dicha aclaración y quedan superadas por este registro.

Sigue pendiente únicamente el **respaldo y ensayo de restauración** antes de intervenciones sensibles en producción. No se realizó ningún cambio a datos ni reglas de Firebase.

## Respaldo Firestore en plan Spark — herramienta preparada

Se añadieron herramientas \`scripts/firestore/\` que exportan únicamente por lecturas de Admin SDK mediante ADC, generan respaldo NDJSON+gzip y manifiesto SHA-256, verifican la copia local y ensayan restauración exclusivamente en Firestore Emulator con proyecto demo-*. Se añadió \`.gitignore\` para respaldos/credenciales y pruebas unitarias e integración con datos ficticios.

**No se ha hecho exportación de los datos reales de webs-8b1bf**: no hay credenciales de producción disponibles ni se autorizará un servicio remoto a leer esos datos. El propietario ejecutará \`npm run firestore:backup -- --project=webs-8b1bf --confirm-read\` en su PC con ADC y luego hará verificación y ensayo.

Manual detallado: \`docs/fase-01/RESPALDO_MANUAL_SPARK.md\`. Hasta completar el respaldo REAL y su ensayo de restauración, el único pendiente de Fase 1 sigue abierto.

## Prueba final de herramienta Spark — validación automatizada

- Ejecución GitHub Actions: https://github.com/eler30mr-star/appsem-store-admin/actions/runs/38443488839
- Resultado: **SUCCESS**.
- **12/12 pruebas unitarias preexistentes**, **7/7 nuevas pruebas de codificación**, **30 tests del runner en Firebase Emulator** (incluye 27 casos de caracterización Firestore, dos pruebas padre y una prueba de respaldo/restauración con datos ficticios); 0 fallos.
- Integración de respaldo: cuatro documentos de ensayo recuperados, incluyendo subcolecciones bajo padre inexistente, mapas, blob, Timestamp y referencia. Detecta corrupción del gzip mediante SHA-256.
- Compilación Vite y `npm ci`: correctos.
- Primer intento falló por expectativa de nanosegundos distintos a la precisión realmente almacenada por Emulator. Se modificó el test para comparar el valor leído antes y después, no para alterar los datos.
- **Todavía no se ha leído Firestore real ni creado copia de webs-8b1bf**. Único pendiente de Fase 1: responsable ejecuta el respaldo local y confirma verificación y restauración de ensayo. No se requiere Blaze para ejecutar la herramienta, pero las lecturas consumen cuota.

## Copias cifradas GitHub — implementación y pruebas automatizadas

- Carpeta de destino `backups/encrypted/` inicializada con README; los datos `*.appsem.enc` serán archivos cifrados con contraseña personal.
- GitHub del Admin es **público**: solo archivos cifrados. Datos `documents.ndjson.gz` y credenciales permanecen excluidos de Git.
- Incorporados `scripts/firestore/encrypted.mjs`, `backup-github.mjs`, `decrypt-github.mjs` y test con una copia **sintética** que comprueba cifrado, descifrado, clave incorrecta y alteración de bytes.
- CI: [#38464874293](https://github.com/eler30mr-star/appsem-store-admin/actions/runs/38464874293) confirma éxito en la tarea de prueba criptográfica y compilación; comprobar estado final del workflow en el enlace.
- **No hay backup de datos reales** porque se necesitan credenciales ADC del propietario. No hay claves privadas, contraseñas ni documentos reales en el repositorio.


## Respaldo desde la sesión Admin — sin Cloud CLI

Se habilitó una nueva página protegida `/backups` en el panel de administración con lectura mediante Firebase Auth ya configurado: colección `apps` y las subcolecciones conocidas `comments`, `likes`, `ratings`, `downloadClicks`. El cifrado AES-256-GCM + PBKDF2 ocurre en el navegador antes de subir a `backups/encrypted/`, usando acceso de escritura limitado de GitHub aportado por el administrador. Se preservó la herramienta de Admin SDK para respaldo administrativo exhaustivo, que sí puede listar subcolecciones bajo padres inexistentes.

**Pruebas CI:** https://github.com/eler30mr-star/appsem-store-admin/actions/runs/38467378793 — SUCCESS, incluyendo creación y descifrado del nuevo formato en las pruebas de interoperabilidad Node/navegador, compilación y pruebas Firestore Emulator.

**Pendiente operativo:** la copia real sigue sin estar en GitHub. El usuario debe acceder al panel con su sesión autorizada, cifrar y subir; ninguna credencial Firebase real está disponible para esta ejecución automatizada del repositorio. No afirmar el cierre de Fase 1 hasta que aparezca un fichero real `*.appsem.enc` bajo `backups/encrypted/`, se valide su integridad y se ensaye una restauración.

## Copia real cifrada detectada en el mismo GitHub — 13/10/2026

Se comprobó mediante el listado de contenidos de GitHub que **existe efectivamente** un archivo de respaldo cifrado de Firestore en la rama `main`:

- Archivo: `backups/encrypted/appsem-firestore-2026-10-13T21-27-24-109Z-b3f473bd.appsem.enc`
- Tamaño registrado por GitHub: **6.497 bytes**
- Commit de subida: [`9e8faa174dd64c8e92c6cf826695595aabf9d0cf`](https://github.com/eler30mr-star/appsem-store-admin/commit/9e8faa174dd64c8e92c6cf826695595aabf9d0cf)
- Mensaje: `backup(firestore): guardar datos cifrados desde Admin 2026-10-13T21:27:24.109Z`.
- Captura proporcionada por el propietario: el panel confirma **31 documentos (4 apps)** al descargar otra copia cifrada posterior, `appsem-firestore-2026-10-13T21-27-49-729Z-af0c32e9.appsem.enc`.

**Estado actualizado:** requisito «archivo real en el mismo GitHub» = **COMPLETADO (existencia verificable)**. Como el archivo de GitHub está cifrado y no se dispone de su frase secreta, el contenido y su recuento **no se han comprobado independientemente**. El ensayo de descifrado y restauración de esta copia concreta en Firebase Emulator permanece pendiente antes de declarar cerrada totalmente la recuperación de Fase 1. No se publican claves, tokens ni datos privados en Git.

## Cierre operativo de la Fase 1 y arranque de Seguridad (13/10/2026)

Se registra el cierre de la fase de línea base por decisión del responsable y el inicio de la Fase 2 en `main`. Ver `docs/fase-01/CIERRE.md` y `docs/fase-02/README.md`. El respaldo cifrado **existe realmente** bajo `backups/encrypted/`; su recuperación contra Emulator aún **no ha sido ensayada con el archivo real**. No se aplicarán cambios sensibles al Firestore productivo hasta cubrir esa reserva y asegurar la compatibilidad de la tienda pública.
