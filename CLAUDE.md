# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

Resttek: plataforma de gestión de restaurantes. Monorepo con **npm workspaces** (`packages/*`, Node 22+, npm 10+): una API (`@resttek/api`, Express 5 + TypeScript + SQLite) y tres apps Angular 21 (`web-admin` :4200, `web-empleados` :4201, `web-clientes` :4202) más la librería `@resttek/web-shared`. La documentación del proyecto está en español; `docs/` tiene arquitectura y dominio (`glosario.md`, `modelo-datos.md`).

## Comandos (desde la raíz)

```bash
npm install            # una sola vez, instala todos los workspaces
npm run seed           # puebla SQLite (INSERT OR IGNORE, idempotente); imprime credenciales
npm run dev:api        # API en :3000 (tsx watch); health: GET /health
npm run dev:admin      # / dev:empleados / dev:clientes: ng serve con proxy /api -> :3000
npm test               # solo tests de la API (vitest run)
```

- Test único (API): `cd packages/api && npx vitest run src/ruta/Fichero.test.ts` (o `-t "nombre"`); modo watch: `npm run test:watch` en `packages/api`.
- Los frontends se construyen con `ng build` dentro de cada paquete; no hay script de lint ni build en la raíz.
- Credenciales de prueba: la contraseña de cada usuario es su propio email (p. ej. `admin@resttek.com`).
- Cambios en `web-shared` no se recargan solos: reiniciar el dev server del frontend.

## Arquitectura

### API (`packages/api`) — dos estilos conviven

- **Hexagonal + DDD solo en `src/contexts/employee/`** (domain / application / infrastructure, con casos de uso de un único `execute()`, constructor privado + `create()` en `Employee`, interfaces con prefijo `I`). `contexts/shared/` tiene el value object `Email`, middlewares y `errorHandler`.
- **Por capas en `restaurant`, `dish`, `ingredient`, `order`**: carpetas `models/`, `repositories/`, `services/`, `controllers/`, `routes/` con un fichero por dominio. Aquí no hay entidades con comportamiento: son `interface` planas, la validación vive en los servicios y en funciones `normalizeX()` del modelo (trim + lowercase + error de dominio). Interfaz de repositorio sin prefijo `I`, en el mismo fichero que su implementación `Sqlite*Repository`.
- Antes de tocar código, identificar a qué estilo pertenece el dominio y seguirlo. Ver `docs/arquitectura/arquitectura-api.md`.
- SQLite en `packages/api/resttek.db`; las tablas se crean al arrancar (migraciones en código). Con `NODE_ENV=test` se usa `:memory:`.
- Auth JWT: middleware `authenticate` + `authorize` (roles: admin, manager, camarero, cocinero, cliente). Rutas bajo `/api/v1/`.
- Tests con Vitest (`globals: true`, `vite-tsconfig-paths`), colocados junto al fichero que prueban (`*.test.ts`).

### Frontends

- Angular 21: standalone components, signals, **zoneless** (sin `zone.js`), guards/interceptors funcionales. RxJS solo para HTTP.
- `web-admin` y `web-empleados`: features con `models/ pages/ services/ store/`; los stores son servicios `providedIn: 'root'` con signals privadas expuestas en solo lectura y llamadas HTTP envueltas en `firstValueFrom`.
- `web-clientes` es distinta: modelos/servicios/store en `core/`, features como componentes sueltos, y los componentes consumen los `Observable` directamente. Su componente raíz es `App` (`app.ts`), no `AppComponent`.
- No hay `shared/` propio en las apps: auth, interceptors y componentes comunes viven en `@resttek/web-shared` (único paquete compartido; los frontends no dependen entre sí). Ver `docs/arquitectura/arquitectura-frontend.md`.

## Scripts auxiliares

`scripts/seed-issues.sh` crea issues de GitHub desde `scripts/issues.json` (requiere `gh` y `jq`); ver `scripts/README.md`.
