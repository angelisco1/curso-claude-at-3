# 10 - Accesibilizar el formulario de platos

- **Tipo:** feature
- **Issue:** #10

## Objetivo

Hacer accesible el formulario de creación/edición de platos de `web-admin` (`/restaurants/:restaurantId/dishes/new` y `/restaurants/:restaurantId/dishes/:id/edit`) según WCAG 2.2 nivel AA, de forma que se pueda completar y enviar **solo con el teclado**, con un orden de tabulación lógico y un foco siempre visible.

Hoy el formulario no es operable con teclado: los botones "Añadir ingrediente", "Quitar ingrediente", "Cancelar" y "Guardar" son `<div>` con `(click)` (no reciben foco ni responden a Enter/Espacio), las etiquetas son `<div class="fake-label">` sin asociación con su campo, el título es un `<div>` (no hay `<h1>`), no existe `<form>` (Enter no envía), no hay validación en cliente ni errores asociados a los campos, y `styles.css` elimina el `outline` de todos los `button`.

Además se añade infraestructura de tests a `web-admin` (hoy no tiene ninguna): **Vitest** para tests unitarios (builder `@angular/build:unit-test`) y **Playwright** para e2e, con **axe** (`@axe-core/playwright`) para validar la accesibilidad y un vídeo grabado del recorrido completo con teclado guardado en `e2e-videos/`.

## Alcance

**Incluye:**
- Configuración de tests unitarios en `web-admin` con Vitest + jsdom (`ng test`).
- Configuración de Playwright en `web-admin` (Chromium) con `@axe-core/playwright`.
- Semántica del formulario: `<form (ngSubmit)>`, `<h1>`/`<h2>`, `<label for>` + `id` en todos los campos, lista `<ul>` de ingredientes, `fieldset`/`legend` para el bloque "Añadir ingrediente".
- Sustituir todos los `<div>` clicables por `<button>`/`<a>` reales con nombre accesible (`aria-label` en los botones de solo icono; iconos con `aria-hidden="true"`).
- Validación en cliente (nombre obligatorio, precio > 0, ingrediente seleccionado y cantidad > 0) con mensajes asociados por `aria-describedby`, `aria-invalid`, resumen de errores con `role="alert"` y foco al primer campo inválido al enviar.
- Gestión del foco al añadir/quitar ingredientes y anuncio en región `aria-live="polite"`.
- Estilos `:focus-visible` claramente visibles (contraste ≥ 3:1) en botones, enlaces y chips; revisión de contraste de textos/placeholder si axe lo reporta.
- Título de página (`<title>`) por ruta: "Nuevo plato · RestTek" / "Editar plato · RestTek".
- Test e2e grabado en vídeo que recorre el formulario solo con teclado (modifica datos, añade y quita ingredientes, envía incompleto para ver errores, crea el plato correctamente y lo ve en la lista) → `packages/web-admin/e2e-videos/dish-form-keyboard.webm`.
- Test e2e con axe (etiquetas `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`) sobre el formulario vacío, con errores visibles y en modo edición.
- `.prettierrc` en `web-admin` que respete el estilo actual y formateo de los archivos tocados.

**No incluye:**
- Accesibilidad del resto de pantallas de `web-admin` (lista de platos, ingredientes, empleados, shell/sidebar, login de `web-shared`), salvo lo imprescindible para llegar al formulario.
- Cambios en la API (`packages/api`) ni en sus validaciones.
- Tests unitarios ni e2e en `web-empleados`, `web-clientes` o `web-shared`.
- Integración en CI ni scripts en el `package.json` raíz más allá de los indicados.
- Configurar ESLint (no existe en el repo).
- Arreglar las issues #3 (página en blanco en URL directa de platos) y #4 (seed no borra datos), aunque afectan al e2e (ver Dudas).

## Archivos afectados

| Archivo | Acción | Motivo |
| --- | --- | --- |
| `packages/web-admin/package.json` | modificar | Añadir devDependencies (`vitest`, `jsdom`, `@playwright/test`, `@axe-core/playwright`) y scripts `test`, `test:watch`, `e2e`, `e2e:video` |
| `packages/web-admin/angular.json` | modificar | Añadir target `test` con builder `@angular/build:unit-test` (runner `vitest`, `tsConfig: tsconfig.spec.json`) |
| `packages/web-admin/tsconfig.spec.json` | modificar | Revisar `types`/`include` para Vitest (ya referencia `vitest/globals` y `*.spec.ts`) |
| `packages/web-admin/tsconfig.json` | modificar | Añadir referencia a `tsconfig.spec.json` (y excluir `e2e/` del build de la app) |
| `packages/web-admin/playwright.config.ts` | crear | `testDir: 'e2e'`, `baseURL: http://localhost:4200`, proyecto Chromium, `webServer` para API (`:3000/health`) y web-admin (`:4200`) con `reuseExistingServer: true` |
| `packages/web-admin/e2e/tsconfig.json` | crear | Config TS independiente para los e2e (no mezclarlos con `ng test`) |
| `packages/web-admin/e2e/fixtures/auth.ts` | crear | Fixture que hace login vía `POST /api/v1/auth/login` (`admin@resttek.com`) e inyecta `auth_token`/`auth_user` en `localStorage` con `addInitScript` |
| `packages/web-admin/e2e/dish-form.a11y.spec.ts` | crear | Auditoría axe del formulario (vacío, con errores, edición) |
| `packages/web-admin/e2e/dish-form.keyboard.spec.ts` | crear | Recorrido solo con teclado + grabación de vídeo en `e2e-videos/` |
| `packages/web-admin/e2e-videos/.gitkeep` | crear | Carpeta destino del vídeo |
| `packages/web-admin/.gitignore` | modificar | Ignorar `/test-results`, `/playwright-report`, `/blob-report` (no el vídeo) |
| `packages/web-admin/.prettierrc` | crear | `semi: false`, `singleQuote: true`, parser `angular` para HTML (estilo actual del código) |
| `packages/web-admin/src/app/features/dishes/pages/dish-form/dish-form.validation.ts` | crear | Función pura `validateDishForm()` y `validateNewIngredient()` + tipo `DishFormErrors` |
| `packages/web-admin/src/app/features/dishes/pages/dish-form/dish-form.validation.spec.ts` | crear | Tests unitarios de la validación (TDD) |
| `packages/web-admin/src/app/features/dishes/pages/dish-form/dish-form.component.spec.ts` | crear | Tests unitarios del componente (semántica, teclado, errores, foco, aria-live) |
| `packages/web-admin/src/app/features/dishes/pages/dish-form/dish-form.component.ts` | modificar | Validación, signals de errores, gestión de foco (`viewChild`/`viewChildren`), mensaje `aria-live`, `submitted` |
| `packages/web-admin/src/app/features/dishes/pages/dish-form/dish-form.component.html` | modificar | `<form>`, encabezados, labels, botones reales, errores, `aria-*`, lista de ingredientes |
| `packages/web-admin/src/app/features/dishes/pages/dish-form/dish-form.component.css` | modificar | Estilos `:focus-visible`, mensajes de error, eliminar clases `fake-*`, `.visually-hidden` si no va global |
| `packages/web-admin/src/app/features/dishes/dishes.routes.ts` | modificar | Propiedad `title` en las rutas `new` y `:id/edit` |
| `packages/web-admin/src/styles.css` | modificar | Quitar `outline: none` global de `button`, añadir `:focus-visible` global y utilidad `.visually-hidden`; ajustar `--text-muted` si no cumple contraste |
| `packages/web-admin/README.md` | modificar | Documentar `npm test`, `npm run e2e`, requisitos (API + seed) y dónde queda el vídeo |

## Tareas

Cada tarea debe poder hacerse en 5-10 minutos. En las tareas de código se sigue TDD: **primero el test unitario en rojo, después el código mínimo para ponerlo en verde**. Los tests unitarios indicados son los que hay que escribir en cada tarea.

### Bloque A — Infraestructura de tests

- [x] 1. **Instalar dependencias de test unitario.** `npm i -D vitest jsdom -w @resttek/web-admin`. Añadir en `angular.json` el target `test` (`builder: @angular/build:unit-test`, `options: { tsConfig: "tsconfig.spec.json", runner: "vitest", buildTarget: "::development" }`) y en `package.json` los scripts `"test": "ng test --watch=false"` y `"test:watch": "ng test"`. Añadir la referencia a `tsconfig.spec.json` en `tsconfig.json`.
- [x] 2. **Smoke test de Vitest.** Crear `dish-form.validation.spec.ts` con un test trivial (`expect(true).toBe(true)`) y verificar que `npm test -w @resttek/web-admin` lo ejecuta en verde. Después borrar el test trivial.
- [x] 3. **Instalar Playwright y axe.** `npm i -D @playwright/test @axe-core/playwright -w @resttek/web-admin` y `npx playwright install chromium`. Crear `playwright.config.ts` (testDir `e2e`, `baseURL`, `use.trace: 'retain-on-failure'`, `webServer` con dos entradas: `npm run dev:api` en la raíz esperando `http://localhost:3000/health` y `npm start` esperando `http://localhost:4200`, ambas con `reuseExistingServer: true`). Crear `e2e/tsconfig.json`, `e2e-videos/.gitkeep`, scripts `"e2e": "playwright test"` y actualizar `.gitignore`.
- [x] 4. **Fixture de autenticación e2e.** Crear `e2e/fixtures/auth.ts` que extiende `test` con un `page` ya autenticado (login con `request.post('/api/v1/auth/login')` y `addInitScript` que escribe `auth_token` y `auth_user` en `localStorage`). Test de humo provisional: abre `/restaurants/rest-1/dishes/new` y comprueba que se ve el formulario.

### Bloque B — Validación en cliente (función pura)

- [x] 5. **Validación del nombre.**
  - Tests: `validateDishForm` devuelve `{ name: 'El nombre es obligatorio' }` con `name: ''` y con `name: '   '`; no devuelve error de nombre con `'Pizza'`.
  - Código: crear `dish-form.validation.ts` con el tipo `DishFormErrors = Partial<Record<'name' | 'price', string>>` y `validateDishForm(form: CreateDishDto): DishFormErrors`.
- [x] 6. **Validación del precio.**
  - Tests: error `'El precio debe ser mayor que 0'` con `0`, `-1`, `null`/`NaN` (campo vacío en `type="number"`); sin error con `0.5` y `12`. Un formulario válido devuelve `{}`.
  - Código: añadir la regla de precio a `validateDishForm` (coherente con `InvalidPriceError` de la API: precio > 0).
- [x] 7. **Validación del nuevo ingrediente.**
  - Tests: `validateNewIngredient(id, qty, existentes)` devuelve error `ingredient: 'Selecciona un ingrediente'` si `id === ''`; `quantity: 'La cantidad debe ser mayor que 0'` si `qty <= 0` o `NaN`; `ingredient: 'Este ingrediente ya está en el plato'` si ya existe; `{}` si es válido.
  - Código: implementar `validateNewIngredient` y el tipo `NewIngredientErrors`.

### Bloque C — Semántica y nombres accesibles del componente

- [x] 8. **Montaje del componente en TestBed.**
  - Tests: el componente se crea con `provideRouter([])`, `ActivatedRoute` simulado (`parent.snapshot.params.restaurantId = 'rest-1'`) y dobles de `DishStore`, `DishService` e `IngredientStore` (con `ingredients` como `signal` con 2 ingredientes de prueba); renderiza un `<h1>` con texto "Nuevo plato".
  - Código: cambiar `<div class="fake-title">` por `<h1>` y "Ingredientes del plato" por `<h2>`; eliminar las clases `fake-*` del CSS y reutilizar los estilos de `.page-header h1`.
- [x] 9. **Etiquetas asociadas a los campos.**
  - Tests: existen y están asociados por `for`/`id` los controles con label "Nombre del plato", "Precio (€)", "Categoría", "Disponible", "Descripción (opcional)", "Ingrediente" y "Cantidad" (buscar `label[for=X]` y `#X`); nombre y precio tienen `required` y `aria-required="true"`.
  - Código: sustituir `<div class="fake-label">` por `<label for>` con `id` únicos (`dish-name`, `dish-price`, `dish-category`, `dish-available`, `dish-description`, `new-ingredient`, `new-ingredient-qty`); añadir indicador visual "(obligatorio)"; `step="0.01"`, `min="0"` e `inputmode="decimal"` en precio; `autocomplete="off"` en nombre.
- [x] 10. **Formulario real y botones de acción.**
  - Tests: existe un `<form>`; el botón "Guardar" es `button[type=submit]`; "Cancelar" es un `<a>` con `href` a `/restaurants/rest-1/dishes`; el enlace "volver" tiene `aria-label="Volver a la lista de platos"`; disparar `submit` en el `<form>` llama a `onSubmit`.
  - Código: envolver campos en `<form (ngSubmit)="onSubmit()" novalidate>`; `Guardar` → `<button type="submit" class="btn btn-primary" [disabled]="loading()">`; `Cancelar` → `<a class="btn btn-secondary" [routerLink]="listUrl">`; `aria-label` en el enlace "volver"; `aria-hidden="true"` en todos los `<lucide-icon>`.
- [x] 11. **Botones de ingredientes accesibles.**
  - Tests: el botón de añadir es `button[type=button]` con `aria-label="Añadir ingrediente"`; con un ingrediente en `form.ingredients` se renderiza una `<ul>` con un `<li>` y un `button[type=button]` con `aria-label="Quitar Tomate (kg)"`; hacer `click()` en ellos (equivalente a Enter/Espacio en un `<button>` nativo) llama a `addIngredient`/`removeIngredient`.
  - Código: chips como `<ul class="ingredient-chips"><li class="ingredient-chip">…`; `chip-remove` y el `+` pasan a `<button type="button">` con `aria-label`; bloque "Añadir ingrediente" dentro de `<fieldset>` con `<legend class="visually-hidden">Añadir ingrediente</legend>`.

### Bloque D — Errores accesibles

- [x] 12. **No enviar si hay errores.**
  - Tests: con `name: ''`, `onSubmit()` no llama a `store.create` y `errors()` contiene el error de nombre; con datos válidos sí llama a `store.create('rest-1', form)` y navega a la lista.
  - Código: signal `errors = signal<DishFormErrors>({})` y `submitted = signal(false)`; `onSubmit()` ejecuta `validateDishForm` y retorna antes de llamar al store si hay errores.
- [x] 13. **Errores asociados a cada campo.**
  - Tests: tras enviar vacío, `#dish-name` tiene `aria-invalid="true"` y `aria-describedby="dish-name-error"`, y `#dish-name-error` contiene "El nombre es obligatorio"; lo mismo para el precio; tras corregir y reenviar, desaparecen `aria-invalid` y el mensaje.
  - Código: en la plantilla, `[attr.aria-invalid]` y `[attr.aria-describedby]` condicionales y `<p class="field-error" id="…-error">` con icono `aria-hidden` + texto (no solo color, WCAG 1.4.1).
- [x] 14. **Resumen de errores y foco al primer campo inválido.**
  - Tests: tras enviar vacío existe un elemento `role="alert"` con el texto "Revisa los campos marcados: 2 errores" y `document.activeElement` es `#dish-name`; si solo falla el precio, el foco va a `#dish-price`.
  - Código: bloque resumen con `role="alert"` encima del formulario (con enlaces `href="#dish-name"` a cada campo); `viewChild` de los inputs (o `ElementRef` + `querySelector`) y `focus()` sobre el primero con error tras `afterNextRender`/`setTimeout` (zoneless).
- [x] 15. **Error de servidor accesible.**
  - Tests: si `store.create` rechaza con `{ error: { message: 'Boom' } }`, se renderiza `.alert-error[role=alert]` con "Boom" y el botón "Guardar" vuelve a estar habilitado.
  - Código: añadir `role="alert"` al `alert-error` existente; `aria-busy` en el `<form>` mientras `loading()`.
- [x] 16. **Errores al añadir ingrediente.**
  - Tests: `addIngredient()` sin seleccionar ingrediente no añade nada, muestra "Selecciona un ingrediente" asociado a `#new-ingredient` (`aria-invalid` + `aria-describedby`) y deja el foco en `#new-ingredient`; con cantidad `0` el error se asocia a `#new-ingredient-qty`.
  - Código: signal `ingredientErrors` usando `validateNewIngredient`; mensajes en plantilla; foco al campo erróneo.

### Bloque E — Gestión del foco y anuncios

- [x] 17. **Foco y anuncio al añadir ingrediente.**
  - Tests: tras `addIngredient()` válido, la región `[aria-live=polite]` contiene "Tomate (kg) añadido", el `<select>` se resetea y `document.activeElement` es `#new-ingredient` (para poder seguir añadiendo).
  - Código: signal `liveMessage`; `<div class="visually-hidden" aria-live="polite">{{ liveMessage() }}</div>`; foco de vuelta al select.
- [x] 18. **Foco y anuncio al quitar ingrediente.**
  - Tests: con 2 ingredientes, quitar el primero mueve el foco al botón "Quitar" del siguiente; quitar el último que queda mueve el foco a `#new-ingredient`; la región `aria-live` anuncia "Tomate (kg) eliminado".
  - Código: `viewChildren` de los botones de quitar (o `querySelectorAll`) y lógica de foco tras el render (`afterNextRender` con `injector`).
- [x] 19. **Título de página por ruta.**
  - Tests: (`dishes.routes.spec.ts` o dentro del spec del componente) la ruta `new` tiene `title: 'Nuevo plato · RestTek'` y `:id/edit` tiene `title: 'Editar plato · RestTek'`.
  - Código: añadir `title` en `dishes.routes.ts`.

### Bloque F — Foco visible y contraste (CSS)

- [x] 20. **Foco visible global.** Quitar `outline: none` de `button` en `styles.css`; añadir `:where(a, button, input, select, textarea):focus-visible { outline: 2px solid var(--green-light); outline-offset: 2px; }` y la utilidad `.visually-hidden`. Mantener el `box-shadow` de `.form-control:focus` y añadir outline en `:focus-visible`. Comprobar a mano con Tab que todos los controles del formulario muestran foco.
- [x] 21. **Estilos del formulario.** En `dish-form.component.css`: estilos de `.field-error`, `.error-summary`, `[aria-invalid=true]` (borde rojo), `.chip-remove:focus-visible`, `.back-link:focus-visible`, reset de `ul`/`fieldset`; quitar las clases `fake-*`. Verificar que el orden visual coincide con el DOM (orden de tabulación: volver → nombre → precio → categoría → disponible → descripción → quitar chips → ingrediente → cantidad → añadir → cancelar → guardar).

### Bloque G — E2E con axe y vídeo

- [x] 22. **Auditoría axe del formulario vacío.** En `e2e/dish-form.a11y.spec.ts`: ir a `/restaurants/rest-1/dishes/new`, `new AxeBuilder({ page }).include('form').withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze()` y `expect(results.violations).toEqual([])`. Corregir lo que reporte (típicamente contraste de `--text-muted`/placeholder).
- [x] 23. **Auditoría axe con errores y en edición.** Mismo test tras enviar el formulario vacío (errores visibles) y sobre `/restaurants/rest-1/dishes/<id>/edit` de un plato del seed (obtener el id por API en el test). Corregir violaciones.
- [x] 24. **Recorrido con teclado — parte 1 (datos y errores).** En `e2e/dish-form.keyboard.spec.ts`, con `test.use({ video: 'on', launchOptions: { slowMo: 250 }, viewport: { width: 1280, height: 800 } })` y usando **solo** `page.keyboard` (`Tab`, `Shift+Tab`, `Enter`, `Space`, flechas, `type`): llegar al formulario, escribir nombre, borrarlo de nuevo (dejarlo vacío), poner precio, cambiar categoría y disponible, escribir descripción; ir a "Guardar" y pulsar `Enter`; comprobar que aparece el resumen `role=alert`, que el foco está en `#dish-name` y que `#dish-name` tiene `aria-invalid="true"`. Comprobar en cada paso el elemento enfocado con `expect(page.locator(':focus'))`.
- [x] 25. **Recorrido con teclado — parte 2 (ingredientes y alta).** Continuar el mismo test: intentar añadir ingrediente sin seleccionar (ver error), seleccionar 2 ingredientes con cantidad y añadirlos con `Enter`, quitar uno con el botón "Quitar …" (`Space`), escribir un nombre único (`Plato a11y ${Date.now()}`), enviar con `Enter` y verificar que se navega a `/restaurants/rest-1/dishes` y la fila con ese nombre es visible.
- [x] 26. **Guardar el vídeo en `e2e-videos/`.** Al final del test: `const video = page.video()`, `await page.close()`, `await video?.saveAs('e2e-videos/dish-form-keyboard.webm')` (ruta relativa a `packages/web-admin`). Añadir script `"e2e:video": "playwright test e2e/dish-form.keyboard.spec.ts"`. Ejecutarlo y revisar el vídeo: el foco se ve en todo momento y se aprecian errores, añadir/quitar ingredientes y el plato en la lista.

### Bloque H — Cierre

- [x] 27. **Formato.** Crear `packages/web-admin/.prettierrc` (`{ "semi": false, "singleQuote": true, "printWidth": 120, "overrides": [{ "files": "*.html", "options": { "parser": "angular" } }] }`) y ejecutar `npx prettier --write` **solo** sobre los archivos creados/modificados en este plan. (No hay ESLint configurado en el repo: no aplica.)
- [x] 28. **Verificación final.** `npm test -w @resttek/web-admin` (todos en verde), `npm run e2e -w @resttek/web-admin` (axe sin violaciones + recorrido OK), `ng build` en `packages/web-admin` sin errores, y prueba manual rápida con lector de pantalla (VoiceOver) del formulario. _(Automático verificado; la prueba manual con VoiceOver queda pendiente de hacer por una persona.)_
- [x] 29. **Documentación.** Actualizar `packages/web-admin/README.md` con los comandos de test, los requisitos del e2e (`npm run seed`, API levantada o arrancada por `webServer`) y la ubicación del vídeo.

## Criterios de aceptación

- [ ] El formulario de crear y editar plato se puede completar y enviar **solo con teclado** (Tab/Shift+Tab, Enter, Espacio, flechas), incluido añadir y quitar ingredientes.
- [ ] El orden de tabulación sigue el orden visual: volver → nombre → precio → categoría → disponible → descripción → quitar ingredientes → ingrediente → cantidad → añadir → cancelar → guardar.
- [ ] Todo elemento enfocable muestra un indicador de foco visible con contraste ≥ 3:1 (WCAG 2.4.7 y 2.4.11) y no queda tapado por otros elementos.
- [ ] No hay elementos interactivos que sean `<div>`/`<span>`: todos son `<button>`, `<a>` o controles de formulario nativos, y todos tienen nombre accesible.
- [ ] Cada campo tiene un `<label>` asociado; los obligatorios se indican visualmente y con `required`/`aria-required`.
- [ ] Al enviar con errores: no se llama a la API, aparece un resumen con `role="alert"`, cada campo erróneo tiene `aria-invalid="true"` y su mensaje enlazado por `aria-describedby`, y el foco va al primer campo inválido.
- [ ] Al añadir/quitar un ingrediente se anuncia el cambio en una región `aria-live` y el foco nunca se pierde (no vuelve a `<body>`).
- [ ] La pestaña del navegador muestra "Nuevo plato · RestTek" / "Editar plato · RestTek".
- [ ] `@axe-core/playwright` no reporta violaciones WCAG 2.2 A/AA en el formulario vacío, con errores y en edición.
- [ ] `npm test -w @resttek/web-admin` ejecuta los tests unitarios con Vitest y pasan todos.
- [ ] `npm run e2e -w @resttek/web-admin` ejecuta los e2e con Playwright y pasan todos.
- [ ] Existe `packages/web-admin/e2e-videos/dish-form-keyboard.webm` donde se ve, solo con teclado: modificación de datos, añadir y quitar ingredientes, envío incompleto con errores visibles y alta correcta con el plato visible en la lista.
- [ ] `ng build` de `web-admin` compila sin errores ni nuevos warnings.

## Dudas y decisiones tomadas

### Dudas
- **Ubicación de `e2e-videos`:** se ha planificado `packages/web-admin/e2e-videos/` (junto a la config de Playwright). ¿Lo prefieres en la raíz del monorepo (`e2e-videos/`)?
- **¿Versionar el vídeo?** Se plantea **no** ignorarlo en `.gitignore` porque se pide "guardarlo en el proyecto". Si pesa demasiado, ¿preferís ignorarlo y adjuntarlo a la PR?
- **Issue #3 (página en blanco al entrar directamente en `/restaurants/rest-2/dishes`):** si sigue sin arreglar, entrar con `page.goto` a `/restaurants/rest-1/dishes/new` puede quedarse en blanco. Alternativa: empezar el recorrido en `/dashboard` y navegar con teclado por la sidebar hasta "Platos" → "Nuevo plato" (esto alarga el vídeo y obliga a que la sidebar sea operable con teclado, que ya usa `<button>`/`<a>`). ¿Se arregla antes la #3 o se usa esta alternativa?
- **Issue #4 (seed no borra datos):** cada ejecución del e2e crea un plato nuevo en `resttek.db`. Se usa un nombre único con timestamp para no depender del estado. ¿Se quiere además borrar el plato al terminar (vía API en `afterAll`)?
- **Selects con teclado en Chromium headless de macOS:** las flechas pueden abrir el desplegable nativo en vez de cambiar el valor. Si ocurre, se seleccionará tecleando las primeras letras de la opción con el `<select>` enfocado (sigue siendo solo teclado). ¿Es aceptable?

### Decisiones tomadas
- Tests unitarios con el builder oficial `@angular/build:unit-test` (runner `vitest`, entorno `jsdom`) en lugar de configurar Vitest a mano — *Motivo:* es el soporte nativo de Angular 21 (`@angular/build` 21.2.6 ya incluye el builder) y respeta el modo zoneless.
- Los ficheros de test de Angular se llaman `*.spec.ts` (no `*.test.ts` como en la API) — *Motivo:* `tsconfig.spec.json` de `web-admin` ya incluye `src/**/*.spec.ts` y es la convención de Angular CLI.
- Los nombres de funciones del frontend siguen en camelCase (`validateDishForm`) y no en snake_case — *Motivo:* todo el código existente de `web-admin` (y la API en TS) usa camelCase; la convención snake_case de la skill no encaja con este repo.
- La validación se extrae a una función pura `dish-form.validation.ts` junto al componente — *Motivo:* permite TDD rápido sin TestBed y no existe carpeta `utils/` en las features de `web-admin` (estructura `models/ pages/ services/ store/`).
- Se mantiene la API de formularios basada en `ngModel` (template-driven) y no se migra a Reactive/Signal Forms — *Motivo:* limitar el alcance a accesibilidad; el resto de formularios de `web-admin` usa el mismo enfoque.
- axe se usa solo en e2e (`@axe-core/playwright`), no en los unitarios — *Motivo:* jsdom no calcula estilos ni contraste, así que axe en unitarios daría falsa seguridad; los unitarios comprueban roles/atributos ARIA concretos.
- Login del e2e por API + `localStorage` (no rellenando el login con teclado) — *Motivo:* el criterio de accesibilidad es sobre el formulario de platos; así el vídeo se centra en él y es más corto. El login de `web-shared` queda fuera de alcance.
- El vídeo se graba con `slowMo: 250` y viewport 1280×800 — *Motivo:* que el recorrido sea legible al reproducirlo.
- Se añade `.prettierrc` con `semi: false` y solo se formatean los archivos tocados — *Motivo:* el código de `web-admin` no usa punto y coma; con la config por defecto Prettier reformatearía todo el paquete. ESLint no está configurado en el repo, así que no hay tarea de lint.
- Se modifica `styles.css` global (quitar `outline: none` de `button`) — *Motivo:* sin ese cambio no hay foco visible posible en ningún botón; afecta positivamente a todo `web-admin`, no al resto de apps.
