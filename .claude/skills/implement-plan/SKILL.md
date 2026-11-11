---
name: implement-plan
description: Implementa un plan de la carpeta plans/ aplicando TDD estricto, tarea a tarea, en una rama propia creada desde development. Úsala cuando pidan implementar, ejecutar o desarrollar un plan.
argument-hint: <ruta o nombre del plan, ej.: plans/1-login-registro-usuarios-jwt.md>
---

# implement-plan

Implementa el plan indicado en `$ARGUMENTS` tarea a tarea, con TDD estricto, marcando cada tarea en el plan y haciendo un commit por tarea.

## Pasos

### 1. Localiza y lee el plan

- Resuelve `$ARGUMENTS` a un archivo de `plans/` (acepta la ruta completa, el nombre con o sin `.md`, o solo el número de issue). Si no se ha indicado plan o hay varias coincidencias, pregunta cuál antes de continuar.
- Lee el plan completo (objetivo, alcance, archivos afectados, tareas, criterios de aceptación, dudas) y `CLAUDE.md`, y respeta sus convenciones (capas controllers/services/repositories/models/utils, funciones en snake_case, prettier sin `;` y con comillas simples, eslint, tests con vitest).
- Si en "Dudas y decisiones tomadas" hay dudas abiertas que bloquean la implementación, pregúntalas al usuario antes de empezar.

### 2. Prepara la rama

El nombre de la rama es el **nombre del plan sin la extensión** (ej.: `plans/1-login-registro-usuarios-jwt.md` → `1-login-registro-usuarios-jwt`).

1. Ejecuta `git status --short` y `git branch --list development main`. Si hay cambios sin commitear que no sean el propio plan, avisa al usuario antes de cambiar de rama.
2. Si `development` **no existe**, créala a partir de `main`: `git switch -c development main`. No la publiques (nada de `git push`).
3. Crea la rama del plan a partir de `development`: `git switch -c <nombre-del-plan> development`.
4. Si la rama del plan ya existe, no la recrees ni la sobrescribas: pregunta al usuario si continuar en ella (útil para retomar un plan a medias; en ese caso salta las tareas ya marcadas `- [x]`).
5. Si el plan es un archivo sin commitear (p. ej. está en `plans/` sin trackear), se mantendrá en el árbol de trabajo al cambiar de rama; se commiteará junto con la primera tarea.

### 3. Implementa cada tarea con TDD estricto

Recorre las tareas `- [ ]` **en orden**, de una en una. Para cada tarea:

1. **Red**: escribe primero el test (vitest) que describe el comportamiento de la tarea. Ejecútalo (`npx vitest run <archivo>`) y **comprueba que falla** por la razón esperada (no por un error de sintaxis o de import). No escribas código de producción antes de ver el test en rojo.
2. **Green**: escribe el código **mínimo** necesario para que el test pase, en la capa que corresponda. Ejecuta el test y confirma que pasa.
3. **Refactor**: limpia el código manteniendo los tests en verde. Aplica prettier y eslint a los archivos tocados.
4. **Verifica**: ejecuta la suite completa (`npm test`) y comprueba que nada anterior se ha roto. Si algo falla, corrígelo antes de seguir.
5. **Marca la tarea como hecha** en el archivo del plan, cambiando `- [ ]` por `- [x]` solo para esa tarea y solo cuando el test pase con el código implementado.
6. **Commit**: invoca el slash command `/commit` (con la herramienta Skill, skill `commit`) pasando como argumento un contexto breve con el número y título de la tarea. El commit debe incluir el código, el test y el plan actualizado. No hagas `git commit` a mano ni `git push`.

Tareas sin comportamiento testable (instalar dependencias, crear archivos de configuración, documentar en `CLAUDE.md`, etc.):
- No inventes tests artificiales. Verifica el resultado con un comando observable (p. ej. `npm ls`, `npx eslint .`, `npx prettier --check .`, arrancar el comando) y, si pasa, marca la tarea y haz commit igualmente.
- Si la tarea es la que configura vitest y aún no existe, instálalo y configúralo primero, y usa su ejecución como verificación.

### 4. Cierre

- Cuando todas las tareas estén en `- [x]`, recorre los **criterios de aceptación** del plan y comprueba cada uno (tests, ejecución real si procede). Informa de los que no se cumplan y aquellos que se cumplan, marcalos `- [x]`.
- Ejecuta `git status` y `git log --oneline` para confirmar que el árbol está limpio y hay un commit por tarea.
- Responde con: rama usada, tareas completadas, resultado de la suite de tests y cualquier decisión o desviación respecto al plan.

### 5. Avisa por Slack

- Como último paso, envía un mensaje al canal de Slack `curso-claude-ed3` indicando que el plan ya se ha implementado. Usa la herramienta MCP de Slack (`mcp__slack__slack_post_message` para publicar el mensaje en el canal con el id "C0CGZ01R9M2"; si no está cargada, cárgala antes con ToolSearch).
- El mensaje debe incluir el nombre del plan y la rama (ej.: `Ya se ha implementado el plan 1-login-registro-usuarios-jwt (rama 1-login-registro-usuarios-jwt).`). Si quedaron tareas sin completar o criterios sin cumplir, indícalo en el mensaje en lugar de decir que está terminado.
- No incluyas datos privados (emails, rutas locales, secretos). Si no se puede enviar el mensaje, informa al usuario del fallo, sin reintentar en bucle.

## Reglas

- Una tarea = un ciclo TDD = un commit. No agrupes varias tareas en un commit ni dejes tareas hechas sin commitear.
- Nunca marques una tarea como hecha si su test no pasa.
- No te saltes el paso rojo del test ni escribas código "por adelantado" de tareas posteriores.
- Si una tarea no se puede completar o el plan es incorrecto, para, explica el problema y pregunta al usuario; no improvises cambios fuera del alcance del plan.
- No hagas `git push`, `--amend`, `--no-verify` ni modifiques la configuración de git.
- No toques `main`, salvo para crear `development` a partir de ella.
