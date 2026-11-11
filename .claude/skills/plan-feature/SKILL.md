---
name: plan-feature
description: Planifica una nueva funcionalidad o el arreglo de un error. Úsala cuando pidan planificar, diseñar el plan o preparar el trabajo de una feature, issue o bug antes de implementarlo.
argument-hint: <num_issue> <descripción de la funcionalidad o del error>
---

# plan-feature

Genera un plan de implementación con un formato único para todo el equipo. **No implementes nada**: solo planifica.

## Pasos

1. **Obtén los datos de entrada** a partir de `$ARGUMENTS` o de la conversación:
   - Número de issue (`<num_issue>`). Si no se ha dado, pregúntalo antes de continuar.
   - Descripción de la funcionalidad o del error.
2. **Investiga el código** necesario para planificar con precisión. Lee `CLAUDE.md` y respeta sus convenciones (arquitectura por capas: controllers, services, repositories, models y utils; funciones en snake_case; camelCase en el JSON y snake_case en SQL). Si el plan toca paginación en endpoints GET, lee `docs/api/api-pagination.md`.
3. **Lee la plantilla** [assets/template.md](assets/template.md) y rellénala completa, sin quitar ni reordenar secciones:
   - **Objetivo**: qué se quiere conseguir y por qué. En un bug, comportamiento actual vs. esperado.
   - **Alcance**: qué incluye y qué NO incluye.
   - **Archivos afectados**: rutas reales (comprueba que existen las que se modifican) con la acción (crear, modificar, eliminar) y el motivo.
   - **Tareas**: lista ordenada de casillas `- [ ]`. Cada tarea debe poder hacerse en **5-10 minutos**; si una es mayor, divídela. Incluye las tareas de tests (vitest) y de formato/lint (prettier y eslint) cuando proceda.
   - **Criterios de aceptación**: condiciones observables y verificables que deben cumplirse para dar por hecho lo pedido.
   - **Dudas y decisiones tomadas** (siempre al final): dudas abiertas y cualquier decisión que hayas tomado por tu cuenta, con su motivo. Si no hay, escribe "Ninguna".
4. **Guarda el plan** en `plans/<num_issue>-<breve-descripcion>.md`:
   - Crea la carpeta `plans/` si no existe.
   - `<breve-descripcion>` en kebab-case, minúsculas, sin tildes y de 2 a 5 palabras (ej.: `plans/42-paginacion-vendehumos.md`).
   - Si el archivo ya existe, no lo sobrescribas sin confirmar con el usuario.
5. **Responde** con la ruta del archivo creado y un resumen muy breve, destacando las dudas y decisiones que requieren revisión del usuario.
6. **Avisa por Slack**: como último paso, envía un mensaje al canal de Slack `curso-claude-ed3` indicando que ya se ha planificado la tarea. Usa la herramienta MCP de Slack (`mcp__slack__slack_post_message` para publicar el mensaje en el canal con el id "C0CGZ01R9M2"; si no están cargadas, cárgalas antes con ToolSearch).
   - El mensaje debe incluir el número de issue, una descripción breve y la ruta del plan (ej.: `Ya se ha planificado la issue 42 (paginación de vendehumos): plans/42-paginacion-vendehumos.md`).
   - No incluyas datos privados (emails, rutas locales absolutas, secretos). Si no se puede enviar el mensaje, informa al usuario del fallo, sin reintentar en bucle.

## Reglas

- Escribe el plan en español.
- No inventes archivos ni funciones: basa el plan en lo que existe en el repositorio.
- No modifiques código ni hagas commits como parte de esta skill.
