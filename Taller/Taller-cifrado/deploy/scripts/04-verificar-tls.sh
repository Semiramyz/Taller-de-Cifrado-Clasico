#!/usr/bin/env bash
# ============================================================================
# 04 - VERIFICACION Y EVIDENCIAS  (requisitos 2, 4 y 5)
# ============================================================================
# Ejecutar desde cualquier maquina con openssl y curl. Genera en texto todas
# las comprobaciones que acompanan a las capturas de pantalla del informe.
#
#   bash 04-verificar-tls.sh | tee deploy/evidencias/verificacion.txt
# ----------------------------------------------------------------------------
set -uo pipefail

DOMINIO="${DOMINIO:-santafe-pineda.shop}"
linea() { printf '\n----- %s -----\n' "$1"; }

echo "VERIFICACION TLS DE ${DOMINIO} - $(date -Is)"

linea "1. Redireccion http -> https (requisito 2)"
curl -sSI "http://${DOMINIO}/" | sed -n '1p;/^[Ll]ocation:/p'
echo "Debe responder 301 y Location: https://${DOMINIO}/"

linea "2. La redireccion tambien aplica al formulario de inicio de sesion"
curl -sSI "http://${DOMINIO}/login" | sed -n '1p;/^[Ll]ocation:/p'

linea "3. Cabecera HSTS"
curl -sSI "https://${DOMINIO}/" | grep -i 'strict-transport-security' \
    || echo "FALTA la cabecera HSTS"

linea "4. Cookie de sesion marcada Secure y HttpOnly"
curl -sS -i -X POST "https://${DOMINIO}/api/auth/login" \
     -H 'Content-Type: application/json' \
     -d '{"username":"prueba","password":"prueba"}' 2>/dev/null \
    | grep -i 'set-cookie' || echo "(sin cookie: credenciales de prueba invalidas, es lo esperado)"

linea "5. Cadena de certificacion completa"
echo | openssl s_client -connect "${DOMINIO}:443" -servername "${DOMINIO}" 2>/dev/null \
    | sed -n '/Certificate chain/,/---/p'

linea "6. Emisor, titular y vigencia"
echo | openssl s_client -connect "${DOMINIO}:443" -servername "${DOMINIO}" 2>/dev/null \
    | openssl x509 -noout -subject -issuer -dates -ext subjectAltName

linea "7. Resultado de la validacion"
echo | openssl s_client -connect "${DOMINIO}:443" -servername "${DOMINIO}" 2>/dev/null \
    | grep -E 'Verify return code|Verification'
echo "Con Let's Encrypt debe decir: Verify return code: 0 (ok)"

linea "8. Protocolos antiguos: deben ser RECHAZADOS"
for p in tls1 tls1_1; do
    if echo | openssl s_client -connect "${DOMINIO}:443" -servername "${DOMINIO}" "-${p}" &>/dev/null; then
        echo "  ${p}: ACEPTADO  <-- corregir"
    else
        echo "  ${p}: rechazado  (correcto)"
    fi
done

linea "9. Protocolos vigentes: deben ser ACEPTADOS"
for p in tls1_2 tls1_3; do
    if echo | openssl s_client -connect "${DOMINIO}:443" -servername "${DOMINIO}" "-${p}" &>/dev/null; then
        echo "  ${p}: aceptado  (correcto)"
    else
        echo "  ${p}: rechazado  <-- revisar"
    fi
done

linea "10. Pruebas externas (requisito 4)"
cat <<FIN
  Plugin de Firefox o pagina de Qualys:
     https://www.ssllabs.com/ssltest/analyze.html?d=${DOMINIO}&hideResults=on&latest
  Ejecutarlo DOS veces y guardar ambas capturas:
     - con el certificado autofirmado  -> calificacion T (trust failure)
     - con el de Let's Encrypt         -> calificacion A o A+
  En Firefox, el candado -> Conexion segura -> Mas informacion muestra el
  emisor, la vigencia y la version de TLS negociada.
FIN
