#!/usr/bin/env bash
# ============================================================================
# Auxiliar: deposita a mano el token del reto http-01 de ACME
# ============================================================================
# Se ejecuta en una SEGUNDA sesion SSH mientras certbot --manual espera.
#
#   sudo bash crear-reto-acme.sh <NOMBRE_ARCHIVO> <CONTENIDO>
#
# <NOMBRE_ARCHIVO> es la ultima parte de la URL que muestra certbot y
# <CONTENIDO> es la linea larga con el punto en medio (token.thumbprint).
# El archivo NO lleva salto de linea final: por eso el "echo -n".
# ----------------------------------------------------------------------------
set -euo pipefail

DOMINIO="${DOMINIO:-santafe-pineda.shop}"
RAIZ_ACME="/var/www/acme/.well-known/acme-challenge"

[[ $EUID -eq 0 ]] || { echo "Ejecute con sudo."; exit 1; }
[[ $# -eq 2 ]] || { echo "Uso: sudo bash $0 <NOMBRE_ARCHIVO> <CONTENIDO>"; exit 1; }

install -d -m 755 "$RAIZ_ACME"
echo -n "$2" > "${RAIZ_ACME}/$1"
chmod 644 "${RAIZ_ACME}/$1"
chown -R www-data:www-data /var/www/acme

echo "Archivo creado:"
ls -l "${RAIZ_ACME}/$1"
echo "Contenido:"
cat  "${RAIZ_ACME}/$1"; echo

echo
echo "Comprobacion local (debe devolver el mismo contenido, con 200):"
curl -sS -o /dev/null -w '    HTTP %{http_code}\n' "http://127.0.0.1/.well-known/acme-challenge/$1" -H "Host: ${DOMINIO}"
curl -sS "http://127.0.0.1/.well-known/acme-challenge/$1" -H "Host: ${DOMINIO}"; echo
echo
echo "Compruebe tambien desde su portatil:"
echo "    curl http://${DOMINIO}/.well-known/acme-challenge/$1"
echo
echo "Si coincide, vuelva a la sesion de certbot y pulse Enter."
