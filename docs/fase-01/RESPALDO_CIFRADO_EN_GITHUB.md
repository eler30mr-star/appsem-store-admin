# Respaldo cifrado dentro de GitHub — Appsem Store Admin

**Destino:** repositorio público \`eler30mr-star/appsem-store-admin\`, rama \`main\`, carpeta \`backups/encrypted/\`.

**Importante:** el proyecto GitHub es público. Por eso **solo se permite subir el archivo cifrado \`*.appsem.enc\`**, nunca \`documents.ndjson.gz\`, \`manifest.json\` con datos, credenciales, claves ni contraseñas. La contraseña no se guarda en GitHub.

## Requisitos en tu PC

- Git configurado con acceso de escritura al repositorio \`eler30mr-star/appsem-store-admin\` (origin), rama \`main\` sincronizada y sin cambios pendientes.
- Node 22, \`npm ci\` y Google Cloud CLI instalado.
- Una identidad de Google con permiso para **leer** Firestore \`webs-8b1bf\` usando Application Default Credentials (ADC).
- Crea una frase secreta **única y larga** (mínimo 20 caracteres), guárdala fuera de GitHub en un administrador de contraseñas seguro. Si la pierdes, NO se puede descifrar el respaldo.

En PowerShell, dentro del proyecto:

\`\`\`powershell
git pull origin main
npm ci
gcloud auth application-default login
npm run firestore:backup:github -- --project=webs-8b1bf --confirm-read --confirm-github
\`\`\`

El programa pedirá la frase secreta **sin mostrarla en pantalla** y la confirmará. A continuación:
1. Exporta todos los documentos y subcolecciones que tu identidad pueda leer a una carpeta temporal ignorada por Git.
2. Verifica SHA-256 y cifra documentos+manifiesto mediante AES-256-GCM y scrypt. Lee de nuevo el archivo cifrado y comprueba que se puede recuperar.
3. Elimina las carpetas temporales descifradas de esta operación.
4. Confirma y sube **únicamente** \`backups/encrypted/archivo.appsem.enc\` al GitHub del proyecto.

Si el fichero cifrado excede 90 MiB, el programa impide su subida por Git y solicita otro almacenamiento. Si el push falla, puede quedar un commit local pendiente: revisa \`git status\` y \`git log -1\` antes de volver a intentarlo. Esta operación consume lecturas de Firestore.

## Recuperar un respaldo guardado en GitHub

\`\`\`powershell
git pull origin main
npm ci
npm run firestore:decrypt -- "backups/encrypted/NOMBRE-DEL-ARCHIVO.appsem.enc"
\`\`\`

El programa pide la **misma frase secreta**. Descifra los datos en una carpeta local \`backups/firestore/restored-...\` no rastreada por Git; comprueba SHA-256 y cuenta los documentos.

Para ensayar restauración con el emulador (NUNCA con producción), seguir [RESPALDO_MANUAL_SPARK.md](RESPALDO_MANUAL_SPARK.md), usando la carpeta descifrada. El restaurador solo permite \`FIRESTORE_EMULATOR_HOST=127.0.0.1:8080\` y proyectos \`demo-*\`.

## Alcances y seguridad

- No incluye Firebase Authentication, Storage, índices ni reglas; respalda solo documentos Firestore.
- Un respaldo manual NO es una instantánea atómica; evita modificar Firestore mientras exporta.
- **Un repositorio público no es el destino ideal de una copia sensible**, aun cifrada. Git conserva las versiones históricas. Protege la frase secreta; nunca la compartas por chat o GitHub.
- El cifrado verifica integridad y confidencialidad, pero no asegura consistencia transaccional ni reemplaza una prueba de restauración completa.
- Sin sesión ADC y Git autenticada en el PC no es posible crear ni subir la copia real desde esta conversación. El código en GitHub es la herramienta; el backup de producción solo existe después de ejecutar el comando y comprobar la subida.
