-- Equivalente SQLite de schema.mysql.sql, usado para desarrollo local sin instalar MySQL.
-- El servidor lo ejecuta automáticamente la primera vez (DB_CLIENT=sqlite).

PRAGMA foreign_keys = ON;

CREATE TABLE roles (
  id     INTEGER     PRIMARY KEY AUTOINCREMENT,
  nombre VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE usuarios (
  id                INTEGER      PRIMARY KEY AUTOINCREMENT,
  username          VARCHAR(50)  NOT NULL UNIQUE,
  password_hash     VARCHAR(255) NOT NULL,
  rol_id            INTEGER      NOT NULL,
  intentos_fallidos INTEGER      NOT NULL DEFAULT 0,
  bloqueado_hasta   DATETIME     NULL,
  FOREIGN KEY (rol_id) REFERENCES roles (id)
);

INSERT INTO roles (nombre) VALUES ('Administrador'), ('Usuario');

-- admin / Admin2026*   ·   usuario / Usuario2026*
INSERT INTO usuarios (username, password_hash, rol_id) VALUES
  ('admin',   '$2b$10$3SeU.pkIYwDN09F7TU9Ea.i3kGurTVyiF.zYw1pdzhvWUNe5pvY66',
     (SELECT id FROM roles WHERE nombre = 'Administrador')),
  ('usuario', '$2b$10$D5Ma8k7M5E2FxAbOJmHCA.walDXfJSykmxssBYaHT.566jnwKk07.',
     (SELECT id FROM roles WHERE nombre = 'Usuario'));
