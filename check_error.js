require('dotenv').config();
const { sql } = require('./apps/api/dist/db/client.js');

async function run() {
  const runs = await sql`SELECT error FROM agent_runs ORDER BY started_at DESC LIMIT 1`;
  console.log(runs[0]?.error);
  process.exit(0);
}

run();
