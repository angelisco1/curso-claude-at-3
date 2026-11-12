---
name: implement-plan
description: Implementa el plan publicado como comentario de una issue de GitHub, aplicando TDD estricto, tarea a tarea, en un git worktree propio (.claude/worktrees) con su rama, y deja la PR creada para revisión. Úsala cuando pidan implementar, ejecutar o desarrollar el plan de una issue.
argument-hint: <num_issue | url_issue>
---

# implement-plan

Dado el número o la URL de una issue en `$ARGUMENTS`, obtiene con `gh` el plan publicado como comentario, lo implementa tarea a tarea con TDD estricto en un git worktree propio (haciendo un commit por tarea) y deja una PR abierta para que alguien la revise antes de mergearla.

## Pasos

### 1. Obtén el plan de la issue con `gh`

- El usuario debe dar el **número o la URL** de la issue en `$ARGUMENTS` o en la conversación. Si no la ha dado, pregúntala antes de continuar. Extrae `<num_issue>` si es una URL.
- Ejecuta `gh issue view <num_issue_o_url> --json number,title,url,comments` y localiza entre los comentarios el que contiene el plan (generado por `plan-feature`: empieza por `# <num_issue> - <título>` y tiene las secciones Objetivo, Alcance, Archivos afectados, Tareas, Criterios de aceptación y Dudas y decisiones tomadas). Si hay varios, usa el más reciente.
- Si `gh` falla o no hay ningún comentario con el plan, informa al usuario (sugiere ejecutar antes `plan-feature`) y detente. No inventes el plan.
- Lee el plan completo y `CLAUDE.md`, y respeta sus convenciones (capas controllers/services/repositories/models/utils, funciones en snake_case, prettier sin `;` y con comillas simples, eslint, tests con vitest).
- Si en "Dudas y decisiones tomadas" hay dudas abiertas que bloquean la implementación, pregúntalas al usuario antes de empezar.

### 2. Prepara el worktree y la rama

La rama se llama `<num_issue>-<breve-descripcion>` (kebab-case, minúsculas, sin tildes, 2 a 5 palabras; usa la misma descripción que el plan o, si no la hay, deriva una del título de la issue). Ej.: `42-paginacion-vendehumos`.

1. Ejecuta `git status --short` y `git branch --list development main`. Si hay cambios sin commitear, no los toques: el worktree los deja intactos.
2. Si `development` **no existe**, créala a partir de `main` sin cambiar de rama: `git branch development main`. No la publiques.
3. Asegúrate de que `.claude/worktrees/` no se commitea (comprueba con `git check-ignore .claude/worktrees`; si no está ignorada, añádela a `.git/info/exclude`, no a `.gitignore`).
4. Crea el worktree y la rama desde `development`: `git worktree add .claude/worktrees/<rama> -b <rama> development`. **Todo el trabajo posterior se hace dentro de ese worktree** (rutas y `cd` a `.claude/worktrees/<rama>`); ejecuta `npm install` allí si hace falta.
5. Si la rama o el worktree ya existen, no los recrees ni sobrescribas: pregunta al usuario si continuar en ellos (retomar a medias; salta las tareas ya marcadas `- [x]`).
6. Guarda el plan en `plans/<rama>.md` **dentro del worktree**. Ese archivo es el que se marca (`- [x]`) y se commitea junto con cada tarea.

**Varios agentes**: si el plan tiene bloques de tareas realmente independientes (archivos distintos, sin dependencias entre ellas) y el usuario lo acepta, puedes repartirlos entre subagentes (herramienta Agent), cada uno con su propio worktree `.claude/worktrees/<rama>-<bloque>` y su rama `<rama>-<bloque>` creada desde la rama principal del plan. Cada subagente sigue el paso 3 en su worktree; al terminar, integra sus ramas en `<rama>` (desde su worktree, con `git merge --no-ff`), resuelve conflictos, ejecuta la suite completa y elimina los worktrees auxiliares (`git worktree remove`). Si no hay independencia clara, usa un único worktree.

### 3. Implementa cada tarea con TDD estricto

Recorre las tareas `- [ ]` **en orden**, de una en una. Para cada tarea:

1. **Red**: escribe primero el test (vitest) que describe el comportamiento de la tarea. Ejecútalo (`npx vitest run <archivo>`) y **comprueba que falla** por la razón esperada (no por un error de sintaxis o de import). No escribas código de producción antes de ver el test en rojo.
2. **Green**: escribe el código **mínimo** necesario para que el test pase, en la capa que corresponda. Ejecuta el test y confirma que pasa.
3. **Refactor**: limpia el código manteniendo los tests en verde. Aplica prettier y eslint a los archivos tocados.
4. **Verifica**: ejecuta la suite completa (`npm test`) y comprueba que nada anterior se ha roto. Si algo falla, corrígelo antes de seguir.
5. **Marca la tarea como hecha** en el archivo del plan, cambiando `- [ ]` por `- [x]` solo para esa tarea y solo cuando el test pase con el código implementado.
6. **Commit**: invoca el slash command `/commit` (con la herramienta Skill, skill `commit`) pasando como argumento un contexto breve con el número y título de la tarea. El commit debe incluir el código, el test y el plan actualizado. No hagas `git commit` a mano.

Tareas sin comportamiento testable (instalar dependencias, crear archivos de configuración, documentar en `CLAUDE.md`, etc.):
- No inventes tests artificiales. Verifica el resultado con un comando observable (p. ej. `npm ls`, `npx eslint .`, `npx prettier --check .`, arrancar el comando) y, si pasa, marca la tarea y haz commit igualmente.
- Si la tarea es la que configura vitest y aún no existe, instálalo y configúralo primero, y usa su ejecución como verificación.

### 4. Cierre

- Cuando todas las tareas estén en `- [x]`, recorre los **criterios de aceptación** del plan y comprueba cada uno (tests, ejecución real si procede). Marca `- [x]` los que se cumplan e informa de los que no.
- Ejecuta `git status` y `git log --oneline development..HEAD` en el worktree para confirmar que el árbol está limpio y hay un commit por tarea.

### 5. Crea la PR para revisión

1. Publica la rama: `git push -u origin <rama>` (es el único push permitido).
2. Crea la PR contra `development`, **sin mergearla**: `gh pr create --base development --head <rama> --title "<título>" --body-file <archivo>`.
   - Título en formato Conventional Commits (ej.: `feat(api): paginación de vendehumos`).
   - Cuerpo: resumen de lo implementado, tareas y criterios cumplidos o pendientes, desviaciones del plan, y `Closes #<num_issue>`. Termina con la línea de atribución que corresponda.
   - Si procede, usa `--draft` cuando queden tareas o criterios sin cumplir.
3. **No mergees** la PR, no apruebes ni uses `--auto`: debe revisarla otra persona. Si `gh` falla, informa al usuario del error sin reintentar en bucle.
4. No elimines el worktree principal: el usuario puede necesitarlo para atender los comentarios de la revisión.
5. Responde con: rama, ruta del worktree, URL de la PR, tareas completadas, resultado de la suite de tests y cualquier decisión o desviación respecto al plan.

### 6. Avisa por Slack

- Como último paso, envía un mensaje al canal de Slack `curso-claude-ed3` indicando que el plan ya se ha implementado y la PR está lista para revisar. Usa la herramienta MCP de Slack (`mcp__slack__slack_post_message` para publicar el mensaje en el canal con el id "C0CGZ01R9M2"; si no está cargada, cárgala antes con ToolSearch).
- El mensaje debe incluir el número de issue, la rama y la URL de la PR (ej.: `Ya se ha implementado la issue 42 (rama 42-paginacion-vendehumos), PR lista para revisar: <url>`). Si quedaron tareas sin completar o criterios sin cumplir, indícalo en el mensaje en lugar de decir que está terminado.
- No incluyas datos privados (emails, rutas locales, secretos). Si no se puede enviar el mensaje, informa al usuario del fallo, sin reintentar en bucle.

## Reglas

- Una tarea = un ciclo TDD = un commit. No agrupes varias tareas en un commit ni dejes tareas hechas sin commitear.
- Nunca marques una tarea como hecha si su test no pasa.
- No te saltes el paso rojo del test ni escribas código "por adelantado" de tareas posteriores.
- Si una tarea no se puede completar o el plan es incorrecto, para, explica el problema y pregunta al usuario; no improvises cambios fuera del alcance del plan.
- Trabaja siempre dentro del worktree de `.claude/worktrees/`; no cambies de rama en el directorio principal.
- Solo se permite `git push` de la rama de la tarea (paso 5). Nada de `--force`, `--amend`, `--no-verify`, ni modificar la configuración de git.
- Nunca mergees la PR: la revisa otra persona.
- No toques `main`, salvo para crear `development` a partir de ella.
