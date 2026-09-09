import bcrypt from 'bcryptjs';
import { sql } from './client.js';

async function seed() {
  console.log('🌱 Starting database seed...');

  const passwordHash = await bcrypt.hash('admin123', 10);

  try {
    const result = await sql`
      INSERT INTO users (email, name, password_hash, role, is_active)
      VALUES (
        'admin@evolvr.local', 
        'System Admin', 
        ${passwordHash}, 
        'admin', 
        true
      )
      ON CONFLICT (email) DO NOTHING
      RETURNING id, email
    `;

    if (result.length > 0) {
      console.log('✅ Admin user created:');
      console.log(`   Email: ${result[0].email}`);
      console.log(`   Password: admin123`);
    } else {
      console.log('ℹ️ Admin user already exists. Skipping.');
    }
  } catch (error) {
    console.error('❌ Failed to seed database:', error);
  } finally {
    await sql.end();
    console.log('🏁 Seeding finished.');
  }
}

seed().catch(console.error);
