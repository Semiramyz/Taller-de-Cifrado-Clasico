#!/usr/bin/env bash
# ============================================================================
# Auxiliar: deposita a mano el token del reto http-01 de ACME
# ============================================================================
# Se ejecuta en una SEGUNDA sesion SSH mientras certbot --manual espera.
#
#   sudo bash crear-reto-acme.sh <CONTENIDO>
#
# <CONTENIDO> es la linea larga con un punto en medio que muestra certbot,
# pegada entera. El nombre del archivo NO hay que darlo: es exactamente la
# parte anterior al punto, y el guion la deduce. Asi hay un solo valor que
# copiar y una posibilidad menos de equivocarse.
#
# Ejemplo real:
#   contenido : Gz4tVZgkmYec0eCYEXUIPbOFdzXRS-Pd0BF9PN8HvCA.P4FM-pvageWj9ptcqA24
#   archivo   : Gz4tVZgkmYec0eCYEXUIPbOFdzXRS-Pd0BF9PN8HvCA
#
# El archivo no lleva salto de linea final: por eso el "echo -n". El servidor
# de validacion compara el contenido byte a byte.
# ----------------------------------------------------------------------------
set -euo pipefail

DOMINIO="${DOMINIO:-santafe-pineda.shop}"
RAIZ_ACME="/var/www/acme/.well-known/acme-challenge"

[[ $EUID -eq 0 ]] || { echo "Ejecute con sudo."; exit 1; }

if [[ $# -lt 1 || $# -gt 2 ]]; then
    cat <<USO
Uso: sudo bash $0 <CONTENIDO>

Pegue la linea larga que muestra certbot, la que tiene un punto en medio.
No hay que indicar el nombre del archivo: se deduce del propio contenido.
USO
    exit 1
fi

# Con dos argumentos se admite la forma antigua <NOMBRE> <CONTENIDO>, pero el
# nombre se ignora y se recalcula: si no coincidieran, el reto fallaria.
CONTENIDO="${!#}"

# --- Comprobaciones antes de escribir nada -------------------------------
# El error mas caro de este taller es pegar los marcadores del manual en lugar
# de los valores reales: certbot no se entera, Let's Encrypt responde 404 y se
# consume uno de los cinco intentos por hora que permite el servicio.
if [[ "$CONTENIDO" == "CONTENIDO" || "$CONTENIDO" == "NOMBRE_ARCHIVO" || "$CONTENIDO" == "<CONTENIDO>" ]]; then
    echo "ERROR: '${CONTENIDO}' es el marcador del manual, no un valor real."
    echo "Copie la linea larga que certbot tiene en pantalla, con el punto en medio."
    exit 1
fi
if [[ "$CONTENIDO" != *.* ]]; then
    echo "ERROR: el contenido debe llevar un punto en medio (token.huella)."
    echo "Recibido: ${CONTENIDO}"
    echo "Copie la linea entera que muestra certbot, sin cortarla."
    exit 1
fi
if [[ ${#CONTENIDO} -lt 60 ]]; then
    echo "ERROR: el contenido parece incompleto (${#CONTENIDO} caracteres; se esperan unos 87)."
    echo "Copie la linea entera que muestra certbot."
    exit 1
fi

# El nombre del archivo es el token: la parte anterior al primer punto.
ARCHIVO="${CONTENIDO%%.*}"

install -d -m 755 "$RAIZ_ACME"
echo -n "$CONTENIDO" > "${RAIZ_ACME}/${ARCHIVO}"
chmod 644 "${RAIZ_ACME}/${ARCHIVO}"
chown -R www-data:www-data /var/www/acme

echo "Archivo creado:"
ls -l "${RAIZ_ACME}/${ARCHIVO}"
echo "Contenido:"
cat  "${RAIZ_ACME}/${ARCHIVO}"; echo

echo
echo "Comprobacion contra nginx (debe devolver 200 y el mismo contenido):"
for D in "${DOMINIO}" "www.${DOMINIO}"; do
    CODIGO=$(curl -sS -o /dev/null -w '%{http_code}' \
             --resolve "${D}:80:127.0.0.1" \
             "http://${D}/.well-known/acme-challenge/${ARCHIVO}" 2>/dev/null || echo '---')
    echo "    ${D} -> HTTP ${CODIGO}"
done

echo
echo "Retos presentes ahora mismo (deben acumularse, no sustituirse):"
ls -1 "$RAIZ_ACME" | sed 's/^/    /'

echo
echo "Si el codigo es 200, vuelva a la sesion de certbot y pulse Enter."
