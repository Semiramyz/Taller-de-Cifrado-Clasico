#!/usr/bin/env bash
# ============================================================================
# 02 - CERTIFICADO LET'S ENCRYPT, EMISION E INSTALACION MANUALES (etapa 3)
# ============================================================================
#
#  >>> ESTE ES EL PUNTO CALIFICABLE DEL TALLER <<<
#
# El enunciado exige crear y activar el certificado A MANO. Hacerlo de forma
# automatica descuenta 1.5 unidades de la nota. En la practica eso significa
# tres decisiones concretas, y las tres estan tomadas en este script:
#
#   1. Se usa  certbot certonly  y NO  certbot --nginx.
#      "certonly" emite el certificado y lo deja en el disco, sin tocar ni una
#      linea de la configuracion del servidor web. El instalador automatico
#      (--nginx) reescribiria /etc/nginx/sites-available/... por su cuenta, que
#      es justo lo que el ejercicio pide evitar.
#
#   2. El reto se resuelve con  --manual  y NO con  --webroot.
#      Certbot se detiene y pide que el token se escriba a mano en el servidor.
#      Con --webroot certbot lo depositaria solo: seguiria siendo valido, pero
#      no demostraria que se sabe donde vive el archivo.
#
#   3. Se desactiva la renovacion automatica (certbot.timer y el cron de
#      /etc/cron.d/certbot). Corresponde a la opcion 1 del enunciado: "stand
#      alone, cada 90 dias usted debe renovar los certificados manualmente"
#      (ver 03-renovar-letsencrypt-manual.sh).
#
#   sudo bash 02-letsencrypt-manual.sh
# ----------------------------------------------------------------------------
set -euo pipefail

DOMINIO="${DOMINIO:-santafe-pineda.shop}"
CORREO="${CORREO:-js0207367@gmail.com}"

[[ $EUID -eq 0 ]] || { echo "Ejecute con sudo."; exit 1; }
RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"

echo "==> 1. Comprobaciones previas"
# Let's Encrypt valida contra el DNS publico: si el registro A no apunta a esta
# instancia la emision falla con "Invalid response ... 404" o "DNS problem".
IP_SERVIDOR="$(curl -fsS https://api.ipify.org || echo '?')"
IP_DNS="$(getent hosts "$DOMINIO" | awk '{print $1; exit}' || echo '?')"
echo "    IP publica de la instancia : ${IP_SERVIDOR}"
echo "    Registro A de ${DOMINIO} : ${IP_DNS}"
if [[ "$IP_SERVIDOR" != "$IP_DNS" ]]; then
    echo "    AVISO: no coinciden. Corrija el DNS antes de continuar."
    read -rp "    Continuar de todos modos? [s/N] " r; [[ "${r,,}" == "s" ]] || exit 1
fi
ss -lntp | grep -E ':80|:443' || true

echo "==> 1b. La etapa 2 debe estar completa"
# Si falta cualquiera de estas piezas, "nginx -t" fallaria al final de este
# guion, DESPUES de haber gastado una emision de Let's Encrypt. Se comprueba
# antes de tocar nada.
FALTA=0
for ARCHIVO in /etc/ssl/private/dhparam.pem                /etc/nginx/snippets/tls-parametros.conf                /etc/nginx/snippets/proxy-node.conf; do
    if [[ ! -f "$ARCHIVO" ]]; then
        echo "    FALTA: ${ARCHIVO}"
        FALTA=1
    fi
done
if [[ $FALTA -eq 1 ]]; then
    echo
    echo "Ejecute antes:  sudo bash deploy/scripts/01-certificado-autofirmado.sh"
    echo "Ese guion genera los parametros Diffie-Hellman y deja la etapa 2 lista."
    exit 1
fi
echo "    Etapa 2 completa."

echo "==> 2. Instalacion de certbot SIN el plugin de nginx"
export DEBIAN_FRONTEND=noninteractive
apt-get update
# A proposito NO se instala python3-certbot-nginx: sin ese paquete la opcion
# --nginx ni siquiera esta disponible, lo que garantiza la instalacion manual.
apt-get install -y certbot
dpkg -l python3-certbot-nginx 2>/dev/null | grep -q '^ii' \
    && echo "    AVISO: el plugin --nginx esta instalado; no lo use." || true
certbot --version

echo "==> 3. Desactivacion de la renovacion automatica"
# En Ubuntu el paquete instala certbot.timer (y en versiones antiguas tambien
# un cron). Se desactivan los dos.
systemctl disable --now certbot.timer 2>/dev/null || true
systemctl mask certbot.timer 2>/dev/null || true
rm -f /etc/cron.d/certbot
systemctl list-timers --all 2>/dev/null | grep -i certbot || echo "    Sin temporizadores de certbot. Correcto."

echo "==> 4. Carpeta del reto ACME"
install -d -m 755 /var/www/acme/.well-known/acme-challenge
chown -R www-data:www-data /var/www/acme

cat <<'AVISO'

--------------------------------------------------------------------------
 ATENCION: certbot va a DETENERSE y a mostrar un texto parecido a este:

     Create a file containing just this data:

     abcdef...token....xyz.MnO-largoHashDeLaCuenta

     And make it available on your web server at this URL:

     http://santafe-pineda.shop/.well-known/acme-challenge/abcdef...token....xyz

 NO pulse Enter todavia. Abra una SEGUNDA sesion SSH y cree ese archivo con
 el script auxiliar (copie el nombre y el contenido del mensaje de certbot):

     sudo bash deploy/scripts/crear-reto-acme.sh <NOMBRE_ARCHIVO> <CONTENIDO>

 Compruebe desde su portatil que el token se lee:

     curl http://santafe-pineda.shop/.well-known/acme-challenge/<NOMBRE_ARCHIVO>

 Solo entonces vuelva a esta sesion y pulse Enter.
 Capture las dos pantallas: son la evidencia de que la emision fue manual.
--------------------------------------------------------------------------

AVISO
read -rp "Pulse Enter para lanzar certbot..." _

echo "==> 5. Emision del certificado (reto http-01 resuelto a mano)"
certbot certonly \
    --manual \
    --preferred-challenges http \
    --agree-tos \
    --no-eff-email \
    -m "${CORREO}" \
    -d "${DOMINIO}" \
    -d "www.${DOMINIO}"

echo "==> 6. Archivos que acaba de crear certbot"
ls -l  "/etc/letsencrypt/live/${DOMINIO}/"
echo "    (los cuatro son enlaces simbolicos hacia archive/)"
ls -l  "/etc/letsencrypt/archive/${DOMINIO}/"
echo "    Parametros de la emision, para la renovacion posterior:"
cat    "/etc/letsencrypt/renewal/${DOMINIO}.conf"
echo
openssl x509 -in "/etc/letsencrypt/live/${DOMINIO}/cert.pem" -noout \
    -subject -issuer -dates -ext subjectAltName

echo "==> 7. Activacion manual en nginx"
# Este es el segundo tramo "manual": somos nosotros, y no certbot, quienes
# escribimos las directivas ssl_certificate en la configuracion del servidor.
cp "/etc/nginx/sites-available/${DOMINIO}" "/etc/nginx/sites-available/${DOMINIO}.autofirmado.bak"
cp "${RAIZ}/deploy/nginx/03-letsencrypt.conf" "/etc/nginx/sites-available/${DOMINIO}"
nginx -t
systemctl reload nginx

cat <<FIN

Certificado activo. Archivos implicados:

  CREADOS POR CERTBOT
    /etc/letsencrypt/live/${DOMINIO}/fullchain.pem   certificado + cadena intermedia
    /etc/letsencrypt/live/${DOMINIO}/privkey.pem     llave privada
    /etc/letsencrypt/live/${DOMINIO}/chain.pem       cadena intermedia
    /etc/letsencrypt/live/${DOMINIO}/cert.pem        certificado del sitio
    /etc/letsencrypt/renewal/${DOMINIO}.conf         parametros de renovacion

  MODIFICADO A MANO POR USTED
    /etc/nginx/sites-available/${DOMINIO}            ssl_certificate, ssl_certificate_key,
                                                     ssl_trusted_certificate, HSTS y el
                                                     bloque 301 del puerto 80
    /etc/nginx/snippets/tls-parametros.conf          protocolos y suites
    (copia de seguridad de la etapa anterior en ${DOMINIO}.autofirmado.bak)

Evidencia 3 del informe:
    bash deploy/scripts/04-verificar-tls.sh

CERTIFICADO COMODIN (punto 6 del enunciado, opcional)
El reto http-01 no sirve para comodines; hay que usar dns-01, tambien manual:

    sudo certbot certonly --manual --preferred-challenges dns \\
         -d ${DOMINIO} -d '*.${DOMINIO}' --agree-tos -m ${CORREO}

Certbot pedira crear un registro TXT llamado _acme-challenge.${DOMINIO} con el
valor que indique. Se crea en el panel DNS del registrador, se comprueba con

    dig +short TXT _acme-challenge.${DOMINIO} @1.1.1.1

y solo cuando ya responde se pulsa Enter.
FIN
