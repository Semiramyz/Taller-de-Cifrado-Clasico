#!/usr/bin/env bash
# ============================================================================
# 01 - CERTIFICADO AUTOFIRMADO  (etapa 2 del taller)
# ============================================================================
# Reproduce, paso por paso y a mano, el procedimiento del enlace indicado en el
# enunciado (blog.alcancelibre.org "Como configurar Apache con SSL"), adaptado
# a nginx sobre Ubuntu. Son tres operaciones de OpenSSL:
#
#   1) generar la llave privada RSA
#   2) generar una solicitud de firma (CSR) con los datos del titular
#   3) firmar esa solicitud con la propia llave  <-- de ahi "autofirmado"
#
# El paso 3 es exactamente lo que hace distinto a este certificado: en un
# certificado real ese paso lo ejecuta una Autoridad Certificadora con su
# propia llave, y es su firma la que el navegador reconoce.
#
#   sudo bash 01-certificado-autofirmado.sh
# ----------------------------------------------------------------------------
set -euo pipefail

DOMINIO="${DOMINIO:-santafe-pineda.shop}"
DIAS=825          # maximo que aceptan los navegadores para un certificado de servidor
DIR_CERT="/etc/ssl/certs"
DIR_KEY="/etc/ssl/private"
ASUNTO="/C=CO/ST=Santander/L=Bucaramanga/O=Programa de Ingenieria de Sistemas/OU=Seguridad de la Informacion/CN=${DOMINIO}"

[[ $EUID -eq 0 ]] || { echo "Ejecute con sudo."; exit 1; }
RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"

echo "==> 1. Llave privada RSA de 2048 bits"
openssl genrsa -out "${DIR_KEY}/${DOMINIO}.key" 2048
# En Debian y Ubuntu /etc/ssl/private pertenece al grupo ssl-cert. El proceso
# maestro de nginx lee el certificado como root, antes de bajar privilegios.
chmod 640 "${DIR_KEY}/${DOMINIO}.key"
chown root:ssl-cert "${DIR_KEY}/${DOMINIO}.key" 2>/dev/null || chown root:root "${DIR_KEY}/${DOMINIO}.key"

echo "==> 2. Solicitud de firma (CSR)"
openssl req -new \
    -key  "${DIR_KEY}/${DOMINIO}.key" \
    -out  "${DIR_CERT}/${DOMINIO}.csr" \
    -subj "${ASUNTO}"

echo "==> 3. Extensiones X.509v3"
# Sin subjectAltName los navegadores actuales rechazan el certificado con
# ERR_CERT_COMMON_NAME_INVALID: desde 2017 ya no miran el campo CN.
cat > /tmp/${DOMINIO}.ext <<EXT
basicConstraints = critical, CA:FALSE
keyUsage         = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName   = DNS:${DOMINIO}, DNS:www.${DOMINIO}
EXT

echo "==> 4. Autofirma del certificado"
openssl x509 -req -days "${DIAS}" -sha256 \
    -in      "${DIR_CERT}/${DOMINIO}.csr" \
    -signkey "${DIR_KEY}/${DOMINIO}.key" \
    -extfile "/tmp/${DOMINIO}.ext" \
    -out     "${DIR_CERT}/${DOMINIO}.crt"
rm -f "/tmp/${DOMINIO}.ext"
chmod 644 "${DIR_CERT}/${DOMINIO}.crt"

echo "==> 5. Parametros Diffie-Hellman (tarda un par de minutos)"
[[ -f "${DIR_KEY}/dhparam.pem" ]] || openssl dhparam -out "${DIR_KEY}/dhparam.pem" 2048
chmod 644 "${DIR_KEY}/dhparam.pem"

echo "==> 6. Verificacion del certificado generado"
openssl x509 -in "${DIR_CERT}/${DOMINIO}.crt" -noout \
    -subject -issuer -dates -serial \
    -ext subjectAltName
echo
echo "Emisor y titular son el mismo: esa es la 'problematica asociada'."

echo "==> 7. Activacion en nginx"
cp "${RAIZ}/deploy/nginx/02-autofirmado.conf" "/etc/nginx/sites-available/${DOMINIO}"
ln -sf "/etc/nginx/sites-available/${DOMINIO}" "/etc/nginx/sites-enabled/${DOMINIO}"
nginx -t
systemctl reload nginx

cat <<FIN

Archivos creados:
  ${DIR_KEY}/${DOMINIO}.key    llave privada  (640 root:ssl-cert)
  ${DIR_CERT}/${DOMINIO}.csr   solicitud de firma
  ${DIR_CERT}/${DOMINIO}.crt   certificado autofirmado
  ${DIR_KEY}/dhparam.pem       parametros Diffie-Hellman

Archivo de nginx modificado:
  /etc/nginx/sites-available/${DOMINIO}   (ssl_certificate y ssl_certificate_key)
  enlazado desde /etc/nginx/sites-enabled/${DOMINIO}

Evidencia 2 del informe:
  - https://${DOMINIO} en Firefox -> pantalla de advertencia
    "Advertencia: riesgo probable de seguridad" con el codigo
    SEC_ERROR_UNKNOWN_ISSUER. Capturar tambien el detalle del certificado
    (Ver certificado -> Emitido por = el propio dominio).
  - Prueba desde consola, sin aceptar la excepcion:
        openssl s_client -connect ${DOMINIO}:443 -servername ${DOMINIO} </dev/null | head -20
    Debe aparecer "verify error:num=18:self-signed certificate".
  - SSL Server Test (ssllabs.com/ssltest) sobre este dominio dara calificacion T:
    el canal cifra bien, pero la identidad no la respalda nadie.

Siguiente paso: sudo bash deploy/scripts/02-letsencrypt-manual.sh
FIN
