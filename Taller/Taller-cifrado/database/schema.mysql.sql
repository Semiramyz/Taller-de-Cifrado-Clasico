-- =====================================================================
-- Taller: Módulo de inicio de sesión seguro (Seguridad de la Información 2026-II)
-- Script completo para MySQL / MariaDB: creación de tablas + datos iniciales.
--
-- Uso:  mysql -u root -p < database/schema.mysql.sql
-- =====================================================================

CREATE DATABASE IF NOT EXISTS taller_cifrado
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE taller_cifrado;

DROP TABLE IF EXISTS usuarios;
DROP TABLE IF EXISTS roles;

-- Roles para control de acceso basado en roles (RBAC)
CREATE TABLE roles (
  id     INT          AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(50)  NOT NULL UNIQUE
) ENGINE = InnoDB;

-- Usuarios: la contraseña NUNCA se guarda en claro, solo el hash BCrypt completo
-- ($2b$<costo>$<salt de 22 chars><hash de 31 chars>), por eso no hay columna "salt".
CREATE TABLE usuarios (
  id                INT          AUTO_INCREMENT PRIMARY KEY,
  username          VARCHAR(50)  NOT NULL UNIQUE,
  password_hash     VARCHAR(255) NOT NULL,
  rol_id            INT          NOT NULL,
  intentos_fallidos INT          NOT NULL DEFAULT 0,
  bloqueado_hasta   DATETIME     NULL,
  FOREIGN KEY (rol_id) REFERENCES roles (id)
) ENGINE = InnoDB;

INSERT INTO roles (nombre) VALUES ('Administrador'), ('Usuario');

-- Usuarios iniciales. Hashes generados con bcrypt (costo 10):
--   admin   / Admin2026*
--   usuario / Usuario2026*
-- Para generar otro hash:  npm run hash -- "MiContraseña"
INSERT INTO usuarios (username, password_hash, rol_id) VALUES
  ('admin',   '$2b$10$3SeU.pkIYwDN09F7TU9Ea.i3kGurTVyiF.zYw1pdzhvWUNe5pvY66',
     (SELECT id FROM roles WHERE nombre = 'Administrador')),
  ('usuario', '$2b$10$D5Ma8k7M5E2FxAbOJmHCA.walDXfJSykmxssBYaHT.566jnwKk07.',
     (SELECT id FROM roles WHERE nombre = 'Usuario'));
