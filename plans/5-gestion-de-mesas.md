# 5 - Gestión de mesas

- **Tipo:** feature
- **Issue:** #5

## Objetivo

Introducir el concepto de **mesa** en Resttek para que:

- El **cliente**, al elegir restaurante, indique el número de comensales, vea solo las mesas libres con capacidad suficiente, elija una y, al pulsar "Continuar", la mesa pase a `ocupada` y llegue a la carta; el pedido que envíe a cocina/barra quedará asociado a esa mesa (`orders.table_id`, que hoy siempre es `null`).
- El **administrador** gestione (CRUD) las mesas de cada restaurante: `id`, `number`, `description`, `capacity` y `status` (`libre`, `ocupada`, `reservada`).
- Los **empleados** vean el estado de las mesas, lo cambien y consulten el estado de los pedidos de las mesas ocupadas.

## Alcance

**Incluye:**
- API (estilo **por capas**, igual que `ingredient`): modelo, repositorio SQLite, servicio, controlador y rutas de `tables` bajo `/api/v1/restaurants/:restaurantId/tables`, con migración en `runInitialMigrations()` y datos de ejemplo en el seed.
- Endpoint para listar mesas disponibles por número de comensales y endpoint de ocupación atómica (evita que dos clientes ocupen la misma mesa).
- Endpoint de cambio de estado para empleados.
- `web-admin`: feature `tables` (listado, alta, edición y borrado) enlazada desde el menú lateral y el dashboard del restaurante.
- `web-clientes`: nueva pantalla de selección de comensales y mesa entre el listado de restaurantes y la carta; el carrito envía el `tableId` al crear el pedido.
- `web-empleados`: nueva página "Mesas" con el estado de cada mesa, cambio de estado y pedidos activos de las mesas ocupadas.
- Tests Vitest de modelo, servicio y repositorio de mesas.
- Actualización de `docs/dominio/modelo-datos.md` y `docs/dominio/glosario.md`.

**No incluye:**
- Reservas con fecha/hora (el estado `reservada` solo se asigna manualmente por admin/empleados).
- Liberación automática de la mesa al entregar o pagar el pedido (la liberan los empleados a mano).
- Unir mesas o asignar varias mesas a un grupo grande.
- Actualizaciones en tiempo real (se reutiliza el *polling* de 30 s existente en `web-empleados`).
- Validar en `OrderService.create` que el `tableId` pertenezca al restaurante y esté ocupada.
- Plano visual del salón.

## Archivos afectados

| Archivo | Acción | Motivo |
| --- | --- | --- |
| `packages/api/src/config/database.ts` | modificar | Añadir `CREATE TABLE IF NOT EXISTS tables` (con `UNIQUE(restaurant_id, number)` y FK a `restaurants`). |
| `packages/api/src/models/table.model.ts` | crear | Interface `Table`, `VALID_TABLE_STATUSES`, `TableStatusType` y `normalizeTableStatus()`. |
| `packages/api/src/models/table.model.test.ts` | crear | Tests de `normalizeTableStatus()`. |
| `packages/api/src/errors/DomainErrors.ts` | modificar | `TableNotFoundError`, `InvalidTableStatusError`, `InvalidTableNumberError`, `InvalidTableCapacityError`, `DuplicatedTableNumberError`, `TableNotAvailableError`, `TableOccupiedError`, `InvalidPeopleCountError`. |
| `packages/api/src/contexts/shared/infrastructure/http/errorHandler.ts` | modificar | Mapear `TableNotFoundError` a 404 y los errores de conflicto (`DuplicatedTableNumberError`, `TableNotAvailableError`, `TableOccupiedError`) a 409. |
| `packages/api/src/repositories/table.repository.ts` | crear | Interface `TableRepository` + `SqliteTableRepository` (findById, findByRestaurant, findAvailable, save, delete, updateStatus, occupyIfAvailable). |
| `packages/api/src/repositories/table.repository.test.ts` | crear | Test de integración con SQLite `:memory:`. |
| `packages/api/src/repositories/mocks/MockTableRepository.ts` | crear | Mock en memoria para los tests del servicio. |
| `packages/api/src/services/table.service.ts` | crear | Validación y reglas de negocio (CRUD, disponibles, ocupar, cambiar estado). |
| `packages/api/src/services/table.service.test.ts` | crear | Tests unitarios del servicio. |
| `packages/api/src/controllers/table.controller.ts` | crear | Handlers con `next(error)` y `toJSON()` en camelCase, como `IngredientController`. |
| `packages/api/src/routes/table.routes.ts` | crear | Rutas con `mergeParams`, `authenticate` y `authorize` por rol. |
| `packages/api/src/app.ts` | modificar | Montar `/api/v1/restaurants/:restaurantId/tables`. |
| `packages/api/src/scripts/seed.ts` | modificar | Insertar mesas de ejemplo en `rest-1` y `rest-2` (`INSERT OR IGNORE`). |
| `packages/web-admin/src/app/features/tables/models/table.model.ts` | crear | `Table`, `TableStatus`, `CreateTableDto`, `UpdateTableDto`. |
| `packages/web-admin/src/app/features/tables/services/table.service.ts` | crear | Llamadas HTTP CRUD. |
| `packages/web-admin/src/app/features/tables/store/table.store.ts` | crear | Store con signals + `firstValueFrom`, como `IngredientStore`. |
| `packages/web-admin/src/app/features/tables/pages/table-list/table-list.component.{ts,html,css}` | crear | Listado con estado, editar y borrar. |
| `packages/web-admin/src/app/features/tables/pages/table-form/table-form.component.{ts,html,css}` | crear | Formulario de alta/edición. |
| `packages/web-admin/src/app/features/tables/tables.routes.ts` | crear | `TABLE_ROUTES` (`''`, `new`, `:id/edit`). |
| `packages/web-admin/src/app/app.routes.ts` | modificar | Ruta hija `restaurants/:restaurantId/tables`. |
| `packages/web-admin/src/app/core/layout/shell.component.html` | modificar | Enlace "Mesas" en el submenú del restaurante. |
| `packages/web-admin/src/app/features/restaurants/pages/restaurant-dashboard/restaurant-dashboard.component.html` | modificar | Tarjeta "Mesas" en el dashboard. |
| `packages/web-clientes/src/app/core/models/table.model.ts` | crear | Interface `Table`. |
| `packages/web-clientes/src/app/core/services/table.service.ts` | crear | `getAvailable(restaurantId, people)` y `occupy(restaurantId, tableId, people)` devolviendo `Observable`. |
| `packages/web-clientes/src/app/core/store/cart.store.ts` | modificar | Guardar la mesa seleccionada (`tableId`, `tableNumber`) y limpiarla en `clear()` / al cambiar de restaurante. |
| `packages/web-clientes/src/app/features/tables/table-selection.component.ts` | crear | Pantalla: nº de personas → mesas disponibles → "Continuar". |
| `packages/web-clientes/src/app/app.routes.ts` | modificar | Ruta `restaurants/:id/table`. |
| `packages/web-clientes/src/app/features/restaurants/restaurant-list.component.ts` | modificar | La tarjeta navega a `/restaurants/:id/table` en vez de a la carta. |
| `packages/web-clientes/src/app/features/menu/restaurant-menu.component.ts` | modificar | Si no hay mesa seleccionada para ese restaurante, redirigir a la selección; mostrar "Mesa N". |
| `packages/web-clientes/src/app/core/services/order.service.ts` | modificar | `createOrder` recibe y envía `tableId` (hoy fijo a `null`). |
| `packages/web-clientes/src/app/features/cart/cart.component.ts` | modificar | Pasar `cartStore.tableId()` a `createOrder`. |
| `packages/web-empleados/src/app/features/tables/models/table.model.ts` | crear | `Table`, `TableStatus`. |
| `packages/web-empleados/src/app/features/tables/services/table.service.ts` | crear | `getAll(restaurantId)` y `updateStatus(...)`. |
| `packages/web-empleados/src/app/features/tables/store/table.store.ts` | crear | Store con signals, carga y cambio de estado. |
| `packages/web-empleados/src/app/features/tables/pages/mesas/mesas.component.{ts,html,css}` | crear | Tarjetas de mesas, selector de estado y pedidos activos de las ocupadas (vía `OrderStore`). |
| `packages/web-empleados/src/app/app.routes.ts` | modificar | Ruta `mesas`. |
| `packages/web-empleados/src/app/core/layout/shell.component.html` | modificar | Enlace "Mesas" en la navegación. |
| `docs/dominio/modelo-datos.md` | modificar | Tabla `tables`, diagrama ER y relaciones (`orders.table_id` → `tables.id`). |
| `docs/dominio/glosario.md` | modificar | Término "Mesa (Table)" y sección "Estados de Mesa". |

## Tareas

Cada tarea debe poder hacerse en 5-10 minutos.

### API

- [x] 1. Añadir en `database.ts` la tabla `tables` (`id TEXT PK`, `restaurant_id TEXT NOT NULL FK`, `number INTEGER NOT NULL`, `description TEXT`, `capacity INTEGER NOT NULL`, `status TEXT NOT NULL DEFAULT 'libre'`, `created_at`, `updated_at`, `UNIQUE(restaurant_id, number)`).
- [x] 2. Añadir a `DomainErrors.ts` los errores de mesa listados en "Archivos afectados" y mapearlos en `errorHandler.ts` (404 para `TableNotFoundError`, 409 para los de conflicto).
- [x] 3. Test (rojo) de `normalizeTableStatus()`: acepta `libre`/`ocupada`/`reservada` con mayúsculas y espacios, y lanza `InvalidTableStatusError` con otro valor.
- [x] 4. Crear `table.model.ts` (interface `Table` + `normalizeTableStatus()`) hasta poner el test en verde.
- [x] 5. Crear `table.repository.ts` con la interface `TableRepository` y `SqliteTableRepository`: `findById`, `findByRestaurant` (ordenado por `number`), `save` (insert/update como `SqliteRestaurantRepository`) y `delete`.
- [x] 6. Añadir al repositorio `findAvailable(restaurantId, people)` (`status = 'libre' AND capacity >= ?`, ordenado por `capacity, number`), `updateStatus(id, status)` y `occupyIfAvailable(id, restaurantId, people)` con un único `UPDATE ... WHERE id = ? AND restaurant_id = ? AND status = 'libre' AND capacity >= ?` que devuelva si `changes === 1`.
- [x] 7. Test de integración `table.repository.test.ts` (SQLite `:memory:`): guardar/buscar, filtro de disponibles, ocupación correcta y segunda ocupación que devuelve `false`, y número duplicado en el mismo restaurante rechazado.
- [x] 8. Crear `MockTableRepository` en `repositories/mocks/`.
- [x] 9. Tests (rojo) de `TableService.create`/`update`: número entero ≥ 1, capacidad entera ≥ 1, descripción con trim (o `null`), estado por defecto `libre`, número duplicado → `DuplicatedTableNumberError`.
- [x] 10. Implementar `TableService.create`, `update`, `findByRestaurant` y `findById` (lanza `TableNotFoundError` si no existe o es de otro restaurante) hasta verde.
- [x] 11. Tests (rojo) + implementación de `TableService.delete`: borra la mesa; si está `ocupada` lanza `TableOccupiedError`.
- [x] 12. Tests (rojo) + implementación de `findAvailable(restaurantId, people)`: `people` entero ≥ 1 o `InvalidPeopleCountError`.
- [x] 13. Tests (rojo) + implementación de `occupy(restaurantId, tableId, people)` (lanza `TableNotAvailableError` si `occupyIfAvailable` devuelve `false`) y `updateStatus(restaurantId, tableId, status)` usando `normalizeTableStatus()`.
- [x] 14. Crear `TableController` (arrow functions, `next(error)`, `toJSON()` en camelCase) con `create`, `getAll`, `getById`, `update`, `delete`, `getAvailable` (query `people`), `occupy` (body `people`) y `updateStatus` (body `status`).
- [x] 15. Crear `table.routes.ts` (`Router({ mergeParams: true })`): `GET /available` y `POST /:id/occupy` → todos los roles autenticados; `GET /` y `GET /:id` → admin, manager, camarero, cocinero; `PATCH /:id/status` → admin, manager, camarero (sin cocinero, ver "Dudas resueltas"); `POST /`, `PUT /:id`, `DELETE /:id` → admin. Declarar `/available` antes de `/:id`.
- [x] 16. Montar las rutas en `app.ts` y comprobar a mano con `npm run dev:api` + `curl` (crear, listar disponibles, ocupar dos veces → 409).
- [x] 17. Añadir al `seed.ts` mesas de ejemplo (p. ej. 6 en `rest-1` y 4 en `rest-2`, capacidades 2/4/6, ids fijos para que `INSERT OR IGNORE` sea idempotente) y ejecutar `npm run seed`.
- [x] 18. Ejecutar `npm test` y dejar toda la suite en verde.

### web-admin

- [x] 19. Crear `features/tables/models/table.model.ts` y `services/table.service.ts` (URL `restaurants/:restaurantId/tables`, igual que `IngredientService`).
- [x] 20. Crear `store/table.store.ts` (signals privadas en solo lectura, `loadByRestaurant`, `create`, `update`, `delete`, protección frente a respuestas de otro restaurante como en `IngredientStore`).
- [x] 21. Crear `pages/table-list` (tabla con número, descripción, capacidad y estado en badge; botones editar/borrar con confirmación; mensaje de error si la API responde 409 al borrar una ocupada).
- [x] 22. Crear `pages/table-form` (formulario reactivo: número y capacidad requeridos ≥ 1, descripción opcional, estado con selector; modo alta/edición según `:id`; mostrar el error de número duplicado).
- [x] 23. Crear `tables.routes.ts`, añadir la ruta hija en `app.routes.ts` y los enlaces "Mesas" en `shell.component.html` y `restaurant-dashboard.component.html`.
- [x] 24. `ng build` en `packages/web-admin` sin errores y prueba manual del CRUD con `admin@resttek.com`.

### web-clientes

- [x] 25. Crear `core/models/table.model.ts` y `core/services/table.service.ts` (`getAvailable` y `occupy` devolviendo `Observable`).
- [x] 26. Ampliar `CartStore` con `_tableId`/`_tableNumber` (expuestas en solo lectura), `selectTable(restaurantId, table)` y limpieza en `clear()` y al cambiar de restaurante.
- [x] 27. Crear `features/tables/table-selection.component.ts`: input de nº de personas (≥ 1) → botón "Ver mesas" → lista de mesas disponibles seleccionables (estado vacío si no hay) → botón "Continuar" deshabilitado hasta elegir.
- [x] 28. Al pulsar "Continuar": llamar a `occupy`; si va bien, `selectTable` y navegar a `/restaurants/:id`; si responde 409, mostrar "La mesa ya no está disponible" y recargar la lista.
- [x] 29. Añadir la ruta `restaurants/:id/table` y cambiar el enlace de `restaurant-list.component.ts` a esa ruta.
- [x] 30. En `restaurant-menu.component.ts`, redirigir a la selección si no hay mesa para ese restaurante y mostrar "Mesa N" en la cabecera.
- [x] 31. Pasar `tableId` en `OrderService.createOrder` y en `CartComponent.confirmOrder`.
- [x] 32. `ng build` en `packages/web-clientes` y prueba manual del flujo completo con `cliente1@resttek.com` (el pedido creado tiene `tableId`).

### web-empleados

- [x] 33. Crear `features/tables/models/table.model.ts`, `services/table.service.ts` y `store/table.store.ts` (carga por restaurante del usuario y `updateStatus` con actualización optimista del signal).
- [x] 34. Crear `pages/mesas/mesas.component` con tarjetas por mesa (número, capacidad, estado en badge) y un selector para cambiar el estado.
- [x] 35. En las mesas ocupadas, mostrar los pedidos activos de `OrderStore.orders()` filtrados por `tableId`, con el estado de cada ítem; arrancar/parar el polling de pedidos y recargar mesas en el mismo intervalo.
- [x] 36. Añadir la ruta `mesas` en `app.routes.ts` y el enlace en `shell.component.html`.
- [x] 37. `ng build` en `packages/web-empleados` y prueba manual con `camarero1@resttek.com` (ver la mesa ocupada por el cliente, su pedido, y liberarla).

### Documentación

- [x] 38. Actualizar `docs/dominio/modelo-datos.md` (tabla `tables`, diagrama ER, relación con `orders`) y `docs/dominio/glosario.md` (Mesa y Estados de Mesa).

## Criterios de aceptación

- [x] Un admin puede crear, listar, editar y borrar mesas de un restaurante desde `web-admin`; no se permiten dos mesas con el mismo número en el mismo restaurante (409) ni capacidad/número < 1 (400).
- [x] `GET /api/v1/restaurants/:restaurantId/tables/available?people=N` devuelve solo mesas `libre` con `capacity >= N` de ese restaurante. (además, según la decisión del contrato, las `reservada` para el propio cliente, marcadas con `reservedForMe`)
- [x] `POST /api/v1/restaurants/:restaurantId/tables/:id/occupy` pone la mesa en `ocupada`; una segunda llamada sobre la misma mesa (o con más personas que su capacidad) responde 409 y no cambia nada.
- [x] En `web-clientes`, al elegir un restaurante se pide el nº de personas, se muestran las mesas disponibles y, tras elegir una y pulsar "Continuar", la mesa queda `ocupada` y se muestra la carta.
- [x] No se puede acceder a la carta de un restaurante sin haber seleccionado mesa en él (redirige a la selección).
- [x] El pedido enviado desde el carrito se guarda con el `tableId` de la mesa elegida.
- [x] En `web-empleados`, la página "Mesas" muestra todas las mesas del restaurante del empleado con su estado, permite cambiarlo y, en las ocupadas, muestra los pedidos activos con el estado de sus ítems.
- [x] Solo admin puede crear/editar/borrar mesas; un cliente no puede listar todas las mesas ni cambiar su estado (403).
- [x] No se puede borrar una mesa `ocupada` (409).
- [x] `npm test` pasa en verde con los nuevos tests de modelo, servicio y repositorio, y `ng build` compila las tres apps.
- [x] `npm run seed` crea mesas de ejemplo y puede ejecutarse varias veces sin duplicarlas.

## Dudas y decisiones tomadas

### Dudas
- ¿Quién y cuándo libera la mesa? El plan lo deja en manos de los empleados (cambio manual a `libre`). ¿Debería liberarse sola cuando todos los ítems estén `entregado` o al pagar?
- ¿Las mesas `reservada` deben poder elegirse por el cliente en algún caso (p. ej. si la reserva es suya)? Ahora mismo no se muestran como disponibles.
- ¿Qué roles de empleado pueden cambiar el estado de las mesas? Se ha incluido también a `cocinero`; ¿debería limitarse a admin, manager y camarero?
- ¿Qué pasa si el cliente abandona la app tras ocupar la mesa sin pedir? La mesa queda ocupada hasta que un empleado la libere.
- No existe `docs/api/openapi.yml` en el repositorio, por lo que no se puede aplicar la skill `actualizar-docs-api`. ¿Se quiere crear esa documentación como parte de esta issue o en otra?

### Decisiones tomadas
- Dominio `table` implementado con el estilo **por capas** (models/repositories/services/controllers/routes) — *Motivo:* es el estilo de `restaurant`, `dish`, `ingredient` y `order`; el hexagonal solo se usa en `employee`.
- Rutas anidadas en `/api/v1/restaurants/:restaurantId/tables` — *Motivo:* mismo patrón que ingredientes, platos y empleados del restaurante.
- Nombres en inglés en código y SQL (`tables`, `number`, `capacity`, `status`) con valores de estado en español (`libre`, `ocupada`, `reservada`) — *Motivo:* coherente con `orders`/`order_items` y con los estados de pedido (`pendiente`, `preparando`…).
- Ocupación con un `UPDATE` condicional atómico y respuesta 409 si no se aplica — *Motivo:* evitar que dos clientes ocupen la misma mesa a la vez sin necesidad de transacciones explícitas.
- Nueva tabla con `CREATE TABLE IF NOT EXISTS` — *Motivo:* al ser una tabla nueva (no una columna), funciona sobre bases de datos existentes sin borrar `resttek.db`.
- No se añade FK de `orders.table_id` a `tables.id` — *Motivo:* la tabla `orders` ya existe y `CREATE TABLE IF NOT EXISTS` no la alteraría; además hay pedidos sin mesa.
- La mesa seleccionada por el cliente se guarda solo en memoria (`CartStore`) — *Motivo:* sigue el comportamiento actual del carrito; al recargar se vuelve a pedir la mesa.
- No se añaden tests de rutas HTTP con supertest ni tests de componentes Angular — *Motivo:* no existen tests de rutas en la API y solo hay specs en `dishes` de `web-admin`; se prioriza cubrir modelo, servicio y repositorio. Se puede ampliar si se desea.
- No hay tareas de prettier/eslint — *Motivo:* el repositorio no tiene scripts de lint ni formato configurados.
- Los empleados ven los pedidos de las mesas reutilizando `GET /api/v1/orders/active` y filtrando por `tableId` en el frontend — *Motivo:* evita un endpoint nuevo; el `OrderStore` ya hace polling cada 30 s.


### Dudas resueltas (comentario de la issue, 2026-11-12)
- La liberación de la mesa la hacen los empleados a mano (cambio de estado); si el cliente abandona sin pedir, la mesa queda ocupada hasta que un empleado la libere.
- El cliente no puede elegir una mesa `reservada` salvo que la reserva sea suya.
- Solo **admin, manager y camarero** pueden cambiar el estado de las mesas (se excluye a `cocinero`).
- Se crea `docs/api/openapi.yml` en esta issue, solo con el contrato de mesas, consensuado por los 4 agentes (API, web-admin, web-clientes, web-empleados) antes de implementar.

### Contrato de la API (consensuado antes de implementar)
- [x] 0. Contrato `docs/api/openapi.yml` (OpenAPI 3.1, validado con Redocly) redactado por el agente de API y validado por los agentes de web-admin, web-clientes y web-empleados. Cambios respecto al plan original:
  - `POST /` acepta `status` opcional (por defecto `libre`) y `PUT /{id}` es reemplazo completo de `number`, `capacity`, `description` y `status` (si se omite, se conserva).
  - Columna nullable `reserved_for` (`reservedFor`, id de usuario cliente): solo se fija con `PATCH /{id}/status` con `status: 'reservada'`; se pone a `null` en cualquier cambio de estado. `reservedFor` con otro estado → 400 `InvalidReservedForError`. La API no valida que el usuario exista.
  - `GET /available` devuelve mesas `libre` y `reservada` para el propio usuario; `occupy` acepta ambas en un único `UPDATE` atómico. Ambos responden con `ClientTable` (sin `reservedFor`, con `reservedForMe: boolean`).
  - El schema `Error` tiene `message` opcional (los 401/403 de `authenticate`/`authorize` solo llevan `error`).
  - web-empleados y web-admin no asignan titular a las reservas (no hay buscador de clientes): reservas anónimas desde las UIs.
