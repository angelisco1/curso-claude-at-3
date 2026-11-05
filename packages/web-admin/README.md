# RestTek - Web Admin

Panel de administración Angular para gestionar restaurantes, platos, ingredientes y empleados.

## Requisitos

- Node.js 22+
- npm 10+

## Instalación

```bash
npm install
```

## Desarrollo

Para iniciar el servidor de desarrollo:

```bash
npm start
```

La aplicación estará disponible en `http://localhost:4200`

## Funcionalidades

### Dashboard
Vista general con el listado de restaurantes.

### Restaurantes
- Listado, alta y edición de restaurantes.
- Cada restaurante tiene su propio dashboard con accesos a platos, ingredientes y empleados.

### Platos
- CRUD de platos por restaurante: nombre, descripción, precio, categoría (entrante, principal, postre, bebida), disponibilidad e ingredientes asociados.

### Ingredientes
- CRUD de ingredientes por restaurante: nombre, unidad y stock.

### Empleados
- Alta y listado de empleados por restaurante.
- Roles asignables desde el formulario: `manager`, `camarero`, `cocinero`.

## Estructura del Proyecto

```
src/app/
├── core/
│   └── layout/            # Shell component (sidebar + navegación) y página 404
└── features/
    ├── dashboard/          # Vista general
    ├── restaurants/        # models/services/store/pages: listado, alta, edición, dashboard por restaurante
    ├── dishes/             # models/services/store/pages: CRUD de platos
    ├── ingredients/        # models/services/store/pages: CRUD de ingredientes
    └── employees/          # models/services/store/pages: alta y listado de empleados
```

## Tests

### Unitarios (Vitest + jsdom)

```bash
npm test -w @resttek/web-admin        # desde la raíz, una sola ejecución
npm run test:watch                    # desde packages/web-admin, modo watch
```

Usan el builder `@angular/build:unit-test` con el runner `vitest`; los ficheros se llaman `*.spec.ts` y van junto al código que prueban.

### E2E y accesibilidad (Playwright + axe)

```bash
npm run e2e -w @resttek/web-admin         # todos los e2e (axe + recorrido con teclado)
npm run e2e:video -w @resttek/web-admin   # solo el recorrido con teclado, que graba el vídeo
```

Requisitos:

- Chromium de Playwright instalado: `npx playwright install chromium` (una sola vez).
- Base de datos con datos de prueba: `npm run seed` desde la raíz del monorepo.
- API (`:3000`) y `web-admin` (`:4200`): `playwright.config.ts` los arranca solos con `webServer` si no están ya levantados (`reuseExistingServer`).

Los e2e hacen login con `admin@resttek.com` por API e inyectan la sesión en `localStorage` (ver `e2e/fixtures/auth.ts`).

- `e2e/dish-form.a11y.spec.ts`: axe (WCAG 2.2 A/AA) sobre el formulario de platos vacío, con errores y en edición.
- `e2e/dish-form.keyboard.spec.ts`: recorrido completo del formulario de platos solo con teclado.

> Cada ejecución del recorrido con teclado crea un plato nuevo en `resttek.db`.

El vídeo del recorrido se guarda en `packages/web-admin/e2e-videos/dish-form-keyboard.webm`. Se regenera con `npm run e2e:video` y no se versiona (está en `.gitignore`).

## Build

Para hacer build de producción:

```bash
npm run build
```

Los archivos generados estarán en `dist/web-admin/browser/`
