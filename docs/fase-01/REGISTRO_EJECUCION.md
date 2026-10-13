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
