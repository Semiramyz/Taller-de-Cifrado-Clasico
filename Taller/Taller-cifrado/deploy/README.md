# Despliegue con certificados SSL — `santafe-pineda.shop`

Material de la actividad práctica **Certificados SSL** (Seguridad de la Información, 2026-II)
aplicada a la aplicación del Taller de Cifrado Clásico con inicio de sesión.

Servidor: instancia **AWS EC2 `t3.micro` con Ubuntu**, IP elástica `3.134.58.85`, con **nginx**
como proxy inverso y terminador TLS y la aplicación Angular SSR escuchando en `127.0.0.1:4000`.

## Por qué la instalación es manual

El enunciado descuenta 1.5 unidades si el certificado se crea o se activa de forma automática.
El material está construido para que las dos mitades sean manuales y quede constancia de ello:

| Decisión | Qué se hace | Qué se evita |
| --- | --- | --- |
| Emisión | `certbot certonly --manual --preferred-challenges http` | `certbot --nginx`, que emite e instala solo |
| Reto ACME | El token se escribe a mano con `crear-reto-acme.sh` | `--webroot`, que lo deposita certbot |
| Activación | Se editan a mano las directivas `ssl_certificate` en `sites-available/` | Que certbot reescriba la configuración |
| Renovación | `03-renovar-letsencrypt-manual.sh`, cada 90 días | `certbot.timer` y `/etc/cron.d/certbot`, desactivados |

## Las tres etapas

| Etapa | Configuración de nginx | Qué demuestra |
| --- | --- | --- |
| 1. Sin SSL | [`nginx/01-sin-ssl.conf`](nginx/01-sin-ssl.conf) | El sitio en claro: credenciales legibles en la red |
| 2. Autofirmado | [`nginx/02-autofirmado.conf`](nginx/02-autofirmado.conf) | Cifrado correcto, identidad sin respaldo: `SEC_ERROR_UNKNOWN_ISSUER`, nota **T** |
| 3. Let's Encrypt | [`nginx/03-letsencrypt.conf`](nginx/03-letsencrypt.conf) | Cadena válida, redirección 301, HSTS, nota **A/A+** |

Las tres se copian sobre el mismo archivo: `/etc/nginx/sites-available/santafe-pineda.shop`,
enlazado desde `sites-enabled/`.

## Orden de ejecución

> Para el recorrido completo desde Windows —conexión SSH a la instancia de AWS, ejecución de
> cada etapa y las 17 capturas del informe— sigue
> [`docs/PASO-A-PASO-AWS.md`](../docs/PASO-A-PASO-AWS.md). Lo de abajo es el resumen.

```bash
# En el servidor, con el repositorio clonado y el DNS ya apuntando a su IP pública
sudo bash deploy/scripts/diagnostico-servidor.sh     # que hay ya instalado (no modifica nada)
sudo bash deploy/scripts/00-preparar-servidor.sh        # etapa 1 + captura de evidencia
sudo bash deploy/scripts/01-certificado-autofirmado.sh  # etapa 2 + captura de evidencia
sudo bash deploy/scripts/02-letsencrypt-manual.sh       # etapa 3 (se detiene a pedir el token)
bash      deploy/scripts/04-verificar-tls.sh | tee deploy/evidencias/verificacion.txt
```

El script 02 se detiene a mitad de camino. En ese momento, **en una segunda sesión SSH**:

```bash
sudo bash deploy/scripts/crear-reto-acme.sh NOMBRE_ARCHIVO CONTENIDO
```

copiando el nombre y el contenido del mensaje que certbot deja en pantalla.

## Mapa de archivos del servidor

Lo que el ejercicio pide saber: qué se modifica y dónde queda.

```
/etc/nginx/
├── sites-available/santafe-pineda.shop  <- ARCHIVO PRINCIPAL. Cambia en cada etapa.
├── sites-enabled/santafe-pineda.shop    <- enlace simbólico al anterior
├── sites-enabled/default                <- SE ELIMINA: ocupa el puerto 80 como default_server
└── snippets/
    ├── tls-parametros.conf           <- protocolos, suites, dhparam, caché de sesión
    └── proxy-node.conf               <- cabeceras del proxy hacia 127.0.0.1:4000

/etc/ssl/                              CERTIFICADO AUTOFIRMADO (etapa 2)
├── certs/santafe-pineda.shop.crt
├── certs/santafe-pineda.shop.csr
├── private/santafe-pineda.shop.key    (modo 640, root:ssl-cert)
└── private/dhparam.pem

/etc/letsencrypt/                      CERTIFICADO LET'S ENCRYPT (etapa 3)
├── live/santafe-pineda.shop/          enlaces simbólicos: fullchain.pem, privkey.pem,
│                                      chain.pem, cert.pem
├── archive/santafe-pineda.shop/       los archivos reales, numerados por emisión
├── renewal/santafe-pineda.shop.conf   parámetros con los que se emitió
└── accounts/                          clave de la cuenta ACME

/var/www/acme/.well-known/acme-challenge/   token del reto http-01, escrito a mano
/etc/systemd/system/taller-cifrado.service  servicio de la aplicación Node
```

Nota sobre el sitio `default`: Ubuntu trae `/etc/nginx/sites-enabled/default` activado y
declarado `default_server` en el puerto 80. Hay que eliminar ese enlace, porque si no nginx
aborta con `duplicate default server`. El guion `00-preparar-servidor.sh` ya lo hace.

## Cambios en la aplicación

El certificado por sí solo no basta: si la aplicación no sabe que hay un proxy TLS delante,
la cookie de sesión marcada `Secure` no se envía y el control de fuerza bruta cuenta todos los
intentos de internet contra una sola IP, la del propio proxy.

| Archivo | Cambio |
| --- | --- |
| [`src/backend/middlewares/https.ts`](../src/backend/middlewares/https.ts) | Redirección a HTTPS como segunda línea de defensa y cabeceras de seguridad |
| [`src/server.ts`](../src/server.ts) | `trust proxy` en Express y `trustProxyHeaders` en Angular SSR |
| [`src/backend/config.ts`](../src/backend/config.ts) | Sección `https` leída del entorno |
| [`angular.json`](../angular.json) | `security.allowedHosts` con el dominio real |
| [`.env.example`](../.env.example) | `DOMINIO`, `CONFIAR_EN_PROXY`, `FORZAR_HTTPS`, `COOKIE_SECURE=true` |

Sin `allowedHosts` el SSR responde **400 Bad Request** a toda petición cuya cabecera `Host`
no sea `localhost`: el sitio quedaría inaccesible en el dominio real aunque el TLS fuera
perfecto.

## Comprobación rápida

```bash
curl -I http://santafe-pineda.shop/
curl -I https://santafe-pineda.shop/ | grep -i strict-transport
echo | openssl s_client -connect santafe-pineda.shop:443 -servername santafe-pineda.shop | grep 'Verify return'
```
