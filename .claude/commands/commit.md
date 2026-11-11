---
description: Crea un commit siguiendo la especificación de Conventional Commits
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git add:*), Bash(git commit:*)
disallowed-tools: Bash(git init:*)
argument-hint: [contexto opcional sobre el cambio]
---


## Contexto

- Estado actual: !`git status --short`
- Cambios staged y unstaged: !`git diff HEAD`
- Rama actual: !`git branch --show-current`
- Últimos commits (para seguir el estilo): !`git log --oneline -10`

## Tarea

Crea un único commit con los cambios actuales siguiendo la especificación [Conventional Commits 1.0.0](https://www.conventionalcommits.org/es/v1.0.0/).

Contexto adicional del usuario (opcional): $ARGUMENTS

### Formato

```
<tipo>[ámbito opcional][!]: <descripción>

[cuerpo opcional]

[pie(s) opcional(es)]
```

### Tipos permitidos

- `feat`: nueva funcionalidad (SemVer MINOR).
- `fix`: corrección de un bug (SemVer PATCH).
- `docs`: cambios solo en documentación.
- `style`: formato que no afecta al significado del código (espacios, comillas, punto y coma).
- `refactor`: cambio de código que no corrige un bug ni añade funcionalidad.
- `perf`: mejora de rendimiento.
- `test`: añadir o corregir tests.
- `build`: cambios en el sistema de build o dependencias.
- `ci`: cambios en la configuración de CI.
- `chore`: tareas de mantenimiento que no tocan `src` ni tests.
- `revert`: revierte un commit anterior.

### Reglas

1. La descripción va en **minúsculas**, en **imperativo**, sin punto final y con un máximo de ~72 caracteres en la primera línea.
2. El **ámbito** (opcional) es un sustantivo entre paréntesis que indica la zona afectada, por ejemplo `feat(vendehumos): ...` o `fix(db): ...`.
3. Si hay un **breaking change**, añade `!` tras el tipo/ámbito y/o un pie `BREAKING CHANGE: <explicación>`.
4. El **cuerpo** (separado por una línea en blanco) explica el *qué* y el *porqué*, no el *cómo*. Solo inclúyelo si aporta valor.
5. Los **pies** usan el formato `Token: valor` (por ejemplo `Refs: #123`).
6. Escribe el mensaje en español, salvo el tipo, que siempre va en inglés.
7. Si los cambios mezclan varios tipos o propósitos distintos, propón dividirlos en varios commits y pregunta al usuario antes de continuar.

### Pasos

0. Si el proyecto no está inicializado, inicializalo primero con `git init`.
1. Analiza los cambios del contexto y determina el tipo y el ámbito más adecuados.
2. Si no hay nada en staging, añade solo los archivos relevantes con `git add <archivos>` (nunca `git add -A` a ciegas, y no incluyas ficheros sensibles como `.env` ni `*.db`).
3. Antes de hacer el commit, muestrale al usuario el mensaje de commit que vas a utilizar y preguntale con la tool `AskUserQuestion` si le parece bien, o prefiere otro mensaje. Si quiere otro mensaje, genera otra versión del mensaje y vuelve a preguntarle. Dale la opción a que el ponga el mensaje también.
4. Crea el commit con `git commit -m` usando un HEREDOC para respetar saltos de línea.
5. Termina el mensaje del commit con la línea de atribución:

   ```
   Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
   ```

6. Ejecuta `git status` al final para confirmar que el commit se ha creado y muestra el mensaje resultante.

### Restricciones

- No hagas `git push`.
- No uses `--amend`, `--no-verify` ni modifiques la configuración de git.
- Si un hook de pre-commit falla, corrige el problema y crea un commit **nuevo**.
- Si no hay cambios que commitear, indícalo y no crees un commit vacío.
