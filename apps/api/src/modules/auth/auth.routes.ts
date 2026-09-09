import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { sql } from '../../db/client.js';
import { env } from '../../config/env.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export default async function authRoutes(app: FastifyInstance) {
  // Login Route
  app.post('/login', async (request, reply) => {
    const parseResult = loginSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Bad Request', issues: parseResult.error.issues });
    }

    const { email, password } = parseResult.data;

    // Find user
    const users = await sql`SELECT id, email, password_hash, role FROM users WHERE email = ${email} AND is_active = true LIMIT 1`;
    const user = users[0];

    if (!user) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid credentials' });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid credentials' });
    }

    // Sign token
    const token = await reply.jwtSign({
      id: user.id,
      email: user.email,
      role: user.role,
    }, {
      expiresIn: env.JWT_EXPIRES_IN,
    });

    // Set HTTP-only cookie
    reply.setCookie('auth_token', token, {
      domain: 'localhost',
      path: '/',
      secure: env.NODE_ENV === 'production', // Send cookie over HTTPS only in production
      httpOnly: true,
      sameSite: 'lax',
    });

    return reply.status(200).send({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        }
      }
    });
  });

  // Logout Route
  app.post('/logout', async (request, reply) => {
    reply.clearCookie('auth_token', { path: '/' });
    return reply.status(200).send({ message: 'Logged out successfully' });
  });

  // Get Current User (Protected)
  app.get('/me', { onRequest: [app.authenticate] }, async (request, reply) => {
    return reply.send({ user: request.user });
  });
}
