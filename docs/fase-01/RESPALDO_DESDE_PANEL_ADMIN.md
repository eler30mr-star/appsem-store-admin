# Copia de Firestore desde el panel Admin

La aplicación web ya está conectada al proyecto Firebase `webs-8b1bf`. La pantalla **Respaldos** usa la sesión iniciada en Firebase, sin Google Cloud CLI.

## Operación

1. Inicia sesión en Appsem Store Admin y abre **Respaldos** desde el menú lateral.
2. Escribe y confirma una frase secreta de al menos 20 caracteres. Consérvala en un lugar seguro **fuera de GitHub**.
3. Para subir el archivo directamente a GitHub, genera un token de acceso personal de permisos limitados desde [GitHub](https://github.com/settings/personal-access-tokens/new): selecciona solamente el repositorio `eler30mr-star/appsem-store-admin` y el permiso **Contents: Read and write**. Establece una caducidad corta y revócalo después.
4. Introduce el token en el panel y pulsa **Guardar copia cifrada en GitHub**. El panel verifica que la subida se haya completado y muestra el enlace de GitHub.
5. También puedes pulsar **Descargar copia cifrada** y subir el archivo cifrado manualmente desde GitHub.

El repositorio es **público**. Nunca publiques el respaldo sin cifrar ni tu frase secreta. El programa cifra los datos antes de enviarlos a GitHub; la contraseña no se envía ni se guarda allí.

## Alcance

Desde el navegador se exportan `apps` y sus subcolecciones conocidas `comments`, `likes`, `ratings` y `downloadClicks` para documentos padre existentes. No puede descubrir subcolecciones bajo padres inexistentes ni colecciones de otro tipo; para una exportación administrativa completa se mantiene la herramienta local basada en Admin SDK. Tampoco incluye Authentication, Storage ni índices. No es una instantánea transaccional.

## Recuperar

Los archivos `*.appsem.enc` del navegador se recuperan con el mismo comando Node usado por la herramienta local:

```powershell
npm run firestore:decrypt -- "backups/encrypted/ARCHIVO.appsem.enc"
```

Luego puede probarse la restauración únicamente en Firebase Emulator siguiendo `RESPALDO_MANUAL_SPARK.md`. No se restauran documentos en producción.

**Estado:** tener la pantalla instalada no constituye una copia real. La copia real existe solo después de completar la lectura, cifrado y subida y comprobar el enlace bajo `backups/encrypted/`.
