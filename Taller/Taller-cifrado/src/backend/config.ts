import { existsSync } from 'node:fs';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

function numero(nombre: string, porDefecto: number): number {
  const valor = Number(process.env[nombre]);
  return Number.isFinite(valor) && valor > 0 ? valor : porDefecto;
}

const MINUTO = 60 * 1000;

export const config = {
  db: {
    cliente: process.env['DB_CLIENT'] === 'mysql' ? 'mysql' : 'sqlite',
    sqliteRuta: process.env['SQLITE_PATH'] || 'data/taller-cifrado.db',
    mysql: {
      host: process.env['MYSQL_HOST'] || 'localhost',
      port: numero('MYSQL_PORT', 3306),
      user: process.env['MYSQL_USER'] || 'root',
      password: process.env['MYSQL_PASSWORD'] ?? '',
      database: process.env['MYSQL_DATABASE'] || 'taller_cifrado',
    },
  },
  /** Factor de costo de BCrypt: 2^10 = 1.024 rondas. */
  bcryptRondas: numero('BCRYPT_SALT_ROUNDS', 10),
  fuerzaBruta: {
    maxIntentos: numero('MAX_INTENTOS', 5),
    ventanaMs: numero('VENTANA_MINUTOS', 15) * MINUTO,
    bloqueoMs: numero('BLOQUEO_MINUTOS', 15) * MINUTO,
  },
  sesion: {
    nombreCookie: 'sid',
    duracionMs: numero('SESION_HORAS', 2) * 60 * MINUTO,
    cookieSegura: process.env['COOKIE_SECURE'] === 'true',
  },
} as const;
