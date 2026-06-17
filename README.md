# Appsem Store Admin

Panel privado para administrar el catálogo público de Appsem Store.

## Administrador autorizado

```txt
eler30.mr@gmail.com
```

El panel permite iniciar sesión con Google, pero solo este correo puede acceder. También debes pegar las reglas de `firestore.rules` en Firebase para que Firestore permita crear, editar, publicar, ocultar y eliminar apps desde este correo.

## Funciones incluidas

- Login privado con Google.
- Acceso restringido por correo administrador.
- Dashboard general.
- Crear apps.
- Editar apps.
- Publicar u ocultar apps.
- Eliminar apps.
- Pegar enlaces de icono, banner y capturas desde GitHub.
- Guardar enlace de Google Play.
- Guardar política de privacidad por app.
- Ver estadísticas de solo lectura: likes, clics de descarga, valoraciones y comentarios aprobados.
- Moderar comentarios: aprobar, ocultar o eliminar.

## Estructura principal

```txt
src/firebase.js
src/config.js
src/pages/LoginPage.jsx
src/pages/DashboardPage.jsx
src/pages/AppsPage.jsx
src/pages/AppFormPage.jsx
src/pages/CommentsPage.jsx
src/services/appsService.js
src/data/categories.js
src/styles.css
firestore.rules
vercel.json
```

## Instalar y probar localmente

```bash
npm install
npm run dev
```

## Compilar para producción

```bash
npm run build
```

## Subir a GitHub

Repositorio recomendado:

```txt
appsem-store-admin
```

## Publicar en Vercel

1. Crea el repositorio `appsem-store-admin` en GitHub.
2. Sube los archivos de este proyecto.
3. En Vercel, importa el repositorio.
4. Framework: Vite.
5. Build command: `npm run build`.
6. Output directory: `dist`.

El archivo `vercel.json` ya está incluido para que las rutas internas funcionen al recargar la página.

## Reglas de Firebase

Copia el contenido de:

```txt
firestore.rules
```

y pégalo en:

```txt
Firebase Console > Firestore Database > Rules
```

Después publica las reglas.

## Documento recomendado para cada app

Colección:

```txt
apps
```

Campos principales:

```js
{
  title: "Biblia Universal",
  slug: "biblia-universal",
  category: "Libros y referencias",
  categoryKey: "libros-referencias",
  shortDescription: "Biblia completa con lectura, favoritos y temas bíblicos.",
  fullDescription: "Descripción completa de la app...",
  iconUrl: "https://raw.githubusercontent.com/.../icon.png",
  bannerUrl: "https://raw.githubusercontent.com/.../banner.png",
  screenshots: [
    "https://raw.githubusercontent.com/.../screenshot-1.png",
    "https://raw.githubusercontent.com/.../screenshot-2.png"
  ],
  playStoreUrl: "https://play.google.com/store/apps/details?id=com...",
  privacyPolicyUrl: "https://...",
  packageName: "com.appsmarttechnology.app",
  appSize: "25 MB",
  operatingSystem: "Android",
  minAndroidVersion: "Android 7.0 o superior",
  currentVersion: "1.0.0",
  developer: "AppsMart Technology",
  status: "published",
  likesCount: 0,
  downloadsCount: 0,
  ratingCount: 0,
  ratingSum: 0,
  ratingAverage: 0,
  commentsCount: 0
}
```

## Nota importante sobre comentarios

Los comentarios nuevos deben entrar desde la tienda pública como:

```js
approved: false
```

Luego desde este panel se aprueban. Cuando apruebas un comentario, el panel aumenta `commentsCount` para que la página pública muestre solo comentarios visibles/aprobados.

## Nota importante sobre valoraciones

Este panel usa:

```txt
ratingSum / ratingCount
```

para calcular el promedio. Por ejemplo, si una app tiene 3 valoraciones de 5, 4 y 5:

```txt
ratingSum = 14
ratingCount = 3
promedio = 4.7
```

## Nota importante sobre descargas

`downloadsCount` representa clics al botón de Google Play, no instalaciones reales. Las instalaciones reales se consultan en Google Play Console.
