import { Router } from 'express';
import { requiereRol, requiereSesion } from '../middlewares/sesion';
import { desbloquearUsuario, listarUsuarios } from '../servicios/auth.servicio';

export const adminRutas = Router();

adminRutas.use(requiereSesion, requiereRol('Administrador'));

adminRutas.get('/usuarios', async (_req, res) => {
  const usuarios = await listarUsuarios();
  res.json({
    usuarios: usuarios.map((usuario) => ({
      id: usuario.id,
      username: usuario.username,
      rol: usuario.rol,
      // Solo "$2b$10$" + salt (29 caracteres): evidencia que cada hash tiene su propio salt
      // sin exponer el hash completo.
      hashVisible: `${usuario.passwordHash.slice(0, 29)}…`,
      intentosFallidos: usuario.intentosFallidos,
      bloqueadoHasta: usuario.bloqueadoHasta?.toISOString() ?? null,
    })),
  });
});

adminRutas.post('/usuarios/:id/desbloquear', async (req, res) => {
  const id = Number(req.params['id']);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Identificador inválido.' });
  }

  await desbloquearUsuario(id);
  return res.json({ mensaje: 'Usuario desbloqueado.' });
});
