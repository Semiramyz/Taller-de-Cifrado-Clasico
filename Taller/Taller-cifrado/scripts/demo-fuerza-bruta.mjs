// Prueba demostrativa: simula un ataque de fuerza bruta contra /api/auth/login.
//
// Uso:  npm run demo:fuerza-bruta -- [usuario] [contraseñaCorrecta]
//   BASE_URL=http://localhost:4000 npm run demo:fuerza-bruta   (servidor de producción)
//
// Resultado esperado: intentos 1-4 -> 401, intento 5 -> 429 (IP bloqueada) y, a partir de ahí,
// 429 incluso con la contraseña correcta, porque el middleware corta antes del controlador.

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4200';
const usuario = process.argv[2] ?? 'admin';
const passwordCorrecta = process.argv[3] ?? 'Admin2026*';
const TOTAL_FALLIDOS = 6;

async function intentar(numero, password) {
  const respuesta = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: usuario, password }),
  });
  const cuerpo = await respuesta.json().catch(() => ({}));
  const retryAfter = respuesta.headers.get('retry-after');

  console.log(
    `Intento ${String(numero).padStart(2)} | HTTP ${respuesta.status}` +
      (retryAfter ? ` | Retry-After: ${retryAfter}s` : '') +
      ` | ${cuerpo.error ?? JSON.stringify(cuerpo)}`,
  );
}

console.log(`Atacando ${BASE_URL}/api/auth/login con el usuario "${usuario}"\n`);

for (let i = 1; i <= TOTAL_FALLIDOS; i += 1) {
  await intentar(i, `clave-incorrecta-${i}`);
}

console.log('\nÚltimo intento con la contraseña CORRECTA (debe seguir bloqueado):');
await intentar(TOTAL_FALLIDOS + 1, passwordCorrecta);
