import { env } from '../../../config/env.js';
import { InstagramAdapter } from './instagram.adapter.js';
import { SimulatedInstagramAdapter } from './simulated.adapter.js';

export function getInstagramAdapter() {
  if (env.SIMULATION_MODE) {
    return new SimulatedInstagramAdapter();
  }
  return new InstagramAdapter();
}
