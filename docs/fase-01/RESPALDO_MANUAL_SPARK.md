# Respaldo manual y ensayo de recuperación — plan Spark

**Proyecto:** Firebase Firestore (default) de webs-8b1bf.
**Propósito:** realizar una copia LOCAL de datos usando un lector autorizado de Google Cloud, verificar SHA-256 y restaurar en un EMULADOR aislado sin tocar producción.

> No se ha hecho aún una copia de producción. Se entrega una herramienta preparada para que el responsable la ejecute localmente. Ninguna credencial, token ni copia de datos debe guardarse en GitHub ni enviarse al chat.

## Qué protege y qué NO

- Incluye todos los documentos accesibles mediante la cuenta de servicio/credencial elegida, **todas las colecciones raíz y subcolecciones**, incluso bajo un documento padre inexistente.
- Conserva timestamps (segundos/nanosegundos), referencias, geopuntos, blobs binarios, valores especiales y mapas.
- Crea archivos `documents.ndjson.gz` y `manifest.json`, con número de documentos y SHA-256.
- El código exportador solo consulta Firestore; **NO modifica documentos ni reglas**.
- NO incluye Firebase Authentication, Storage (APK, imágenes), usuarios de Auth, Hosting, índices ni reglas. Las reglas versionadas del repositorio siguen respaldadas en Git, pero pueden diferir de las publicadas.
- No es una instantánea transaccional: las escrituras que ocurran durante la exportación pueden producir una copia con datos capturados en momentos distintos. Evitar editar/publicar apps y moderar comentarios mientras se ejecuta.
- La exportación emplea lecturas y puede consumir cuota Spark. Para colecciones grandes y copias consistentes hay que valorar exportación/backup administrados y costos.

## Paso 1: preparar el PC (PowerShell)

En la carpeta local actualizada de `appsem-store-admin`:

    git pull origin main
    node --version
    npm ci

Recomendado Node.js 22. Es necesaria una identidad de Google con permisos de **lectura de datos de Firestore** para `webs-8b1bf`.

Forma recomendada, sin descargar claves privadas de servicio: instalar Google Cloud CLI (`gcloud`) e iniciar sesión:

    gcloud auth application-default login

**Importante:** iniciar sesión en Firebase Console o hacer `firebase login` NO equivale a crear credenciales ADC de `gcloud`. Usa exclusivamente tu cuenta autorizada. No copies tokens o claves a ningún repositorio.

## Paso 2: exportar datos reales (solo lectura)

    npm run firestore:backup -- --project=webs-8b1bf --confirm-read

Carpeta por defecto: `backups\firestore\backup-XXXXXXXX`, incluida en `.gitignore`. Puede elegirse otra ubicación con `--out="D:\RespaldoSeguro\Appsem"`, preferentemente fuera de la carpeta del proyecto.

Al terminar verás el recuento de documentos y la huella SHA-256. Si el comando indica error o se interrumpe, **NO consideres que existe una copia correcta**. Conserva el resultado en una unidad segura, cifrada y con acceso restringido; haz también una segunda copia fuera del PC.

## Paso 3: verificar integridad

Usa la carpeta exacta impresa por el exportador:

    npm run firestore:verify -- "D:\RespaldoSeguro\Appsem\backup-XXXXXXXX"

Debe informar `Copia íntegra`, número de documentos y proyecto origen. Validar SHA-256 protege contra modificación o truncamiento del archivo, pero no demuestra por sí mismo que se pueda recuperar.

## Paso 4: probar restauración SOLO en el emulador

En **PowerShell 1**, desde el proyecto:

    npx firebase emulators:start --config firebase.phase1.json --project demo-appsem-phase1 --only firestore

En **PowerShell 2**, desde el proyecto, establece únicamente el destino de prueba:

    $env:FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"
    $env:GCLOUD_PROJECT="demo-appsem-phase1"
    npm run firestore:restore:demo -- "D:\RespaldoSeguro\Appsem\backup-XXXXXXXX"

Eso **solo verifica y simula**. Para ensayar la escritura en el emulador (NUNCA en producción):

    npm run firestore:restore:demo -- "D:\RespaldoSeguro\Appsem\backup-XXXXXXXX" --apply

El restaurador bloquea hosts remotos y proyectos que no empiecen por `demo-`; la lógica de restauración también impone estas guardas. La ejecución **no borra** colecciones del emulador: usa set por documento, así que para un ensayo limpio debe partir de un emulador vacío.

Al terminar, detén el emulador (`Ctrl+C`). La sesión ADC y los datos de producción no se necesitan para restaurar en emulador.

## Criterio de cierre de Fase 1

No debe declararse cerrado el respaldo real hasta contar con:
1. Carpeta de backup de producción con manifiesto válido.
2. Resultado de `firestore:verify` satisfactorio.
3. Restauración de ensayo en emulador y recuento coincidente.
4. Confirmación de custodia privada y de posibilidad de recuperar el archivo.

**No pegar aquí documentos, respaldos, claves o tokens.** Solo compartir resultados no sensibles: cantidad de documentos y el texto de éxito/error.


## Guardar copia en el mismo GitHub (público) — alternativa CIFRADA

Si quieres que la copia también permanezca en GitHub dentro del proyecto, **no subas documentos en claro**. Usa el flujo con cifrado descrito en [RESPALDO_CIFRADO_EN_GITHUB.md](RESPALDO_CIFRADO_EN_GITHUB.md). La copia se almacena bajo `backups/encrypted/` y requiere contraseña privada para restaurarse. El repositorio es público, así que mantener la contraseña fuera es esencial.

