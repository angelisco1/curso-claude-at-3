#!/usr/bin/env bash
# Hook PreToolUse (matcher: Read|Grep|Bash): impide leer archivos ".env"
# (.env, .env.local, .env.production, ...). El archivo ".env.example" SÍ se puede leer.
# Lee por stdin el JSON del hook y sale con código 2 (bloqueo) si detecta un ".env".

entrada=$(cat)
herramienta=$(printf '%s' "$entrada" | jq -r '.tool_name // ""')

# Dado un texto, devuelve 0 si menciona un ".env" que no sea ".env.example"
menciona_env() {
  printf '%s' "$1" \
    | grep -oE '(^|[/[:space:]"'"'"'=:])\.env(\.[A-Za-z0-9_.-]+)?($|[[:space:]"'"'"';&|)*?])' \
    | sed -E 's/^[^.]*//; s/[^A-Za-z0-9_.-]+$//' \
    | grep -qvE '^\.env\.example$'
}

case "$herramienta" in
  Read)
    texto=$(printf '%s' "$entrada" | jq -r '.tool_input.file_path // ""')
    ;;
  Grep)
    texto=$(printf '%s' "$entrada" | jq -r '[.tool_input.path // "", .tool_input.glob // ""] | join(" ")')
    ;;
  Bash)
    texto=$(printf '%s' "$entrada" | jq -r '.tool_input.command // ""')
    ;;
  *)
    exit 0
    ;;
esac

# Para Read/Grep el valor puede ser una ruta completa: se añade un espacio final
# para que el patrón detecte el nombre del archivo al final de la ruta.
if menciona_env "$texto "; then
  echo 'Bloqueado: no se permite leer archivos .env (pueden contener secretos). Usa .env.example si necesitas ver las variables.' >&2
  exit 2
fi

exit 0
