# Auditoría de seguridad de la API (OWASP Top 10:2021)

- Alcance: `packages/api` (Express 5 + TypeScript + SQLite), ambos estilos (hexagonal en `contexts/employee` + `contexts/shared`, y por capas en `restaurant`, `dish`, `ingredient`, `order`), `package.json` y script de seed.
- Método: revisión estática de todo el código fuente (sin tests) y `npm audit`. Solo lectura; no se ha modificado código.
- Fecha: 2026-11-12.
- Convención: las rutas de los ficheros son relativas a la raíz del repo; `api/` = `packages/api/src/`.
- Los hallazgos marcados como **Posible** dependen de supuestos de despliegue o de código fuera de la API (por ejemplo, el frontend).

---

## 1. Resumen ejecutivo

| Severidad | Nº de hallazgos |
|-----------|----------------:|
| Crítica   | 1 |
| Alta      | 8 |
| Media     | 8 |
| Baja      | 12 |
| Info      | 7 |
| **Total** | **36** |

Los 3 más graves:

1. **OWASP-A02-01 (Crítica)**: el secreto JWT tiene un valor por defecto público y hardcodeado (`'super-secret-resttek-key'`) y la API nunca carga `.env`, así que cualquiera puede forjar un token de `admin`.
2. **OWASP-A01-01..04 (Alta)**: el control de acceso por recurso es casi inexistente. Cualquier usuario autenticado, incluido un cliente recién registrado, puede leer pedidos ajenos, cambiar el estado de cualquier plato de cualquier pedido y listar los pedidos activos de cualquier restaurante. Un manager puede crear, editar y borrar platos de otro restaurante.
3. **OWASP-A07-01 y A07-06 (Alta)**: el login y el registro no tienen límite de intentos, y el seed crea usuarios (incluido `admin`) cuya contraseña es su propio email.

Observaciones positivas verificadas:

- Todas las consultas SQL usan parámetros `?`, así que no hay inyección SQL.
- El registro público fuerza `role: 'cliente'`, por lo que no hay escalada de rol por registro.
- Los controladores usan una lista blanca de campos, así que no hay mass assignment.
- El login devuelve un error genérico (`InvalidCredentialsError`).
- El `errorHandler` global no filtra stack traces.
- Los hashes se guardan con bcrypt y no se devuelven en ninguna respuesta.
- No hay llamadas HTTP salientes, ni `eval` ni `child_process`.

---

## 2. Hallazgos por categoría

### A01:2021 – Broken Access Control

Contexto: `authenticate` y `authorize` (`api/contexts/shared/infrastructure/http/middlewares.ts:10-41`) solo comprueban el rol. En ninguna ruta se compara `req.user.restaurantId` ni `req.user.id` con el recurso solicitado. El JWT sí lleva `id`, `role` y `restaurantId` (`LoginUseCase.ts:40-44`), pero nunca se usan para autorizar por recurso. Los empleados (`/employees`, `/restaurants/:id/employees`) son solo `admin` y están bien protegidos.

#### OWASP-A01-01 – IDOR en `GET /api/v1/orders/:id`
- Severidad: **Alta**
- Ubicación: `api/routes/order.routes.ts:17`, `api/controllers/order.controller.ts:57-68`, `api/services/order.service.ts:57-63`
- Descripción: la ruta solo exige `authenticate`. El servicio devuelve el pedido por id sin comprobar que `order.clientId === user.id` ni que el empleado pertenezca a `order.restaurantId`. La respuesta incluye `clientId`, `tableId`, notas, platos, precios, nombre y logo del restaurante.
```ts
router.get('/:id', authenticate, orderController.getById.bind(orderController))
...
const order = await this.orderService.getById(req.params.id as string)
res.status(200).json(order)
```
- Escenario: `cliente2@resttek.com` (o cualquiera que se registre en `/auth/register`) hace `GET /api/v1/orders/<id>` con el id de un pedido de `cliente1`. Obtiene el pedido completo, incluido el `clientId` de la víctima y las notas, que pueden contener alergias u otros datos personales. Los ids son UUID, pero las listas de `GET /orders/active` (A01-03) los exponen.
- Recomendación: pasar `req.user` al servicio y exigir una de estas condiciones: `order.clientId === user.id`, o (rol de staff y `order.restaurantId === user.restaurantId`), o `admin`. Devolver 404 en caso contrario para no revelar existencia.

#### OWASP-A01-02 – Cualquier usuario autenticado puede cambiar el estado de cualquier plato de cualquier pedido
- Severidad: **Alta**
- Ubicación: `api/routes/order.routes.ts:18`, `api/services/order.service.ts:69-84`, `api/controllers/order.controller.ts:70-85`
- Descripción: `PATCH /orders/:orderId/items/:itemId/status` no usa `authorize`. Un cliente puede marcar como `entregado` cualquier item, de cualquier restaurante. La operación está pensada para cocineros y camareros.
```ts
router.patch('/:orderId/items/:itemId/status', authenticate, orderController.updateItemStatus.bind(orderController))
```
- Escenario: un cliente malicioso hace `PATCH /orders/<id>/items/<itemId>/status {"status":"entregado"}` sobre los pedidos de un competidor. Estos desaparecen de `GET /orders/active` y la cocina nunca los prepara. Es sabotaje, y el pedido se pierde sin dejar rastro.
- Recomendación: `authorize(['admin','manager','camarero','cocinero'])` y verificar que `order.restaurantId === user.restaurantId` (salvo `admin`). Considerar además una máquina de estados (solo transiciones válidas y por rol).

#### OWASP-A01-03 – `GET /orders/active` permite listar pedidos activos de cualquier restaurante
- Severidad: **Alta**
- Ubicación: `api/routes/order.routes.ts:15`, `api/controllers/order.controller.ts:28-41`
- Descripción: el `restaurantId` viene de la query string y solo se exige autenticación, sin comprobar rol ni pertenencia.
```ts
const { restaurantId } = req.query
...
const orders = await this.orderService.listActive(restaurantId)
```
- Escenario: un cliente consulta `/orders/active?restaurantId=rest-1` y obtiene todos los pedidos en curso de ese restaurante: `clientId`, mesas, notas y volumen de negocio. Sirve para reconocimiento y para obtener ids para A01-01 y A01-02.
- Recomendación: restringir a roles de staff. Para no-admin, ignorar el parámetro y usar `user.restaurantId` del token (o rechazar con 403 si difiere).

#### OWASP-A01-04 – Un manager (o staff) puede operar sobre platos de otro restaurante
- Severidad: **Alta**
- Ubicación: `api/routes/dish.routes.ts:14-18`, `api/controllers/dish.controller.ts:11-19, 28, 37, 49, 65`, `api/services/dish.service.ts:48-78`
- Descripción: `authorize(['admin','manager'])` solo valida el rol. El `restaurantId` viene de la URL y nunca se contrasta con `user.restaurantId`. Además, `GET/PUT/DELETE /:id` buscan el plato solo por `id` y no verifican que pertenezca al `:restaurantId` de la URL.
```ts
router.post('/', authenticate, authorize(['admin', 'manager']), dishController.create)
router.put('/:id', authenticate, authorize(['admin', 'manager']), dishController.update)
router.delete('/:id', authenticate, authorize(['admin', 'manager']), dishController.delete)
```
- Escenario: `gerente2@resttek.com` (manager de `rest-2`) llama a `DELETE /api/v1/restaurants/rest-2/dishes/<id-de-plato-de-rest-1>`. Basta con que el id sea de otro restaurante, porque la URL ya no importa. También puede hacer `POST /restaurants/rest-1/dishes` para inyectar platos o precios falsos, o `PUT` para cambiar precios y disponibilidad. Los ids se obtienen de `/public/restaurants/:id/dishes`, que es público.
- Recomendación: middleware `authorizeRestaurant` que exija `user.role === 'admin' || user.restaurantId === req.params.restaurantId`. En servicios, buscar siempre por `(id, restaurantId)`.

#### OWASP-A01-05 – Lectura de ingredientes y platos internos de otros restaurantes
- Severidad: **Media**
- Ubicación: `api/routes/ingredient.routes.ts:15-16`, `api/routes/dish.routes.ts:15-16`
- Descripción: las rutas `GET` autorizan roles (manager, cocinero, camarero) pero no la pertenencia al restaurante. Stock y composición de platos (incluidos los no disponibles, que la ruta pública oculta) son visibles para el staff de cualquier restaurante.
- Escenario: `cocinero2@resttek.com` (rest-2) lista `/restaurants/rest-1/ingredients` y consulta el stock y las recetas de la competencia.
- Recomendación: el mismo middleware de pertenencia de A01-04.

#### OWASP-A01-06 – La API pública expone datos personales del propietario
- Severidad: **Baja**
- Ubicación: `api/routes/restaurant.public.routes.ts:13-14`, `api/controllers/restaurant.controller.ts:80-92`
- Descripción: `GET /public/restaurants` (sin autenticación) devuelve `email`, `phone`, `ownerFirstName` y `ownerLastName` mediante el mismo `toJSON` que usa el área privada.
- Escenario: un scraper recopila los datos personales de todos los propietarios sin autenticarse.
- Recomendación: un DTO público con solo `id`, `name`, `address` y `logoUrl`.

---

### A02:2021 – Cryptographic Failures

#### OWASP-A02-01 – Secreto JWT hardcodeado por defecto y duplicado
- Severidad: **Crítica**
- Ubicación: `api/contexts/shared/infrastructure/http/middlewares.ts:4`, `api/contexts/employee/infrastructure/BcryptAuthService.ts:5`
- Descripción: si `JWT_SECRET` no está definido, se usa un secreto literal presente en el repositorio. La API no importa `dotenv` en ningún fichero (verificado con grep: `dotenv` está en `package.json` pero no se usa), así que un `.env` no se carga y el fallback es el comportamiento por defecto salvo que se exporte la variable en el entorno. No hay comprobación de arranque que aborte si falta el secreto. El valor se define además en dos sitios.
```ts
const JWT_SECRET: string = process.env.JWT_SECRET || 'super-secret-resttek-key'
```
- Escenario: un atacante lee el repo (o prueba el valor típico) y firma localmente `jwt.sign({id:'x', role:'admin', restaurantId:null}, 'super-secret-resttek-key')`. Con ese token accede como admin a `POST /employees` y crea un admin permanente. Compromiso total de la API sin conocer ninguna contraseña.
- Recomendación: eliminar el fallback y hacer que la app falle al arrancar si `JWT_SECRET` falta o tiene menos de 32 bytes (en `NODE_ENV=test` usar un valor fijo propio). Centralizar la lectura en un único módulo `config`. Si se quiere `.env`, importar `dotenv/config` en `server.ts`. Rotar el secreto en cualquier entorno donde ya se haya desplegado con el valor por defecto.

#### OWASP-A02-02 – JWT sin restricción de algoritmo, issuer ni audience
- Severidad: **Baja** (hardening)
- Ubicación: `api/contexts/shared/infrastructure/http/middlewares.ts:25`, `api/contexts/employee/infrastructure/BcryptAuthService.ts:18`
- Descripción: `jwt.verify(token, JWT_SECRET)` no fija `algorithms`. Con `jsonwebtoken@9` y un secreto de tipo string solo se aceptan HS*, por lo que no es explotable hoy. No se verifican `iss` ni `aud`.
- Recomendación: `jwt.verify(token, secret, { algorithms: ['HS256'], issuer: 'resttek' })` y firmar con los mismos claims.

#### OWASP-A02-03 – Hashing de contraseñas correcto (sin hallazgo)
- Severidad: **Info**
- Ubicación: `api/contexts/employee/infrastructure/BcryptAuthService.ts:6-15`
- Descripción: bcrypt con 10 rondas, con salt incorporado; es aceptable (recomendado 10-12). Los hashes no aparecen en ninguna respuesta HTTP (los controladores construyen DTOs explícitos). No se almacenan datos de pago.
- Recomendación opcional: subir a 12 rondas. El cifrado en tránsito (TLS) depende del despliegue y no está en el código; ver A05-02.

---

### A03:2021 – Injection

#### OWASP-A03-01 – Sin inyección SQL (verificado)
- Severidad: **Info**
- Ubicación: `api/config/database.ts` y los 6 repositorios `Sqlite*`
- Qué se revisó: todas las llamadas a `db.run/get/all` en `SqliteEmployeeRepository`, `dish`, `ingredient`, `restaurant` y `order`. Todas usan placeholders `?` con el array de parámetros. Las únicas concatenaciones (`query += ' WHERE role = ?'`, `' LIMIT ? OFFSET ?'` en `SqliteEmployeeRepository.ts:27-36`) añaden cadenas constantes, no entrada de usuario. No hay NoSQL, ni ejecución de comandos (`child_process`/`exec`/`eval` ausentes) ni plantillas del lado servidor.

#### OWASP-A03-02 – Campos de texto/URL sin saneado (`logoUrl`, `name`, `notes`)
- Severidad: **Baja – Posible**
- Ubicación: `api/services/restaurant.service.ts:123-134`, `api/controllers/restaurant.controller.ts:17, 72`, `api/services/order.service.ts:33`
- Descripción: `logoUrl` se acepta sin validar esquema ni longitud, y `notes` y los nombres se guardan sin límite. La API devuelve JSON, así que no es XSS por sí misma, y Angular escapa por defecto. Es posible solo si un frontend usa `logoUrl` en `[href]` o con `bypassSecurityTrust*`; no lo he verificado.
- Escenario: un admin comprometido (o un fallo de A01) guarda `logoUrl: "javascript:..."` o una URL de tracking que se renderiza para todos los clientes.
- Recomendación: validar `logoUrl` con `new URL()` y permitir solo `https:`. Poner longitudes máximas a los campos de texto.

---

### A04:2021 – Insecure Design

#### OWASP-A04-01 – Creación de pedidos sin validación de `items` ni límites de cantidad (DoS)
- Severidad: **Alta**
- Ubicación: `api/services/order.service.ts:26-37`, `api/repositories/order.repository.ts:50-55`, `api/controllers/order.controller.ts:7-26`
- Descripción: por cada `item.quantity` se crea un registro y se hace un `INSERT` secuencial. `quantity` no se valida (tipo, entero, máximo, positivo), `items` no se valida (puede ser `undefined`) y no hay límite de tamaño por pedido. El registro es abierto (`/auth/register`), así que cualquiera obtiene el token necesario.
```ts
for (const item of request.items) {
    for (let i = 0; i < item.quantity; i++) {
        items.push({ id: randomUUID(), ... })
```
- Escenario: un cliente registrado envía `{"restaurantId":"rest-1","items":[{"dishId":"d1","quantity":1000000000}]}`. El bucle intenta asignar mil millones de objetos, agota la memoria de Node y tira el proceso, que es único. Con `quantity` de millones moderados, la API queda ocupada insertando filas en SQLite y la base de datos se llena de basura.
- Recomendación: validar con un esquema (zod o similar): `items` array de 1 a 50 elementos, `quantity` entero entre 1 y 20 (o similar), `dishId` string. Insertar en una transacción. Aplicar rate limiting (A07-01).

#### OWASP-A04-02 – Pedido sin coherencia de negocio (restaurante, plato, disponibilidad)
- Severidad: **Media**
- Ubicación: `api/services/order.service.ts:21-50`
- Descripción: el servicio no comprueba que `restaurantId` exista (lo hace la FK, que produce un error SQLite devuelto al cliente, ver A05-03), ni que cada `dishId` pertenezca a ese restaurante ni que esté `available`. `tableId` es texto libre sin entidad asociada. El precio no se toma del cliente (se une `dishes` al leer), lo cual es correcto.
- Escenario: se pide en `rest-1` un plato de `rest-2` o un plato marcado como no disponible; el pedido llega a cocina con datos inconsistentes.
- Recomendación: antes de crear el pedido, cargar los platos del restaurante y rechazar los que no existan, no pertenezcan o no estén disponibles.

#### OWASP-A04-03 – Validación de tipos numéricos ausente (`price`, `quantity`, `currentStock`)
- Severidad: **Baja**
- Ubicación: `api/services/dish.service.ts:103`, `api/models/dish.model.ts:37`, `api/services/ingredient.service.ts:87`
- Descripción: las comprobaciones son `price <= 0`, `quantity <= 0` y `currentStock < 0` sin verificar el tipo. Con `"abc"` o `NaN` las comparaciones dan `false`, así que el valor pasa la validación y llega a SQLite (que acepta tipos dinámicos). Para el valor `Infinity` también.
- Recomendación: `Number.isFinite(x)` más reglas de rango, con un esquema de validación común.

#### OWASP-A04-04 – Paginación sin tope y recursos sin límite
- Severidad: **Baja**
- Ubicación: `api/contexts/employee/infrastructure/http/EmployeeController.ts:38-39`, `api/routes/restaurant.public.routes.ts:13`
- Descripción: `limit` y `offset` se leen con `parseInt` sin máximo ni comprobación de negativos (en SQLite `LIMIT -1` devuelve todo). Solo admin accede, así que el impacto es bajo. `GET /public/restaurants` devuelve todos los restaurantes sin paginar y sin autenticación.
- Recomendación: acotar `limit` (1 a 100) y `offset >= 0`; paginar el listado público.

#### OWASP-A04-05 – Operaciones multi-sentencia sin transacción
- Severidad: **Baja**
- Ubicación: `api/repositories/order.repository.ts:44-56`, `api/repositories/dish.repository.ts:56-83`
- Descripción: crear un pedido (cabecera + N items) y guardar o borrar un plato (borra `dish_ingredients` y reinserta) son varias sentencias sin `BEGIN/COMMIT`. Un fallo a medias deja un pedido sin items o un plato sin ingredientes. Además, borrar un plato ya pedido falla por la FK `order_items.dish_id` (500 genérico) tras haber borrado ya sus ingredientes.
- Recomendación: envolver en transacciones; decidir una política explícita (borrado lógico) para platos referenciados por pedidos.

---

### A05:2021 – Security Misconfiguration

#### OWASP-A05-01 – CORS abierto a cualquier origen
- Severidad: **Baja**
- Ubicación: `api/app.ts:16`
- Descripción: `app.use(cors())` permite cualquier origen. La autenticación va por cabecera `Authorization` (no cookies), por lo que el riesgo de CSRF es bajo, pero se amplía la superficie de cualquier otro fallo. El proxy de `ng serve` hace innecesario el CORS abierto en desarrollo.
- Recomendación: lista blanca de orígenes por entorno (`origin: process.env.CORS_ORIGINS.split(',')`).

#### OWASP-A05-02 – Sin helmet / cabeceras de seguridad; `X-Powered-By` activo
- Severidad: **Media**
- Ubicación: `api/app.ts:14-17`, `package.json` (sin `helmet`)
- Descripción: no hay `helmet`, ni HSTS, ni `X-Content-Type-Options`, y Express anuncia `X-Powered-By: Express`. No hay forzado de HTTPS ni `trust proxy` configurado (el despliegue detrás de un proxy TLS queda sin definir). Tampoco hay `express-rate-limit` (ver A07-01).
- Recomendación: `app.disable('x-powered-by')`, `helmet()`, HSTS en producción y documentar el modelo de despliegue (TLS en el proxy, `trust proxy` explícito).

#### OWASP-A05-03 – Fuga de mensajes internos de error en los controladores de pedidos y JSON mal formado
- Severidad: **Media**
- Ubicación: `api/controllers/order.controller.ts:19-24, 78-83`; `api/contexts/shared/infrastructure/http/errorHandler.ts:32`
- Descripción: el `catch` de `createOrder` devuelve `error.message` de cualquier `Error` con estado 400, incluidos errores de SQLite (`SQLITE_CONSTRAINT: FOREIGN KEY constraint failed`) y `TypeError` de JavaScript (`items is not iterable`). Eso revela estructura de la BD y detalles internos. El handler global sí devuelve un 500 genérico, y no hay stack traces en ninguna respuesta (verificado). Un cuerpo JSON mal formado produce un `SyntaxError` que cae en el handler genérico como 500 (debería ser 400); además, los controladores de pedidos no usan `next(error)`, por lo que se saltan el handler.
```ts
if (error instanceof Error) {
    res.status(400).json({ error: error.message })
```
- Escenario: un atacante envía un `restaurantId` inexistente o `items: null` y deduce nombres de tablas y restricciones.
- Recomendación: usar `next(error)` en los controladores de pedidos, devolver solo mensajes de `AppError` y mapear `SyntaxError` de body-parser a 400.

#### OWASP-A05-04 – Gestión de ficheros sensibles (sin hallazgo)
- Severidad: **Info**
- Ubicación: `.gitignore`, `api/config/database.ts:18`
- Descripción: `*.db` está ignorado y no hay `.env` ni `.db` versionados (`git ls-files`). No hay endpoints de debug ni de estáticos. La base de datos en test es `:memory:`. `GET /health` solo devuelve `{status:'ok'}`. Recomendación: crear un `.env.example` documentando `JWT_SECRET`, `PORT` y los orígenes CORS.

---

### A06:2021 – Vulnerable and Outdated Components

`npm audit --workspace @resttek/api` funciona (usa el `package-lock.json` raíz). Resultado: **22 vulnerabilidades (4 críticas, 13 altas, 2 moderadas, 3 bajas)**. Con `--omit=dev`: 12 (2 críticas, 7 altas, 1 moderada, 2 bajas). Versiones instaladas: `express 5.2.1`, `body-parser 2.2.2`, `qs 6.15.0`, `proxy-addr 2.0.7`, `sqlite3 5.1.7`, `bcrypt 6.0.0`, `jsonwebtoken 9.0.3`, `cors 2.8.6`.

#### OWASP-A06-01 – Dependencias transitivas de runtime de Express vulnerables
- Severidad: **Alta**
- Ubicación: `packages/api/package.json` (`express ^5.2.1`) y `package-lock.json`
- Descripción:
  - `body-parser 2.2.2` (high): GHSA-v422-hmwv-36x6 (un `limit` inválido desactiva silenciosamente el límite de tamaño) y GHSA-27r3-jxmh-p828 (DoS por bytes sobrantes tras un cuerpo comprimido). Está en el camino de `express.json()` (`app.ts:17`), alcanzable sin autenticación (por ejemplo, `POST /auth/login`).
  - `qs 6.15.0` (moderate): varios DoS por parseo (`GHSA-x5fp-wj9c-mxmx`, `GHSA-4mjr-xmp4-gh2g`); el parseo de query lo usa Express.
  - `proxy-addr 2.0.7` (critical en el advisory): suplantación de IP vía subred IPv4-mapeada (GHSA-jqcg-44mw-7w3h). Hoy no es explotable porque la app no activa `trust proxy`, pero sí lo sería al añadir rate limiting por IP detrás de un proxy.
- Escenario: un atacante anónimo envía a `/api/v1/auth/login` cuerpos comprimidos malformados para bloquear peticiones y consumir CPU.
- Recomendación: `npm audit fix` (hay arreglo sin cambio mayor para `body-parser`, `qs` y `proxy-addr`) y re-ejecutar `npm audit` en CI.

#### OWASP-A06-02 – Vulnerabilidades críticas/altas en herramientas de desarrollo
- Severidad: **Media**
- Ubicación: `packages/api/package.json` (`vitest ^3.1.1`; transitivas `tinypool`, `vite`, `esbuild`, `postcss`, etc.)
- Descripción: `vitest` (critical) arrastra `tinypool` (prototype pollution a RCE, GHSA-5gmw-xhrv-c9v3) y `vite` (lectura de ficheros vía dev server, high). Solo afecta a desarrolladores o CI que ejecuten tests o servidores de desarrollo, no a producción.
- Recomendación: actualizar `vitest` (`npm audit fix`) y no exponer el dev server de Vite a la red.

#### OWASP-A06-03 – Cadena de build de `sqlite3` (tar / node-gyp)
- Severidad: **Baja**
- Ubicación: `packages/api/package.json` (`sqlite3 ^5.1.7`)
- Descripción: `sqlite3@5.1.7` depende de `node-gyp`, `tar`, `cacache` y `make-fetch-happen` vulnerables (el advisory de `tar` es crítico, con múltiples CVE de path traversal). Solo se ejecutan al instalar y compilar el binario nativo, no en runtime. El arreglo propuesto, `sqlite3@6.0.1`, es un cambio mayor.
- Recomendación: planificar la migración a `sqlite3@6` (o `better-sqlite3`) y evitar instalar paquetes de fuentes no confiables en CI.

#### OWASP-A06-04 – Dependencia declarada y sin uso (`dotenv`)
- Severidad: **Info**
- Ubicación: `packages/api/package.json`
- Descripción: `dotenv` está declarado pero no se importa en ningún fichero de la API; ver su efecto en A02-01. No hay versiones sin soporte en `bcrypt`, `jsonwebtoken` ni `cors`. No hay CI (`.github` no existe) que ejecute `npm audit`.

---

### A07:2021 – Identification and Authentication Failures

#### OWASP-A07-01 – Sin límite de intentos en login y registro
- Severidad: **Alta**
- Ubicación: `api/contexts/employee/infrastructure/http/auth.routes.ts:6-7`, `api/app.ts`
- Descripción: no hay rate limiting ni bloqueo de cuenta. Combinado con credenciales predecibles (A07-06), la fuerza bruta es trivial. bcrypt ralentiza el ataque pero consume CPU del servidor, lo que a la vez permite DoS.
- Escenario: un script prueba `admin@resttek.com` con contraseñas comunes, o miles de cuentas con `email=contraseña`, sin ningún freno.
- Recomendación: `express-rate-limit` por IP y por email en `/auth/*` (por ejemplo, 5 intentos por 15 min), con backoff o bloqueo temporal y logging (A09-01).

#### OWASP-A07-02 – Sin política de contraseñas ni validación de entrada de credenciales
- Severidad: **Media**
- Ubicación: `api/contexts/employee/application/RegisterClientUseCase.ts:38`, `api/contexts/employee/application/CreateEmployeeUseCase.ts:28`
- Descripción: `hashPassword(dto.password)` acepta cualquier valor: contraseña de 1 carácter, igual al email, etc. Si `password` falta o no es string, `bcrypt.hash` lanza un `Error` genérico y se devuelve 500.
- Recomendación: mínimo 10-12 caracteres, rechazar si coincide con el email, validar tipos (string) y longitud máxima (bcrypt trunca a 72 bytes).

#### OWASP-A07-03 – Enumeración de usuarios
- Severidad: **Baja**
- Ubicación: `api/contexts/employee/application/RegisterClientUseCase.ts:33-36`, `api/contexts/employee/application/LoginUseCase.ts:29-33`
- Descripción: `/auth/register` responde con `DuplicatedEmailError` si el email existe, y el login responde antes (sin ejecutar bcrypt) cuando el usuario no existe, lo que da una diferencia de tiempo medible. El mensaje del login sí es genérico (correcto).
- Recomendación: ejecutar siempre un `bcrypt.compare` contra un hash ficticio y usar una respuesta uniforme en el registro (o confirmación por email).

#### OWASP-A07-04 – Tokens de 8 h sin revocación y claims no revalidados
- Severidad: **Media**
- Ubicación: `api/contexts/employee/infrastructure/BcryptAuthService.ts:17-19`, `api/contexts/shared/infrastructure/http/middlewares.ts:25-27`
- Descripción: el `role` y el `restaurantId` van dentro del token y nunca se revalidan contra la base de datos. Un empleado despedido o degradado conserva sus permisos hasta 8 horas. No hay refresh token, lista de revocación ni logout en servidor. `req.user` es de tipo `any`.
- Recomendación: expiración corta (15 min) más refresh token rotatorio, o comprobar el empleado en BD en `authenticate` para operaciones sensibles. Tipar el payload.

#### OWASP-A07-05 – Emails sin normalizar (duplicados por mayúsculas)
- Severidad: **Baja**
- Ubicación: `api/contexts/shared/domain/value-objects/Email.ts:10`, `api/contexts/employee/infrastructure/SqliteEmployeeRepository.ts:19`
- Descripción: el value object `Email` valida pero no normaliza (`trim`/`toLowerCase`), y la búsqueda es sensible a mayúsculas. `Admin@resttek.com` y `admin@resttek.com` son cuentas distintas; permite registros de apariencia idéntica a otra cuenta (suplantación visual). Además, el login falla si el usuario cambia las mayúsculas.
- Recomendación: normalizar a minúsculas en el VO (y colación `COLLATE NOCASE` o índice único sobre `lower(email)`).

#### OWASP-A07-06 – Credenciales por defecto: contraseña = email (incluido el admin)
- Severidad: **Alta**
- Ubicación: `api/scripts/seed.ts:22, 51, 27, 56, 206-216`
- Descripción: el seed crea al admin y a todos los empleados con la contraseña igual a su email, y lo imprime. Es idempotente y no distingue entorno, por lo que ejecutarlo en un entorno compartido o de producción deja un admin con credenciales públicas (`admin@resttek.com` / `admin@resttek.com`). El `CLAUDE.md` del repo lo documenta explícitamente.
```ts
passwordHash: await authService.hashPassword('admin@resttek.com'),
role: 'admin',
```
- Escenario: en cualquier despliegue donde se haya ejecutado `npm run seed`, un atacante hace `POST /auth/login` con esas credenciales, entra como admin y toma el control de todos los restaurantes y empleados.
- Recomendación: que el seed se niegue a ejecutarse si `NODE_ENV=production`, y que genere contraseñas aleatorias (o lea `SEED_ADMIN_PASSWORD`) en lugar de derivarlas del email. Forzar el cambio de contraseña en el primer login.

---

### A08:2021 – Software and Data Integrity Failures

#### OWASP-A08-01 – Sin deserialización insegura ni mass assignment (verificado)
- Severidad: **Info**
- Ubicación: todos los controladores
- Qué se revisó: la API solo procesa JSON (`express.json()`), sin `eval`, sin `vm`, sin `yaml.load`, sin formatos binarios ni uploads. Los controladores copian campos concretos de `req.body` (por ejemplo, `EmployeeController.ts:14`, `dish.controller.ts:11-19`), de modo que no se puede inyectar `role` ni `id` por campos extra. La creación de empleados con rol arbitrario es solo `admin` y el rol se valida contra una lista blanca (`Role.ts:5-18`). El registro público fuerza `role: 'cliente'` (`RegisterClientUseCase.ts:46`).

#### OWASP-A08-02 – Integridad de la cadena de suministro
- Severidad: **Info**
- Ubicación: `package-lock.json`, repo
- Descripción: existe `package-lock.json` en la raíz (instalaciones reproducibles). No hay pipeline CI/CD en el repo (`.github` ausente), por lo que no hay verificación automática (`npm audit`, `npm ci`, firmas, SBOM). Los scripts de instalación de `sqlite3` descargan binarios (ver A06-03).
- Recomendación: pipeline con `npm ci`, `npm audit --omit=dev` y revisión de dependencias.

---

### A09:2021 – Security Logging and Monitoring Failures

#### OWASP-A09-01 – No se registran eventos de seguridad ni errores inesperados
- Severidad: **Media**
- Ubicación: `api/contexts/shared/infrastructure/http/middlewares.ts:13, 20, 29, 36`; `api/contexts/shared/infrastructure/http/errorHandler.ts:32`; `api/controllers/order.controller.ts:38-40, 52-54, 64-66, 81-83`
- Descripción: los fallos de login, tokens inválidos y 403 no dejan rastro. El `errorHandler` devuelve el 500 sin `console.error`, y los `catch` de los controladores de pedidos devuelven 500 sin registrar la causa. Un fallo real (BD caída, bug) es invisible, y un ataque de fuerza bruta o de IDOR (A01, A07) no se detectaría.
```ts
res.status(500).json({ error: 'InternalServerError', message: 'Something went wrong' })
```
- Recomendación: logger estructurado (pino) con id de petición. Registrar login fallido/exitoso, 401/403, creación de empleados y cambios de estado (con id de usuario e IP, sin contraseñas ni tokens) y loguear los errores 500 con su stack solo en el servidor.

#### OWASP-A09-02 – Sin registro de peticiones ni auditoría
- Severidad: **Baja**
- Ubicación: `api/app.ts`, `api/server.ts:9-12`
- Descripción: no hay middleware de logging de acceso. Lo único que se escribe es el arranque (`console.log`). No hay auditoría de operaciones administrativas (alta de empleados, cambios de precio, cambios de estado de pedidos).
- Recomendación: middleware de logging de acceso y tabla o log de auditoría para operaciones de escritura sensibles.

#### OWASP-A09-03 – El seed imprime credenciales en stdout
- Severidad: **Baja**
- Ubicación: `api/scripts/seed.ts:27, 56, 205-216`
- Descripción: se imprimen en consola usuario y contraseña de todas las cuentas, lo que acaba en logs de CI o de contenedores si el seed se ejecuta allí. Ligado a A07-06.
- Recomendación: no imprimir secretos; si hay contraseñas generadas, mostrarlas una sola vez de forma explícita y solo en modo desarrollo.

---

### A10:2021 – Server-Side Request Forgery (SSRF)

#### OWASP-A10-01 – Sin hallazgos
- Severidad: **Info**
- Qué se revisó: búsqueda en todo `api/` de `fetch(`, `axios`, `http.request`, `https.`, `child_process` y similares: no hay ninguna llamada HTTP saliente. El campo `logoUrl` de restaurante se guarda como texto y nunca se descarga ni se resuelve en servidor. Tampoco hay webhooks, importación por URL ni proxys.
- Nota preventiva: si en el futuro se descarga el logo o se añaden webhooks, validar esquema, resolver DNS y bloquear rangos privados y link-local (`127.0.0.0/8`, `169.254.169.254`, `10/8`, etc.).

---

## 3. Tabla priorizada de acciones

| Prioridad | ID | Severidad | Acción | Esfuerzo |
|:---------:|----|-----------|--------|:--------:|
| 1 | A02-01 | Crítica | Eliminar el secreto JWT por defecto, abortar el arranque sin `JWT_SECRET` (≥32 bytes), centralizar en un módulo y rotar el secreto | S |
| 2 | A01-02 | Alta | `PATCH /orders/:orderId/items/:itemId/status`: `authorize` de staff y verificar `restaurantId` del pedido | S |
| 3 | A01-01 | Alta | `GET /orders/:id`: exigir que el pedido sea del cliente o del restaurante del staff (404 si no) | S |
| 4 | A01-03 | Alta | `GET /orders/active`: solo staff, usar `user.restaurantId` del token | S |
| 5 | A01-04 / A01-05 | Alta / Media | Middleware `authorizeRestaurant` (`admin` o `user.restaurantId === :restaurantId`) en dishes e ingredients; buscar por `(id, restaurantId)` | M |
| 6 | A07-06 | Alta | Seed: contraseñas aleatorias o por variable de entorno, negarse a ejecutar en producción, no imprimirlas (A09-03) | S |
| 7 | A07-01 | Alta | Rate limiting y bloqueo temporal en `/auth/login` y `/auth/register` (con `trust proxy` correcto) | S |
| 8 | A04-01 | Alta | Validación de `items` y `quantity` (máximos), transacción de inserción | M |
| 9 | A06-01 | Alta | `npm audit fix` para `body-parser`, `qs`, `proxy-addr`; añadir `npm audit` a CI | S |
| 10 | A05-03 / A09-01 | Media | Usar `next(error)` en pedidos, no devolver `error.message` internos; logger estructurado con eventos de seguridad y 500 | M |
| 11 | A07-02 / A07-04 / A07-05 | Media / Baja | Política de contraseñas, normalizar emails, tokens cortos con refresh o revalidación contra BD | M |
| 12 | A05-02 / A05-01 | Media / Baja | `helmet`, quitar `X-Powered-By`, CORS con lista blanca, definir TLS y `trust proxy` | S |
| 13 | A04-02 / A04-03 | Media / Baja | Validar coherencia de pedido (platos del restaurante, disponibilidad) y tipos numéricos con un esquema común (zod) | M |
| 14 | A06-02 / A06-03 | Media / Baja | Actualizar `vitest`; planificar `sqlite3@6` o `better-sqlite3` | M |
| 15 | A01-06, A02-02, A03-02, A04-04, A04-05, A07-03, A09-02 | Baja | DTO público de restaurante, restricciones de JWT (`algorithms`, `iss`), validar `logoUrl`, tope de paginación, transacciones, respuestas uniformes, logging de acceso | M |

Esfuerzo: S = horas, M = 1-2 días.
