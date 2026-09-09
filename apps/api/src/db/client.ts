import postgres from 'postgres';
import { env } from '../config/env.js';

export const sql = postgres(env.DATABASE_URL, {
  transform: postgres.camel,
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export default sql;
