import bcrypt from 'bcrypt';
import { config } from '../config';

/**
 * Registro: genera el salt aleatorio y el hash en un solo paso.
 * El resultado ($2b$10$<salt><hash>) se guarda completo en usuarios.password_hash.
 */
export function generarHash(passwordPlano: string): Promise<string> {
  return bcrypt.hash(passwordPlano, config.bcryptRondas);
}

/**
 * Login: bcrypt extrae el salt y el costo del hash almacenado, procesa la contraseña
 * ingresada con esos mismos parámetros y compara en tiempo constante.
 */
export function verificarPassword(passwordIngresado: string, hashAlmacenado: string): Promise<boolean> {
  return bcrypt.compare(passwordIngresado, hashAlmacenado);
}
