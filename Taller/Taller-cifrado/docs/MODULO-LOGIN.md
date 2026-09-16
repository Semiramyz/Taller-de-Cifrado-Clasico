# Módulo de inicio de sesión seguro

Taller *Seguridad en Autenticación Web* (Seguridad de la Información 2026-II), integrado a la
aplicación de cifrado clásico (Angular 22 SSR + servidor Node.js/Express 5).

## 1. Mapa de entregables → archivos

| Entregable del taller | Dónde está |
| --- | --- |
| Script SQL completo (tablas + datos iniciales) | [database/schema.mysql.sql](../database/schema.mysql.sql) |
| Backend Node.js con hashing BCrypt | [src/backend/servicios/password.servicio.ts](../src/backend/servicios/password.servicio.ts), [auth.servicio.ts](../src/backend/servicios/auth.servicio.ts), [rutas/auth.rutas.ts](../src/backend/rutas/auth.rutas.ts) |
| Middleware contra fuerza bruta | [src/backend/middlewares/proteccion-fuerza-bruta.ts](../src/backend/middlewares/proteccion-fuerza-bruta.ts) |
| Prueba demostrativa: bloqueo de IP tras 5 fallos | [scripts/demo-fuerza-bruta.mjs](../scripts/demo-fuerza-bruta.mjs) (`npm run demo:fuerza-bruta`) |
| Formulario de login (HTML5) | [src/app/login/login.html](../src/app/login/login.html) |
| Documento de conclusiones | Lo redacta el estudiante; ver ideas en la sección 6 |

## 2. Arquitectura

```
Navegador (Angular)                      Servidor Node.js (src/server.ts)
───────────────────                      ────────────────────────────────────────────
/login  ── POST /api/auth/login ──────►  express.json / urlencoded (límite 10 kB)
                                           │
                                           ▼
                                         proteccionFuerzaBruta   ← IP bloqueada? → 429
                                           │
                                           ▼
                                         auth.rutas → auth.servicio
                                           │   ├─ cuenta bloqueada en BD? → 423
                                           │   ├─ bcrypt.compare(password, password_hash)
                                           │   └─ fallo → intentos_fallidos++ (BD) + conteo IP
                                           ▼
                                         éxito → sesión en servidor + cookie HttpOnly "sid"

GET /  ───────────────────────────────►  protegerPaginas: sin sesión → 302 /login
                                         (antes de que Angular renderice la página)
```

```
src/backend/
├── config.ts                         Variables de entorno (.env)
├── db/
│   ├── usuarios.repositorio.ts       Interfaz + selección de motor (sqlite | mysql)
│   ├── mysql.repositorio.ts          mysql2 con consultas parametrizadas
│   └── sqlite.repositorio.ts         node:sqlite (desarrollo sin instalar MySQL)
├── middlewares/
│   ├── proteccion-fuerza-bruta.ts    Rate limiting + bloqueo temporal por IP (Map en memoria)
│   └── sesion.ts                     requiereSesion, requiereRol (RBAC), protegerPaginas
├── rutas/
│   ├── auth.rutas.ts                 /api/auth: login, registro, sesion, logout
│   └── admin.rutas.ts                /api/admin: listar y desbloquear usuarios (solo Administrador)
└── servicios/
    ├── password.servicio.ts          bcrypt.hash / bcrypt.compare
    ├── auth.servicio.ts              Lógica de autenticación y bloqueo de cuenta
    └── sesiones.ts                   Sesiones del lado del servidor (token aleatorio de 256 bits)
```

## 3. Cómo ejecutar

```powershell
npm install
npm start                     # http://localhost:4200
```

> En este equipo el archivo `.env` ya está creado y apunta a **MySQL 8.4** (`DB_CLIENT=mysql`),
> con la base `taller_cifrado` ya cargada. `.env` está en `.gitignore`: al clonar el repo en otra
> máquina hay que crearlo con `Copy-Item .env.example .env`; sin `.env` la aplicación usa SQLite
> en `data/taller-cifrado.db`.

**Con MySQL** (lo que pide la guía), desde PowerShell:

```powershell
# 1. Instalar MySQL Community Server (una vez)
winget install Oracle.MySQL

# 2. Crear la base de datos y los usuarios iniciales.
#    OJO: PowerShell no soporta el operador "<" de bash; se usa "source".
$mysql = "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe"
& $mysql -u root -p -e "source database/schema.mysql.sql"

# 3. En .env: DB_CLIENT=mysql y las credenciales MYSQL_*
npm start

# 4. Verificar el estado de la tabla (evidencia para el informe)
& $mysql -u root -p -e "SELECT id, username, LEFT(password_hash, 29) AS alg_costo_salt, intentos_fallidos, bloqueado_hasta FROM taller_cifrado.usuarios;"
```

Ajusta la ruta de `mysql.exe` a la versión que instales (o usa `mysql` a secas si agregaste
la carpeta `bin` al PATH). Con XAMPP la ruta suele ser `C:\xampp\mysql\bin\mysql.exe`.

**Producción:** `npm run build` y luego `npm run serve:ssr:Taller-cifrado` (puerto 4000).

Usuarios iniciales:

| Usuario | Contraseña | Rol |
| --- | --- | --- |
| `admin` | `Admin2026*` | Administrador |
| `usuario` | `Usuario2026*` | Usuario |

Para crear el hash de otra contraseña: `npm run hash -- "MiClave123"`.

## 4. Prueba demostrativa del bloqueo

Con el servidor corriendo:

```bash
npm run demo:fuerza-bruta                               # contra http://localhost:4200
BASE_URL=http://localhost:4000 npm run demo:fuerza-bruta # contra el build de producción
```

Salida obtenida (con `BLOQUEO_MINUTOS=1` para no esperar 15 minutos):

```
Intento  1 | HTTP 401 | Usuario o contraseña incorrectos. Intentos restantes antes del bloqueo: 4.
Intento  2 | HTTP 401 | Usuario o contraseña incorrectos. Intentos restantes antes del bloqueo: 3.
Intento  3 | HTTP 401 | Usuario o contraseña incorrectos. Intentos restantes antes del bloqueo: 2.
Intento  4 | HTTP 401 | Usuario o contraseña incorrectos. Intentos restantes antes del bloqueo: 1.
Intento  5 | HTTP 429 | Retry-After: 60s | Demasiados intentos fallidos. Su IP ha sido bloqueada temporalmente...
Intento  6 | HTTP 429 | Retry-After: 60s | Demasiados intentos fallidos. Su IP ha sido bloqueada temporalmente...

Último intento con la contraseña CORRECTA (debe seguir bloqueado):
Intento  7 | HTTP 429 | Retry-After: 60s | Demasiados intentos fallidos. Su IP ha sido bloqueada temporalmente...
```

Evidencias sugeridas para capturas:

1. Salida del script anterior (terminal).
2. Pestaña *Network* del navegador mostrando el `429 Too Many Requests` y el botón
   "IP bloqueada · N s" en el formulario tras 5 intentos fallidos manuales.
3. Panel "Usuarios registrados" (entrar como `admin`): columna *Intentos fallidos* = 5 y
   *Bloqueado hasta* con fecha para la cuenta atacada.
4. Registrar dos usuarios con **la misma contraseña** y mostrar en el panel que sus salts
   (`$2b$10$<22 caracteres>`) son distintos.
5. Consulta en la BD: `SELECT username, password_hash, intentos_fallidos, bloqueado_hasta FROM usuarios;`
6. Intento de saltarse el cliente: `curl http://localhost:4200/` sin cookie devuelve `302 → /login`,
   y `curl -X POST .../api/auth/login` directo sigue sujeto al middleware.

Nota: el bloqueo por IP vive en memoria, así que reiniciar el servidor lo limpia. El bloqueo de
la cuenta está en la BD y se levanta al vencer `bloqueado_hasta` o con "Desbloquear" en el panel.

## 5. Medidas de seguridad implementadas

| Medida | Detalle |
| --- | --- |
| BCrypt con salt automático | Costo 10 (`BCRYPT_SALT_ROUNDS`); el hash completo va en `password_hash`, sin columna de salt |
| Bloqueo por IP (middleware) | 5 fallos consecutivos en 15 min → 429 + `Retry-After` durante 15 min; corta antes de tocar la BD |
| Bloqueo por cuenta (BD) | `intentos_fallidos` / `bloqueado_hasta`: frena ataques distribuidos desde muchas IP → 423 |
| Mensajes genéricos | "Usuario o contraseña incorrectos" sin decir cuál falló |
| Tiempo constante ante usuario inexistente | Se ejecuta `bcrypt.compare` contra un hash ficticio |
| Sesión del lado del servidor | Token aleatorio de 32 bytes en cookie `HttpOnly`, `SameSite=Strict`, `Secure` configurable; se regenera en cada login |
| Protección de páginas en el servidor | `protegerPaginas` redirige antes del render SSR; los guards de Angular solo mejoran la navegación |
| RBAC | `requiereRol('Administrador')` en `/api/admin/*` → 403 para otros roles |
| Validación en servidor | Usuario 3–50 caracteres, contraseña ≥ 8 con letras y números, máximo 72 bytes (límite de BCrypt) |
| SQL parametrizado | Consultas con `?` en mysql2 y node:sqlite (sin concatenar entradas) |
| Formulario | `method="post"`, `autocomplete="username"` / `current-password` / `new-password` |
| Límite de cuerpo y cabeceras | JSON/urlencoded ≤ 10 kB, `x-powered-by` deshabilitado, errores internos sin detalles |

Limitaciones a mencionar: el `Map` de IPs y las sesiones están en memoria (con varias instancias
del servidor se usaría Redis); detrás de un proxy inverso hay que configurar `app.set('trust proxy', ...)`
para que `req.ip` sea la IP real; y no hay HTTPS en local.

## 6. Ideas para el documento de conclusiones

Argumentos para justificar por qué la seguridad no puede validarse en el navegador:

- **El cliente está bajo control del atacante.** Con DevTools puede editar el HTML, quitar
  `required`/`maxlength`, poner breakpoints o reescribir funciones JavaScript.
- **Se puede ignorar el navegador por completo.** El script `demo-fuerza-bruta.mjs` o un simple
  `curl` hablan directamente con `/api/auth/login`; ninguna validación del frontend se ejecuta.
  Por eso el bloqueo solo funciona porque está en el middleware del servidor.
- **Hashear en el cliente no protege.** Si el navegador enviara el hash, ese hash se convertiría en
  la contraseña real (*pass-the-hash*), y quien robe la BD podría usarlo tal cual.
- **Un contador de intentos en JavaScript o `localStorage` se reinicia** recargando la página,
  abriendo una ventana privada o borrando el almacenamiento.
- **El código del cliente es público.** Cualquier secreto, regla o consulta que viva en el bundle
  JS puede leerse; la BD y las credenciales solo deben ser accesibles desde el servidor.
- **Las validaciones del cliente sí sirven, pero para usabilidad** (feedback inmediato, menos
  peticiones), nunca como control de seguridad. Deben repetirse siempre en el servidor.
- **Defensa en profundidad:** BCrypt (protege si se filtra la BD) + bloqueo por IP (frena un
  atacante) + bloqueo por cuenta (frena ataques distribuidos) + sesión `HttpOnly` (no la roba un XSS).
