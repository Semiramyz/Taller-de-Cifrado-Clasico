# Evidencias del informe

Capturas que hay que tomar en el servidor y adjuntar al informe `pineda-juan-ssl.docx`.
Los nombres sugeridos son los que cita el informe en cada apartado.

## Etapa 1 — sitio sin certificado

| Archivo | Qué debe verse |
| --- | --- |
| `01-sin-ssl-firefox.png` | `http://santafe-pineda.shop/login` con el candado tachado y el aviso "Esta conexión no es segura" |
| `02-sin-ssl-captura-red.png` | `sudo tcpdump -i any -A -s0 'tcp port 80'` durante un inicio de sesión: usuario y contraseña legibles |
| `03-sin-ssl-ssllabs.png` | SSL Labs sobre el dominio: "Assessment failed: No secure protocols supported" |

## Etapa 2 — certificado autofirmado

| Archivo | Qué debe verse |
| --- | --- |
| `04-openssl-generacion.png` | Salida de `01-certificado-autofirmado.sh`: los tres pasos de OpenSSL |
| `05-autofirmado-advertencia.png` | Firefox con "Advertencia: riesgo probable de seguridad" y el código `SEC_ERROR_UNKNOWN_ISSUER` |
| `06-autofirmado-detalle.png` | Visor de certificados: "Emitido para" y "Emitido por" con el mismo nombre |
| `07-autofirmado-ssllabs.png` | SSL Labs: calificación **T** (trust failure) |
| `08-autofirmado-sclient.png` | `openssl s_client` con `verify error:num=18:self-signed certificate` |

## Etapa 3 — Let's Encrypt manual

| Archivo | Qué debe verse |
| --- | --- |
| `09-certbot-pausa.png` | **La captura más importante.** Certbot detenido pidiendo crear el archivo del reto |
| `10-token-creado.png` | Segunda sesión SSH: `crear-reto-acme.sh` y el `curl` que devuelve el token |
| `11-certbot-exito.png` | "Successfully received certificate" y las rutas de `/etc/letsencrypt/live/` |
| `12-archivos-letsencrypt.png` | `ls -l /etc/letsencrypt/live/santafe-pineda.shop/` y el archivo de `renewal/` |
| `13-nginx-editado.png` | El `sites-available/santafe-pineda.shop` con las directivas `ssl_certificate` escritas a mano |
| `14-renovacion-desactivada.png` | `systemctl list-timers --all` sin ningún temporizador de certbot |
| `15-firefox-candado.png` | Candado cerrado y "Verificado por: Let's Encrypt" |
| `16-redireccion-301.png` | `curl -I http://santafe-pineda.shop/` devolviendo 301 hacia https |
| `17-ssllabs-A.png` | SSL Labs con calificación **A** o **A+** |
| `verificacion.txt` | Salida completa de `bash deploy/scripts/04-verificar-tls.sh` |
