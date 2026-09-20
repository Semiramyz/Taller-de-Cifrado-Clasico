#!/usr/bin/env bash
# ============================================================================
# 00 - Preparacion del servidor (Ubuntu 22.04 / 24.04 sobre AWS EC2)
# ============================================================================
# Deja el servidor listo para las tres etapas del taller: nginx instalado, la
# aplicacion Angular SSR corriendo en 127.0.0.1:4000, el cortafuegos abierto y
# el sitio respondiendo por HTTP sin cifrar (etapa 1).
#
#   sudo bash 00-preparar-servidor.sh
# ----------------------------------------------------------------------------
set -euo pipefail

DOMINIO="${DOMINIO:-santafe-pineda.shop}"
DESTINO="/opt/taller-cifrado"
USUARIO="taller"

[[ $EUID -eq 0 ]] || { echo "Ejecute con sudo."; exit 1; }
cd "$(dirname "$0")/../.."   # raiz del proyecto
RAIZ="$(pwd)"

echo "==> 0. El puerto 4000 debe estar libre"
# Si otra cosa ya escucha en el 4000 -tipicamente un despliegue anterior bajo
# pm2- el servicio systemd de mas abajo no podra arrancar. systemd lo reporta
# como un fallo discreto y nginx sigue reenviando al proceso viejo, de modo que
# el sitio parece funcionar pero sirve la aplicacion equivocada.
DUENO_4000=$(ss -lntpH 'sport = :4000' 2>/dev/null | grep -oP 'pid=\K[0-9]+' | head -1)
if [[ -n "$DUENO_4000" ]] && ! systemctl is-active --quiet taller-cifrado; then
    echo "    El puerto 4000 lo ocupa el PID ${DUENO_4000}:"
    ps -o pid,ppid,user,args= -p "$DUENO_4000" | sed 's/^/      /'
    UNIDAD=$(systemctl status "$DUENO_4000" 2>/dev/null | head -1 | grep -oP '[\w@.-]+\.service' | head -1)
    [[ -n "$UNIDAD" ]] && echo "    Lo gobierna la unidad: ${UNIDAD}"
    cat <<AYUDA

    Libere el puerto antes de continuar. Si es un despliegue anterior con pm2:

        pm2 delete all && pm2 save
        sudo systemctl disable --now pm2-ubuntu

    Si es un servicio de systemd:

        sudo systemctl disable --now ${UNIDAD:-NOMBRE.service}

AYUDA
    exit 1
fi
echo "    Puerto 4000 disponible."

echo "==> 0b. Memoria de intercambio"
# La instancia t3.micro tiene 1 GB de RAM y la compilacion de Angular se queda
# sin memoria: el proceso muere sin mensaje claro. El swap lo evita.
MEM_MB=$(free -m | awk '/^Mem:/ {print $2}')
if [[ $MEM_MB -lt 2000 && ! -f /swapfile ]]; then
    echo "    Solo ${MEM_MB} MB de RAM: creando 2 GB de swap."
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
free -h

echo "==> 1. Paquetes"
export DEBIAN_FRONTEND=noninteractive
apt-get update
# build-essential y python3 hacen falta porque bcrypt es un modulo nativo y no
# siempre hay binario precompilado para la version de Node que instalamos.
apt-get install -y nginx openssl git curl ca-certificates build-essential python3

echo "==> 2. Node.js 24"
# Los repositorios de Ubuntu traen una version de Node demasiado antigua: la
# aplicacion usa el modulo interno node:sqlite y process.loadEnvFile, que solo
# estan disponibles sin opciones experimentales a partir de Node 23.
if ! node --version 2>/dev/null | grep -qE '^v(2[4-9]|[3-9][0-9])'; then
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
    apt-get install -y nodejs
fi
node --version && npm --version

echo "==> 3. Usuario de servicio y despliegue de la aplicacion"
id -u "$USUARIO" &>/dev/null || useradd --system --home-dir "$DESTINO" --shell /usr/sbin/nologin "$USUARIO"
npm ci
npm run build
install -d -o "$USUARIO" -g "$USUARIO" "$DESTINO" "$DESTINO/data"
cp -r dist package.json package-lock.json "$DESTINO/"
cp -r node_modules "$DESTINO/"        # bcrypt es un binario nativo: no se empaqueta
# database/ es imprescindible: la primera vez que arranca, el repositorio SQLite
# lee database/schema.sqlite.sql (ruta relativa al WorkingDirectory del servicio)
# para crear las tablas y los usuarios iniciales. Sin esta carpeta el inicio de
# sesion falla con ENOENT en cuanto alguien envia el formulario.
cp -r database "$DESTINO/"
[[ -f .env ]] && install -o "$USUARIO" -g "$USUARIO" -m 600 .env "$DESTINO/.env"
chown -R "$USUARIO:$USUARIO" "$DESTINO"

echo "==> 4. Servicio systemd"
cp deploy/systemd/taller-cifrado.service /etc/systemd/system/
# Volver a la etapa 1: se retira el suplemento que enciende HTTPS, por si este
# guion se reejecuta despues de haber pasado por el certificado autofirmado.
rm -f /etc/systemd/system/taller-cifrado.service.d/https.conf
rmdir /etc/systemd/system/taller-cifrado.service.d 2>/dev/null || true
systemctl daemon-reload
systemctl enable taller-cifrado
# restart y no "enable --now": este ultimo arranca el servicio solo si estaba
# parado, de modo que al redesplegar dejaria vivo el proceso anterior con el
# dist/ y la unidad antiguos. El sitio pareceria actualizado y no lo estaria.
systemctl restart taller-cifrado
sleep 3
systemctl --no-pager --lines=10 status taller-cifrado || true
if ! ss -lntH 'sport = :4000' | grep -q 4000; then
    echo
    echo "ERROR: el servicio no quedo escuchando en el puerto 4000."
    echo "Revise la causa con:  journalctl -u taller-cifrado -n 50 --no-pager"
    exit 1
fi
echo "    Servicio activo y escuchando en 127.0.0.1:4000."

echo "==> 5. Fragmentos de nginx"
install -d /etc/nginx/snippets
cp deploy/nginx/snippets/proxy-node.conf     /etc/nginx/snippets/
cp deploy/nginx/snippets/tls-parametros.conf /etc/nginx/snippets/
# Una version anterior de este material dejaba los parametros TLS en conf.d/,
# que es contexto http, donde chocan con las directivas que el propio
# nginx.conf de Ubuntu ya declara:
#   "ssl_prefer_server_ciphers" directive is duplicate
rm -f /etc/nginx/conf.d/tls-parametros.conf
# Carpeta donde se depositara a mano el token del reto ACME (etapa 3).
install -d -m 755 /var/www/acme/.well-known/acme-challenge
chown -R www-data:www-data /var/www/acme

echo "==> 6. Cortafuegos"
# Nota: en AWS el filtrado real lo hace el Security Group de la instancia.
# ufw es una segunda capa; se abre SSH ANTES de activarlo para no quedarse
# fuera del servidor.
ufw allow OpenSSH
ufw allow 'Nginx Full'          # abre 80 y 443
ufw --force enable
ufw status verbose

echo "==> 7. Etapa 1: sitio SIN certificado (primera evidencia del informe)"
# Ubuntu trae un sitio "default" activado que ocupa el puerto 80 como
# default_server. Si se deja, nginx aborta con "duplicate default server".
rm -f /etc/nginx/sites-enabled/default
cp deploy/nginx/01-sin-ssl.conf "/etc/nginx/sites-available/${DOMINIO}"
ln -sf "/etc/nginx/sites-available/${DOMINIO}" "/etc/nginx/sites-enabled/${DOMINIO}"
nginx -t
systemctl enable --now nginx
systemctl reload nginx

cat <<FIN

Listo. El sitio responde en http://${DOMINIO} SIN cifrado.

Comprobacion rapida:
    systemctl status taller-cifrado --no-pager
    curl -I http://${DOMINIO}/login          # 200 o 302, nunca 502

Evidencia 1 del informe:
  - Abrir http://${DOMINIO} en Firefox y capturar el candado tachado y el aviso
    "Esta conexion no es segura" del formulario de inicio de sesion.
  - Opcional, mucho mas contundente: capturar el POST /api/auth/login.
    NO filtre por "host ${DOMINIO}": en AWS los paquetes llegan dirigidos a la
    IP privada de la instancia, no a la elastica, y la captura saldria vacia.
      sudo tcpdump -i any -s0 -w /tmp/captura.pcap 'tcp port 80'
      # inicie sesion en el navegador, luego Ctrl+C, y lea la captura:
      sudo tcpdump -r /tmp/captura.pcap -A | grep -A25 'POST /api/auth/login'
    Se vera el usuario y la contrasena en texto plano.

Siguiente paso: sudo bash deploy/scripts/01-certificado-autofirmado.sh
FIN
