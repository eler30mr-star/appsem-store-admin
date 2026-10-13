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
