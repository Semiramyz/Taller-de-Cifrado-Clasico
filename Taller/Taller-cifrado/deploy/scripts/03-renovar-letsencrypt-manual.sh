#!/usr/bin/env bash
# ============================================================================
# 03 - RENOVACION MANUAL cada 90 dias
# ============================================================================
# Corresponde a la opcion 1 del enunciado ("stand alone"): no hay cron ni
# temporizador, la renovacion la lanza una persona.
#
# Un certificado emitido con --manual y reto http-01 NO puede renovarse solo
# por diseno: certbot vuelve a pedir el token. Por eso "certbot renew" no basta
# y hay que repetir la emision con --force-renewal.
#
#   sudo bash 03-renovar-letsencrypt-manual.sh
# ----------------------------------------------------------------------------
set -euo pipefail

DOMINIO="${DOMINIO:-santafe-pineda.shop}"
CORREO="${CORREO:-js0207367@gmail.com}"

[[ $EUID -eq 0 ]] || { echo "Ejecute con sudo."; exit 1; }

echo "==> Vigencia actual"
openssl x509 -in "/etc/letsencrypt/live/${DOMINIO}/cert.pem" -noout -dates
DIAS_RESTANTES=$(( ( $(date -d "$(openssl x509 -in "/etc/letsencrypt/live/${DOMINIO}/cert.pem" -noout -enddate | cut -d= -f2)" +%s) - $(date +%s) ) / 86400 ))
echo "    Quedan ${DIAS_RESTANTES} dias."
[[ $DIAS_RESTANTES -gt 30 ]] && echo "    Aun no es necesario renovar (se renueva con <=30 dias)."

read -rp "Renovar ahora? [s/N] " r; [[ "${r,,}" == "s" ]] || exit 0

echo "==> Nueva emision manual (certbot volvera a pedir el token)"
certbot certonly \
    --manual \
    --preferred-challenges http \
    --force-renewal \
    --agree-tos --no-eff-email -m "${CORREO}" \
    -d "${DOMINIO}" -d "www.${DOMINIO}"

echo "==> Recarga de nginx"
# La configuracion no cambia: live/ apunta ya a los archivos nuevos. Solo hay
# que recargar para que nginx lea el certificado nuevo de disco.
nginx -t
systemctl reload nginx
openssl x509 -in "/etc/letsencrypt/live/${DOMINIO}/cert.pem" -noout -dates -serial
