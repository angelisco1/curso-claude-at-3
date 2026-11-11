#!/usr/bin/env bash
# Valida docs/api/openapi.yml con Redocly y genera la documentación HTML.
#
# Uso: generar_docs.sh [--solo-validar]
#   --solo-validar  Solo ejecuta el lint, sin generar el HTML.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# .claude/skills/actualizar-docs-api/scripts -> raíz del proyecto
RAIZ="$(cd "${SCRIPT_DIR}/../../../.." && pwd)"

OPENAPI="${RAIZ}/docs/api/openapi.yml"
SALIDA="${RAIZ}/docs/api/openapi.html"
REDOCLY=(npx --yes @redocly/cli)

error() {
  echo "Error: $*" >&2
  exit 1
}

SOLO_VALIDAR=0
case "${1:-}" in
  '') ;;
  --solo-validar) SOLO_VALIDAR=1 ;;
  *) error "argumento desconocido: $1 (uso: generar_docs.sh [--solo-validar])" ;;
esac

[[ -f "${OPENAPI}" ]] || error "no existe ${OPENAPI}"
command -v npx >/dev/null 2>&1 || error "npx no está instalado (hace falta Node.js)"

cd "${RAIZ}"

echo "Validando docs/api/openapi.yml..."
"${REDOCLY[@]}" lint "${OPENAPI}" || error "el contrato OpenAPI no es válido"

if [[ "${SOLO_VALIDAR}" -eq 1 ]]; then
  echo "Contrato válido (generación de HTML omitida)."
  exit 0
fi

echo "Generando documentación HTML..."
"${REDOCLY[@]}" build-docs "${OPENAPI}" --output "${SALIDA}" \
  || error "no se pudo generar el HTML"

[[ -s "${SALIDA}" ]] || error "el HTML generado está vacío: ${SALIDA}"
echo "Documentación generada en docs/api/openapi.html"
