# Copias cifradas de Firestore

En esta carpeta se publicarán **únicamente** archivos `*.appsem.enc` después de ejecutar el comando de exportación autenticado desde el equipo del propietario.

- **Repositorio público:** nunca guardar aquí archivos `documents.ndjson.gz`, credenciales, datos sin cifrar ni contraseñas.
- Estado actual: **solo la infraestructura de respaldo está preparada**; esta carpeta no certifica que exista una copia real de Firestore.
- Para generar una copia cifrada, consultar [la guía](../../docs/fase-01/RESPALDO_CIFRADO_EN_GITHUB.md).

La frase secreta del cifrado se conserva **fuera de GitHub**. Sin ella no será posible recuperar los datos.
