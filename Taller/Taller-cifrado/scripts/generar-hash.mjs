// Genera un hash BCrypt para insertar usuarios manualmente en la base de datos.
// Uso:  npm run hash -- "MiContraseña123"
import bcrypt from 'bcrypt';

const password = process.argv[2];
if (!password) {
  console.error('Uso: npm run hash -- "MiContraseña123"');
  process.exit(1);
}

const hash = await bcrypt.hash(password, Number(process.env.BCRYPT_SALT_ROUNDS) || 10);
console.log(hash);
