---
name: actualizar-docs-api
description: Actualiza docs/api/openapi.yml y regenera la documentación HTML con Redocly. Úsala siempre que cambie algo de la API (rutas, parámetros, cuerpos, validaciones, respuestas, códigos de estado, roles, autenticación, categorías) o cuando pidan actualizar, validar o generar la documentación de la API.
---

# actualizar-docs-api

Mantiene sincronizado el contrato `docs/api/openapi.yml` con el comportamiento real de la API y genera con Redocly la documentación HTML (`docs/api/openapi.html`).

## Pasos

### 1. Detecta qué ha cambiado en la API

- Revisa `git diff` (y `git diff --staged`) y `git log` de la rama para ver qué se ha tocado.
- Lee las fuentes de verdad del comportamiento, según lo que haya cambiado:
  - `index.js`: rutas, métodos y middlewares aplicados.
  - `controllers/`: códigos de estado y forma de las respuestas.
  - `services/` y `utils/validar_*.js`: reglas de validación y mensajes de error.
  - `models/`: campos devueltos por la API (camelCase).
  - `db.js`: `CATEGORIAS` y `ROLES`.
  - `utils/paginacion.js`: valores por defecto y límites de paginación.
  - `middlewares/`: autenticación y roles.
- Si nada de eso ha cambiado, no modifiques el contrato y ve directamente al paso 3.

### 2. Actualiza `docs/api/openapi.yml`

- Cambia solo lo necesario y respeta la estructura actual: operaciones en `paths`, tipos reutilizables en `components.schemas` y respuestas comunes en `components.responses`. Reutiliza con `$ref`; no dupliques esquemas.
- Cada operación debe llevar `tags`, `summary`, `operationId` en camelCase, `security` (explícito, `[]` si es pública), `requestBody` si procede y todas sus respuestas reales con un ejemplo.
- Redacta las descripciones en español. El JSON de la API es camelCase.
- Usa la checklist de abajo para no olvidar nada.

#### Checklist según el tipo de cambio

- **Nuevo endpoint**: añade la ruta en `paths` con `tags`, `summary`, `operationId`, `security`, parámetros o `requestBody` y todas sus respuestas (éxito y errores) con ejemplos; añade el tag en `tags` si es nuevo.
- **Campo nuevo, renombrado o eliminado**: actualiza el esquema de `components.schemas` (`properties`, `required`, `example`) tanto del modelo de respuesta como del cuerpo de entrada, usando los nombres camelCase del JSON.
- **Nueva categoría o rol**: actualiza los `enum` de `Categoria` o `Rol` para que coincidan exactamente con `CATEGORIAS` y `ROLES` de `db.js`, y los mensajes de error de ejemplo que los listen.
- **Código de estado o mensaje de error**: añade, quita o ajusta la respuesta en la operación; reutiliza `Errores` (`{ errores: [] }`) para `400` y `Error` (`{ error }`) para el resto.
- **Validaciones**: refleja en el esquema los límites (`minLength`, `minimum`, `maximum`, `default`, `format`) y explica en `description` las reglas que no se puedan expresar así (por ejemplo, las de la contraseña).
- **Paginación**: ajusta los parámetros `page` y `limit` (límites y valores por defecto) y el esquema de página (`self`, `first`, `prev`, `next`, `last`, `items`) de acuerdo con `docs/api/api-pagination.md` y `utils/paginacion.js`.
- **Autenticación o roles**: actualiza `security` de cada operación afectada (`bearerAuth` obligatorio, `{}` para opcional, `[]` si es pública), añade las respuestas `401` y `403` que correspondan y revisa las descripciones que digan que una ruta "no exige autenticación".
- **Endpoint eliminado**: borra la ruta y los esquemas o respuestas que ya no use nadie.

### 3. Valida y genera el HTML

Ejecuta desde cualquier directorio:

```bash
bash .claude/skills/actualizar-docs-api/scripts/generar_docs.sh
```

- Ejecuta `redocly lint` sobre el contrato y, si no hay errores, genera `docs/api/openapi.html`.
- Con `--solo-validar` solo hace el lint (útil mientras editas).
- Necesita Node.js y red la primera vez (usa `npx @redocly/cli`).
- Si el lint da **errores**, corrígelos en el contrato y vuelve a ejecutar. Los avisos (`warning`) no bloquean.

### 4. Verifica y resume

- Comprueba que `docs/api/openapi.yml` y `docs/api/openapi.html` se han actualizado y que el HTML se ha regenerado después del último cambio del contrato.
- Informa al usuario de qué se ha cambiado en el contrato y del resultado del lint.
- No hagas commit salvo que te lo pidan; si lo piden, incluye el `.yml` y el `.html` juntos.

## Reglas

- El contrato describe el comportamiento **real** del código, no el deseado: si dudas, lee el código o ejecuta la API.
- No modifiques código de la API desde esta skill; solo la documentación.
- No edites `docs/api/openapi.html` a mano: se regenera siempre con el script.
