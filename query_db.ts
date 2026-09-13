import { sql } from './apps/api/src/db/client.js';

async function main() {
  console.log('Fetching latest agent run...');
  const runs = await sql`SELECT * FROM agent_runs ORDER BY created_at DESC LIMIT 1`;
  console.log('Latest Run:', runs[0]);

  if (runs.length > 0) {
    const runId = runs[0].id;
    console.log(`\nFetching steps for run ${runId}...`);
    const steps = await sql`SELECT id, step_type, status, error_message, created_at FROM agent_steps WHERE agent_run_id = ${runId} ORDER BY created_at ASC`;
    console.table(steps);

    console.log(`\nFetching events for run ${runId}...`);
    const events = await sql`SELECT event_type, level, message, created_at FROM agent_events WHERE agent_run_id = ${runId} ORDER BY created_at ASC`;
    console.table(events);
  }

  process.exit(0);
}

main().catch(console.error);
