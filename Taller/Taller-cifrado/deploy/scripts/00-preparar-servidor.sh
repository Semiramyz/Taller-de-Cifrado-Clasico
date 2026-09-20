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

echo "==> 0. Memoria de intercambio"
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
systemctl daemon-reload
systemctl enable --now taller-cifrado
sleep 2
systemctl --no-pager --lines=10 status taller-cifrado || true

echo "==> 5. Fragmentos y parametros de nginx"
install -d /etc/nginx/snippets
cp deploy/nginx/snippets/proxy-node.conf /etc/nginx/snippets/
cp deploy/nginx/tls-parametros.conf      /etc/nginx/conf.d/
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
  - Opcional, mucho mas contundente: capturar el POST /api/auth/login con
      sudo tcpdump -i any -A -s0 'tcp port 80 and host ${DOMINIO}'
    Se vera el usuario y la contrasena en texto plano.

Siguiente paso: sudo bash deploy/scripts/01-certificado-autofirmado.sh
FIN
