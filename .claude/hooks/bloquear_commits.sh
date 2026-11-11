#!/usr/bin/env bash
# Hook PreToolUse (matcher: Bash): impide que el agente genere commits.
# Lee por stdin el JSON del hook y sale con código 2 (bloqueo) si el comando
# contiene "git commit", también encadenado (&&, ;, |) o con opciones
# como "git -C <dir> commit" o "git -c clave=valor commit".

comando=$(jq -r '.tool_input.command // ""')

patron='(^|[;&|(]|[[:space:]])git([[:space:]]+(-[Cc][[:space:]]+[^[:space:]]+|-[^[:space:]]+))*[[:space:]]+commit([[:space:]]|$)'

##################################################
#### DESCOMENTAR PARA QUE BLOQUEE LOS COMMITS ####
##################################################

# if printf '%s' "$comando" | grep -Eq "$patron"; then
#   echo 'Bloqueado: el agente no puede crear commits. Los commits los hace el usuario.' >&2
#   exit 2
# fi

exit 0
