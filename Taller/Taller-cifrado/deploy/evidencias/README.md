# Evidencias del informe

Capturas tomadas durante la ejecución de la práctica sobre la instancia EC2
`santafe-pineda.shop`. Están embebidas en `docs/pineda-juan-ssl.docx`, que se
genera a partir de esta carpeta.

## Etapa 0 — Entorno

| Archivo | Qué muestra |
| --- | --- |
| `00-ssh-instancia.png` | Acceso por SSH: Ubuntu 24.04 LTS sobre AWS |

## Etapa 1 — Sitio sin certificado

| Archivo | Qué muestra |
| --- | --- |
| `01-etapa1-http-200.png` | `curl -I` devolviendo 200 OK sin redirección |
| `02-sin-ssl-navegador.jpg` | Navegador con "Not secure" sobre el formulario de login |
| `03-sin-ssl-aplicacion.jpg` | La aplicación completa servida en claro |
| `04-sin-ssl-tcpdump.png` | El POST de login con la contraseña legible |
| `05-sin-ssl-ssllabs.jpg` | SSL Labs: "Unable to connect to the server" |

## Etapa 2 — Certificado autofirmado

| Archivo | Qué muestra |
| --- | --- |
| `06-autofirmado-generacion.png` | Salida del guion: los cuatro archivos creados |
| `07-autofirmado-emisor-titular.png` | Titular y emisor idénticos |
| `08-autofirmado-navegador.jpg` | HTTPS tachado en la barra de direcciones |
| `09-autofirmado-visor.jpg` | Visor de certificados: "Issued To" = "Issued By" |
| `10-autofirmado-ssllabs-T.png` | SSL Labs: **T**, con "If trust issues are ignored: A" |
| `11-autofirmado-sclient.png` | `verify error:num=18:self-signed certificate` |

## Etapa 3 — Let's Encrypt manual

| Archivo | Qué muestra |
| --- | --- |
| `12-certbot-manual-dos-retos.png` | `authenticator = manual`, y los dos retos depositados a mano |
| `13-letsencrypt-archivos.png` | `live/` con sus enlaces simbólicos y el archivo de renovación |
| `14-nginx-editado-a-mano.png` | Las directivas del certificado, el 301 y HSTS, sin marcas de certbot |

## Verificación

| Archivo | Qué muestra |
| --- | --- |
| `15-verificacion-cadena.png` | Cadena hasta ISRG Root X1 y `Verify return code: 0 (ok)` |
| `16-verificacion-protocolos.png` | TLS 1.0 y 1.1 rechazados; 1.2 y 1.3 aceptados |
| `17-letsencrypt-visor.jpg` | Visor de certificados: "Issued By: YE1, Let's Encrypt" |

## Pendientes

Estas tres siguen como recuadro amarillo en el informe:

| Archivo | Cómo obtenerla |
| --- | --- |
| `14-renovacion-desactivada.png` | `systemctl list-timers --all \| grep -i certbot` (salida vacía) |
| `16-redireccion-301.png` | `curl -I http://santafe-pineda.shop/login` → 301 + `Location: https://…` |
| `17-ssllabs-A.png` | Repetir SSL Labs con el certificado de Let's Encrypt: debe dar **A** |
