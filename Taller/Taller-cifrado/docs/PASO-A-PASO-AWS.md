# Paso a paso: del portátil a `https://santafe-pineda.shop`

Guía operativa para ejecutar la práctica de certificados SSL sobre la instancia de AWS,
tomar las 17 capturas del informe y montar el entregable.

| Dato | Valor |
| --- | --- |
| Instancia | `i-0a27fa5f7844c0a91` (`taller-cifrado`), `t3.micro`, región `us-east-2` |
| Sistema operativo | **Ubuntu** |
| IP elástica | `3.134.58.85` |
| Llave de acceso | `C:\Users\js020\Downloads\huesoperro.pem` |
| Usuario SSH | `ubuntu` |
| Credenciales de la aplicación | `admin` / `Admin2026*` |

> Ten a mano dos ventanas de terminal (las llamaré **A** y **B**) y el `.docx` abierto en otra
> pantalla. Para capturar en Windows: **Win + Shift + S**.

---

## Fase 0 — Preparar la llave en Windows

OpenSSH se niega a usar una llave que cualquiera del equipo pueda leer, y el `.pem` recién
descargado hereda los permisos de la carpeta `Downloads`. El error es
`UNPROTECTED PRIVATE KEY FILE` y se arregla una sola vez.

En **PowerShell**:

```powershell
icacls "C:\Users\js020\Downloads\huesoperro.pem" /inheritance:r
icacls "C:\Users\js020\Downloads\huesoperro.pem" /grant:r "$($env:USERNAME):(R)"
```

Conviene moverla fuera de `Downloads`, que es la primera carpeta que se vacía por descuido:

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.ssh" | Out-Null
Move-Item "C:\Users\js020\Downloads\huesoperro.pem" "$env:USERPROFILE\.ssh\huesoperro.pem"
```

A partir de aquí la guía usa `$env:USERPROFILE\.ssh\huesoperro.pem`. Si prefieres dejarla donde
está, sustituye la ruta en todas las órdenes.

---

## Fase 1 — Encender la instancia y conectarse

1. En la consola de AWS, **EC2 → Instances**, selecciona `taller-cifrado` y pulsa
   **Instance state → Start instance**. Espera a que el estado sea `Running` y los dos chequeos
   estén en verde.

2. Conéctate desde PowerShell:

   ```powershell
   ssh -i "$env:USERPROFILE\.ssh\huesoperro.pem" ubuntu@3.134.58.85
   ```

   Como la IP es elástica, no cambia al apagar y encender la instancia. Ese problema, que es el
   que más gente atasca, ya lo tienes resuelto.

3. Confirma la versión de Ubuntu (la guía vale para 22.04 y 24.04):

   ```bash
   lsb_release -a
   free -h        # 1 GB de RAM: el guion creará swap automáticamente
   ```

---

## Fase 2 — DNS y puertos

### 2.1. Registro A del dominio

En el panel DNS de tu registrador, el registro A de `santafe-pineda.shop` debe apuntar a
**3.134.58.85**. Añade también el de `www`. Comprueba desde el servidor que ya propagó:

```bash
dig +short santafe-pineda.shop @1.1.1.1
dig +short www.santafe-pineda.shop @1.1.1.1
```

**Ambas deben devolver `3.134.58.85`.** Si no, espera y repite; según el registrador tarda entre
unos minutos y una hora. No sigas hasta que coincidan: Let's Encrypt valida contra el DNS
público y el fallo aparecerá disfrazado de error de certbot.

### 2.2. Security group

**EC2 → Security Groups →** el de tu instancia **→ Inbound rules → Edit**:

| Tipo | Puerto | Origen |
| --- | --- | --- |
| SSH | 22 | Tu IP |
| HTTP | 80 | `0.0.0.0/0` |
| HTTPS | 443 | `0.0.0.0/0` |

El puerto 80 es obligatorio aunque al final todo vaya por HTTPS: el reto de Let's Encrypt se
valida por ahí.

---

## Fase 3 — Subir el proyecto

### 3.0. Si la instancia ya tenía un proyecto desplegado

Que al abrir el dominio no aparezca el login es lo esperado en este punto: todavía no has
ejecutado el guion que despliega esta aplicación, así que lo que responde es el despliegue
anterior. **No hace falta borrarlo todo**, pero sí resolver lo que choque. Para verlo:

```bash
sudo bash deploy/scripts/diagnostico-servidor.sh
```

Revisa las líneas marcadas `[ AVISO ]`. Sólo estas cuatro cosas bloquean el despliegue:

| Si el diagnóstico dice | Qué hacer |
| --- | --- |
| Otro sitio ya reclama `santafe-pineda.shop` | `sudo rm -f /etc/nginx/sites-enabled/NOMBRE` — **el más importante**, ver abajo |
| `apache2` instalado y activo | `sudo systemctl disable --now apache2` (ocupa los puertos 80 y 443) |
| Puerto 4000 ocupado | Ver abajo: casi siempre es un despliegue anterior bajo **pm2** |
| El sitio `default` de nginx activo | `sudo rm -f /etc/nginx/sites-enabled/default` (el guion `00` ya lo hace) |
| Menos de 4 GB libres | Libera espacio o amplía el volumen EBS |

**El conflicto de nombre de dominio es el más traicionero de todos.** Si un sitio anterior
declara `server_name santafe-pineda.shop`, nginx no falla al arrancar: se limita a avisar
`conflicting server name` en el log y sirve el que haya cargado primero, que por orden
alfabético puede ser el viejo. Ejecutarías el guion, todo parecería correcto y el navegador
seguiría mostrando el proyecto anterior. Desactívalo antes de continuar.

Borrar el enlace de `sites-enabled/` no destruye nada: el archivo real sigue en
`sites-available/` y puedes volver a enlazarlo cuando quieras.

#### El caso habitual: un despliegue anterior con pm2

Si ya habías publicado esta misma aplicación con pm2, el puerto 4000 está ocupado por ese
proceso. El guion `00` no puede arrancar entonces su servicio de systemd, y como nginx sigue
reenviando al 4000, el navegador te muestra la versión antigua: parece que todo funciona, pero
es la aplicación equivocada. Un `404` en `/login` es la señal típica.

```bash
pm2 list                                      # confirma qué gestiona
pm2 delete all && pm2 save                    # detiene la aplicación antigua
sudo systemctl disable --now pm2-ubuntu       # y evita que resucite al reiniciar
ss -lntp | grep :4000                         # debe quedar sin salida
```

Conviene pasar de pm2 a systemd, y no al revés, porque la unidad
[`deploy/systemd/taller-cifrado.service`](../deploy/systemd/taller-cifrado.service) es la que
define `COOKIE_SECURE=true`, `CONFIAR_EN_PROXY=1` y `FORZAR_HTTPS=true`. Sin esas tres variables
la cookie de sesión no se marca `Secure` y la aplicación no se entera de que hay un proxy TLS
delante, que es justo lo que esta práctica tiene que demostrar.

Si más adelante quieres volver a pm2: `sudo systemctl enable --now pm2-ubuntu` y
`pm2 resurrect`.

**Lo que no debes borrar:** los certificados de Let's Encrypt de otros dominios que ya estén en
`/etc/letsencrypt/`. Let's Encrypt limita a 5 certificados por dominio y semana, y rehacerlos por
error te dejaría sin margen.

### 3.1. Clonar el repositorio


```bash
sudo apt-get update && sudo apt-get install -y git
git clone https://github.com/Semiramyz/Taller-de-Cifrado-Clasico.git
cd "Taller-de-Cifrado-Clasico/Taller/Taller-cifrado"
ls deploy      # debe existir; si no, falta hacer git push desde el portátil
```

Crea el archivo de configuración:

```bash
cp .env.example .env
```

No toques `COOKIE_SECURE` ni `FORZAR_HTTPS` en ese archivo. Son variables de etapa y las
gobierna la unidad de systemd: la etapa 1 necesita servir en claro y las etapas 2 y 3
necesitan https. Si las fijas en `.env` y el servicio las lee, la aplicación redirigirá a
un puerto 443 que todavía no existe.

---

## Fase 4 — ETAPA 1: el sitio sin certificado

```bash
sudo bash deploy/scripts/00-preparar-servidor.sh
```

Tarda entre diez y quince minutos en `t3.micro`. El guion crea 2 GB de swap (sin ellos la
compilación de Angular muere por falta de memoria), instala Node 24 y nginx, compila la
aplicación, crea el servicio, abre el cortafuegos, **desactiva el sitio `default` de Ubuntu** y
deja el sitio respondiendo por HTTP.

Al terminar comprueba:

```bash
systemctl status taller-cifrado --no-pager
curl -I http://santafe-pineda.shop/login
```

Debe responder `200` o `302`, nunca `502`. Si da **502 Bad Gateway**, la aplicación no arrancó:
mira `journalctl -u taller-cifrado -n 50`.

### CAPTURA 01 — `01-sin-ssl-firefox.png`

En Firefox, abre `http://santafe-pineda.shop/login`. Captura la ventana completa mostrando la
barra de direcciones con el **candado tachado**. Haz clic en el campo de contraseña para que
salga el aviso *"Esta conexión no es segura"* y que se vea en la captura.

### CAPTURA 02 — `02-sin-ssl-captura-red.png`

La más contundente del informe. Necesitas las dos terminales.

**Terminal A**, en el servidor, deja corriendo:

```bash
sudo tcpdump -i any -A -s0 'tcp port 80 and host santafe-pineda.shop' | grep -A5 "POST /api"
```

Ahora, en Firefox, inicia sesión con `admin` / `Admin2026*`. Vuelve a la terminal A: verás el
`POST /api/auth/login` con el JSON y **la contraseña en texto plano**. Captura esa terminal.
Corta con `Ctrl+C`.

> Usa sólo la contraseña de prueba del taller. Cualquier cosa que escribas aquí viaja sin cifrar.

### CAPTURA 03 — `03-sin-ssl-ssllabs.png`

Abre `https://www.ssllabs.com/ssltest/analyze.html?d=santafe-pineda.shop`. Dará
*"Assessment failed: No secure protocols supported"*. Captura ese mensaje.

---

## Fase 5 — ETAPA 2: certificado autofirmado

```bash
sudo bash deploy/scripts/01-certificado-autofirmado.sh
```

Tarda un par de minutos en el paso de los parámetros Diffie-Hellman; es normal.

### CAPTURA 04 — `04-openssl-generacion.png`

Captura la salida del guion donde se ven los cuatro pasos de OpenSSL y, al final, la
verificación con `subject` e `issuer`. Si no cabe en una pantalla, haz dos capturas o vuelve a
mostrar el resumen:

```bash
sudo openssl x509 -in /etc/ssl/certs/santafe-pineda.shop.crt -noout \
     -subject -issuer -dates -ext subjectAltName
```

### CAPTURA 05 — `05-autofirmado-advertencia.png`

En Firefox, abre `https://santafe-pineda.shop` (ahora con **https**). Saldrá la pantalla
*"Advertencia: riesgo probable de seguridad"*. Pulsa **Avanzado** para que aparezca el código
`SEC_ERROR_UNKNOWN_ISSUER` y captura con el código visible.

> Si Firefox ya te dejó pasar antes, borra la excepción en
> *Configuración → Privacidad y seguridad → Certificados → Ver certificados → Servidores*.

### CAPTURA 06 — `06-autofirmado-detalle.png`

En esa misma pantalla, **Avanzado → Ver certificado**. Captura el visor mostrando que
**Emitido para** y **Emitido por** contienen el mismo nombre. Esa coincidencia es el problema.

### CAPTURA 07 — `07-autofirmado-ssllabs.png`

Repite la prueba de SSL Labs, marcando la casilla *"Do not show the results on the boards"*.
Ahora sí dará calificación, y será **T**. Captura la nota junto al aviso de certificado no
confiable.

### CAPTURA 08 — `08-autofirmado-sclient.png`

En el servidor:

```bash
openssl s_client -connect santafe-pineda.shop:443 -servername santafe-pineda.shop </dev/null 2>&1 | head -20
```

Captura la línea `verify error:num=18:self-signed certificate`.

---

## Fase 6 — ETAPA 3: Let's Encrypt manual

Aquí necesitas **las dos terminales conectadas a la vez**. Abre una segunda ventana de
PowerShell y conéctate igual que en la fase 1.

### 6.1. Lanzar la emisión (Terminal A)

```bash
cd "Taller-de-Cifrado-Clasico/Taller/Taller-cifrado"
sudo bash deploy/scripts/02-letsencrypt-manual.sh
```

El guion comprueba el DNS, instala certbot **sin el complemento de nginx**, desactiva
`certbot.timer` y se para a pedirte confirmación. Pulsa Enter cuando lo indique.

### CAPTURA 09 — `09-certbot-pausa.png`  ← la más importante para la nota

Certbot se detiene mostrando algo así:

```
Create a file containing just this data:

  8xKq2...token....Lm9   .   bT4vN...huella....Kp2

And make it available on your web server at this URL:

  http://santafe-pineda.shop/.well-known/acme-challenge/8xKq2...token....Lm9

Press Enter to Continue
```

**Captura esta pantalla completa.** Es la prueba de que la emisión no fue automática.
**No pulses Enter todavía.**

### 6.2. Crear el reto a mano (Terminal B)

Copia del mensaje el **nombre del archivo** (lo último de la URL) y el **contenido** (la línea
larga con el punto en medio) y ejecuta:

```bash
cd "Taller-de-Cifrado-Clasico/Taller/Taller-cifrado"
sudo bash deploy/scripts/crear-reto-acme.sh NOMBRE_ARCHIVO CONTENIDO
```

El guion crea el archivo, ajusta permisos y comprueba con `curl` que se lee. Antes de seguir,
compruébalo también desde fuera, en tu portátil:

```powershell
curl.exe http://santafe-pineda.shop/.well-known/acme-challenge/NOMBRE_ARCHIVO
```

Debe devolver exactamente el contenido, sin nada más.

### CAPTURA 10 — `10-token-creado.png`

Captura la terminal B con la creación del archivo y el `curl` devolviendo el token.

### 6.3. Completar la emisión (Terminal A)

Vuelve a la terminal A y pulsa **Enter**.

> Si falla, tienes 5 intentos por hora para el mismo dominio. Por eso comprobamos el `curl`
> antes. El error más común es haber copiado el contenido con un espacio o un salto de línea de
> más.

### CAPTURA 11 — `11-certbot-exito.png`

Captura el mensaje *"Successfully received certificate"* con las rutas de
`/etc/letsencrypt/live/`.

### CAPTURA 12 — `12-archivos-letsencrypt.png`

El guion ya lo muestra, pero puedes repetirlo:

```bash
sudo ls -l /etc/letsencrypt/live/santafe-pineda.shop/
sudo cat /etc/letsencrypt/renewal/santafe-pineda.shop.conf
```

Captura ambas salidas: se ve que los cuatro archivos son enlaces simbólicos hacia `archive/`.

### CAPTURA 13 — `13-nginx-editado.png`

El guion ya activó el certificado. Muestra el archivo que se modificó:

```bash
sudo grep -n -A2 "ssl_certificate\|Strict-Transport\|return 301" \
     /etc/nginx/sites-available/santafe-pineda.shop
```

Captura la salida. Es la prueba de la instalación manual: **no aparece ningún comentario
"managed by Certbot"**, que es lo que habría dejado el instalador automático.

### CAPTURA 14 — `14-renovacion-desactivada.png`

```bash
systemctl list-timers --all | grep -i certbot; echo "salida vacia = sin renovacion automatica"
ls /etc/cron.d/ | grep -i certbot; echo "sin cron de certbot"
```

Captura ambas comprobaciones vacías.

---

## Fase 7 — Verificación final

```bash
bash deploy/scripts/04-verificar-tls.sh | tee deploy/evidencias/verificacion.txt
```

Revisa que la sección 7 diga `Verify return code: 0 (ok)` y que las secciones 8 y 9 muestren TLS
1.0 y 1.1 rechazados, TLS 1.2 y 1.3 aceptados.

### CAPTURA 15 — `15-firefox-candado.png`

Abre `https://santafe-pineda.shop` en Firefox. Ahora entra sin advertencias. Haz clic en el
**candado → Conexión segura → Más información** y captura el panel mostrando
*"Verificado por: Let's Encrypt"*.

### CAPTURA 16 — `16-redireccion-301.png`

Desde tu portátil, en PowerShell:

```powershell
curl.exe -I http://santafe-pineda.shop/
```

Captura la respuesta `301 Moved Permanently` con la cabecera `Location: https://...`.
Añade en la misma captura, si cabe, la prueba en el navegador: escribe `http://santafe-pineda.shop`
en la barra y muestra cómo salta solo a `https://`.

### CAPTURA 17 — `17-ssllabs-A.png`

Última prueba de SSL Labs. Tarda dos o tres minutos. Debe dar **A** o **A+**. Captura la nota y,
desplazándote, la sección *Certification Paths* con la cadena completa hasta ISRG Root X1.

---

## Fase 8 — Montar el informe

1. Copia `deploy/evidencias/verificacion.txt` del servidor a tu portátil:

   ```powershell
   scp -i "$env:USERPROFILE\.ssh\huesoperro.pem" `
       ubuntu@3.134.58.85:"Taller-de-Cifrado-Clasico/Taller/Taller-cifrado/deploy/evidencias/verificacion.txt" `
       "C:\Users\js020\Documents\GitHub\Taller de Cifrado Clasico\Taller\Taller-cifrado\deploy\evidencias\"
   ```

2. Abre `docs/pineda-juan-ssl.docx` en Word. Busca los recuadros amarillos punteados
   **INSERTAR CAPTURA**: hay 17 y cada uno dice qué debe verse. Sustituye cada recuadro por su
   imagen (selecciona el recuadro, **Insertar → Imágenes**, y borra el recuadro).

3. Revisa que los datos de la portada sean correctos y guarda.

4. Deja la instancia encendida para la sustentación en clase: el requisito 5 dice que la práctica
   termina cuando el profesor pueda entrar por `https` desde el salón.

---

## Si algo falla

| Síntoma | Causa habitual | Solución |
| --- | --- | --- |
| `UNPROTECTED PRIVATE KEY FILE` | Permisos del `.pem` | Fase 0 |
| `Permission denied (publickey)` | Usuario SSH equivocado | En Ubuntu es `ubuntu`, no `ec2-user` |
| `duplicate default server` al recargar nginx | Quedó activo el sitio `default` de Ubuntu | `sudo rm -f /etc/nginx/sites-enabled/default` |
| La compilación muere sin mensaje | Falta memoria | `free -h`; el guion crea swap, verifica que se activó |
| `502 Bad Gateway` | La aplicación no arrancó | `journalctl -u taller-cifrado -n 50` |
| Tras redesplegar, el sitio sigue comportándose como antes | El servicio no se reinició y sigue vivo el proceso anterior | `sudo systemctl restart taller-cifrado`; comprueba la hora en `systemctl status` |
| En la etapa 1 el sitio redirige a https | Quedó activo el suplemento `taller-cifrado.service.d/https.conf` | `sudo rm -f /etc/systemd/system/taller-cifrado.service.d/https.conf && sudo systemctl daemon-reload && sudo systemctl restart taller-cifrado` |
| Sigue redirigiendo aunque no haya suplemento | `FORZAR_HTTPS=true` en `/opt/taller-cifrado/.env` | `sudo sed -i '/^FORZAR_HTTPS=/d; /^COOKIE_SECURE=/d' /opt/taller-cifrado/.env` y reinicia. Comprueba con `systemctl show taller-cifrado -p Environment` |
| `400 Bad Request` en el dominio | Falta el dominio en `security.allowedHosts` | Ya está corregido en `angular.json`; recompila si editaste algo |
| El login falla con error del servidor | Falta la carpeta `database/` en `/opt/taller-cifrado` | `sudo cp -r database /opt/taller-cifrado/ && sudo systemctl restart taller-cifrado` |
| Certbot: *"DNS problem"* o *"Invalid response... 404"* | El registro A no apunta a `3.134.58.85` | Fase 2.1 |
| Certbot: *"too many failed authorizations"* | 5 intentos fallidos en una hora | Espera una hora; comprueba el `curl` antes de pulsar Enter |
| El `curl` del reto devuelve 403 o 404 | Permisos de `/var/www/acme` | `sudo chown -R www-data:www-data /var/www/acme` |
| SSL Labs: *"Chain issues: incomplete"* | Se declaró `cert.pem` en lugar de `fullchain.pem` | Revisa `/etc/nginx/sites-available/santafe-pineda.shop` |
| Firefox no muestra la advertencia del autofirmado | Excepción guardada de antes | Bórrala en Certificados → Servidores |
