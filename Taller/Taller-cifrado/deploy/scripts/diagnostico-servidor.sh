#!/usr/bin/env bash
# ============================================================================
# DIAGNOSTICO - Que hay ya instalado en el servidor
# ============================================================================
# No modifica nada: solo mira y reporta. Sirve para decidir que hay que quitar
# de un despliegue anterior antes de ejecutar 00-preparar-servidor.sh.
#
#   sudo bash diagnostico-servidor.sh
# ----------------------------------------------------------------------------
set -uo pipefail

DOMINIO="${DOMINIO:-santafe-pineda.shop}"
titulo() { printf '\n\033[1m===== %s =====\033[0m\n' "$1"; }
ok()     { printf '  [ OK ]    %s\n' "$1"; }
aviso()  { printf '  [ AVISO ] %s\n' "$1"; }

[[ $EUID -eq 0 ]] || { echo "Ejecute con sudo."; exit 1; }

titulo "1. Sistema"
. /etc/os-release && echo "  ${PRETTY_NAME}"
echo "  Kernel: $(uname -r)   Arquitectura: $(uname -m)"
echo "  Memoria:"; free -h | sed 's/^/    /'
echo "  Swap activo: $(swapon --show --noheadings | wc -l) dispositivo(s)"

titulo "2. Espacio en disco"
df -h / | sed 's/^/  /'
LIBRE_MB=$(df -m / | awk 'NR==2 {print $4}')
if [[ $LIBRE_MB -lt 4000 ]]; then
    aviso "Solo ${LIBRE_MB} MB libres. El despliegue necesita unos 3 GB:"
    aviso "node_modules se instala en el repositorio y se copia a /opt."
    aviso "Libere espacio o amplie el volumen EBS antes de continuar."
else
    ok "${LIBRE_MB} MB libres, suficiente."
fi

titulo "3. Quien ocupa los puertos 80, 443 y 4000"
ss -lntp 2>/dev/null | awk 'NR==1 || /:80 |:443 |:4000 /' | sed 's/^/  /'
for PUERTO in 80 443 4000; do
    QUIEN=$(ss -lntpH "sport = :${PUERTO}" 2>/dev/null | grep -oP 'users:\(\("\K[^"]+' | head -1)
    PID_PUERTO=$(ss -lntpH "sport = :${PUERTO}" 2>/dev/null | grep -oP 'pid=\K[0-9]+' | head -1)
    if [[ -n "$QUIEN" ]]; then
        aviso "Puerto ${PUERTO} ocupado por: ${QUIEN} (PID ${PID_PUERTO:-?})"
        if [[ -n "${PID_PUERTO:-}" ]]; then
            aviso "  orden: $(ps -o args= -p "${PID_PUERTO}" 2>/dev/null | head -c 120)"
            aviso "  unidad systemd: $(systemctl status "${PID_PUERTO}" 2>/dev/null | head -1 | sed 's/^[^a-zA-Z]*//' || echo 'ninguna')"
        fi
    else
        ok "Puerto ${PUERTO} libre"
    fi
done

titulo "4. Servidores web instalados"
for PKG in nginx apache2 httpd caddy; do
    if dpkg -l "$PKG" 2>/dev/null | grep -q '^ii'; then
        ESTADO=$(systemctl is-active "$PKG" 2>/dev/null || echo desconocido)
        if [[ "$PKG" == "nginx" ]]; then
            ok "nginx instalado (${ESTADO})"
        else
            aviso "${PKG} instalado (${ESTADO}) - competira por los puertos 80 y 443"
        fi
    fi
done

titulo "5. Sitios de nginx activos"
if [[ -d /etc/nginx/sites-enabled ]]; then
    ls -l /etc/nginx/sites-enabled/ 2>/dev/null | sed 's/^/  /'

    echo "  --- bloques que declaran default_server ---"
    grep -Rn "default_server" /etc/nginx/sites-enabled/ /etc/nginx/conf.d/ 2>/dev/null | sed 's/^/    /' || echo "    ninguno"

    if [[ -e /etc/nginx/sites-enabled/default ]]; then
        aviso "El sitio 'default' de Ubuntu sigue activo: provocara 'duplicate default server'."
        aviso "Se elimina con: sudo rm -f /etc/nginx/sites-enabled/default"
    fi

    echo "  --- sitios que ya reclaman ${DOMINIO} ---"
    RIVALES=$(grep -Rl "server_name.*${DOMINIO}" /etc/nginx/sites-enabled/ /etc/nginx/conf.d/ 2>/dev/null | xargs -r -n1 readlink -f | sort -u | grep -v "/${DOMINIO}$")
    if [[ -n "$RIVALES" ]]; then
        echo "$RIVALES" | sed 's/^/    /'
        aviso "Otro sitio ya reclama ${DOMINIO}. nginx NO fallara: solo avisara"
        aviso "'conflicting server name' y se quedara con el que cargue primero,"
        aviso "de modo que el despliegue del taller podria no llegar a verse nunca."
        aviso "Desactivelos borrando su enlace: sudo rm -f /etc/nginx/sites-enabled/NOMBRE"
    else
        ok "Ningun otro sitio reclama ${DOMINIO}"
    fi

    if [[ -e "/etc/nginx/sites-available/${DOMINIO}" ]]; then
        aviso "Ya existe /etc/nginx/sites-available/${DOMINIO} de un despliegue anterior."
        aviso "00-preparar-servidor.sh LO SOBRESCRIBE. Guarde una copia si le interesa:"
        aviso "  sudo cp /etc/nginx/sites-available/${DOMINIO} /root/${DOMINIO}.anterior.bak"
    fi

    echo "  --- a donde reenvia cada sitio activo ---"
    grep -Rn "server_name\|proxy_pass\|root \|listen " /etc/nginx/sites-enabled/ 2>/dev/null | sed 's/^/    /' || echo "    ninguno"
else
    echo "  nginx aun no esta instalado"
fi

titulo "6. Servicios y procesos de aplicaciones anteriores"
systemctl list-units --type=service --state=running --no-pager --no-legend 2>/dev/null \
    | grep -Ei 'node|pm2|taller|cifrado|app' | sed 's/^/  /' || echo "  ninguno evidente"
if command -v pm2 >/dev/null 2>&1; then
    aviso "pm2 esta instalado. Procesos que gestiona:"
    pm2 list 2>/dev/null | sed 's/^/    /'
fi
echo "  --- procesos node en ejecucion (con su linea de ordenes) ---"
pgrep -a node 2>/dev/null | sed 's/^/    /' || echo "    ninguno"
echo "  --- quien es el padre de cada proceso node ---"
for PID in $(pgrep node 2>/dev/null); do
    echo "    PID ${PID}: $(ps -o args= -p "$(ps -o ppid= -p "$PID" | tr -d ' ')" 2>/dev/null | head -c 90)"
done

titulo "7. Certificados ya existentes"
if [[ -d /etc/letsencrypt/live ]]; then
    ls -1 /etc/letsencrypt/live/ 2>/dev/null | sed 's/^/  dominio: /'
    for D in /etc/letsencrypt/live/*/; do
        [[ -f "${D}cert.pem" ]] || continue
        echo "    $(basename "$D"): caduca $(openssl x509 -in "${D}cert.pem" -noout -enddate | cut -d= -f2)"
    done
    aviso "Hay certificados previos. NO los borre a la ligera:"
    aviso "Let's Encrypt limita a 5 certificados por dominio y semana."
else
    ok "Sin certificados de Let's Encrypt previos"
fi
if [[ -f "/etc/ssl/certs/${DOMINIO}.crt" ]]; then
    aviso "Ya existe un autofirmado para ${DOMINIO} (se sobrescribira, no pasa nada)"
else
    ok "Sin autofirmado previo para ${DOMINIO}"
fi

titulo "8. Despliegues anteriores en el disco"
for RUTA in /opt /var/www /srv /home/ubuntu; do
    [[ -d "$RUTA" ]] || continue
    find "$RUTA" -maxdepth 3 -name package.json -not -path '*/node_modules/*' 2>/dev/null \
        | sed 's/^/  proyecto Node: /'
done
echo "  --- contenido de /var/www ---"
ls -la /var/www 2>/dev/null | sed 's/^/    /'

titulo "9. Version de nginx (afecta a la sintaxis de HTTP/2)"
if command -v nginx >/dev/null 2>&1; then
    nginx -v 2>&1 | sed 's/^/  /'
    echo "  Las configuraciones del taller usan 'listen 443 ssl http2;',"
    echo "  valida en 1.18 y 1.24. En 1.25+ funciona con un aviso de obsolescencia."
fi

titulo "RESUMEN"
cat <<FIN
  Revise los [ AVISO ] de arriba. Lo que hay que resolver antes de ejecutar
  00-preparar-servidor.sh es, en orden de importancia:

    1. Otro sitio de nginx que ya reclame ${DOMINIO} (apartado 5). Es el mas
       traicionero: nginx no falla, solo avisa y sirve el sitio equivocado.
    2. Otro servidor web (apache2) ocupando el puerto 80 o 443.
    3. Otra aplicacion escuchando en el puerto 4000.
    4. El sitio 'default' de nginx, o cualquier otro con default_server.
    5. Espacio en disco por debajo de 4 GB.

  Lo que NO hace falta borrar:
    - Certificados de Let's Encrypt de otros dominios.
    - El proyecto anterior en el disco, mientras no ocupe puertos ni reclame
      el mismo nombre de dominio.
FIN
