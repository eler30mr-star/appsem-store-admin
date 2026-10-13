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
