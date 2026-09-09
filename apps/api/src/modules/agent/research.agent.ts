import { randomUUID } from 'crypto';
import { sql } from '../../db/client.js';
import { getLLMProvider } from '../llm/index.js';
import { synthesizeResearchPrompt, ResearchSynthesisContext } from '../../prompts/research.v1.js';
import { env } from '../../config/env.js';

export class ResearchAgent {
  private llm = getLLMProvider();

  async runResearch(socialAccountId: string, category: string, questions: string[]) {
    const runId = randomUUID();
    
    // 1. Create run record
    await sql`
      INSERT INTO agent_runs (id, run_type, social_account_id, status)
      VALUES (${runId}, 'RESEARCH', ${socialAccountId}, 'running')
    `;

    try {
      // 2. Fetch Goal
      const goals = await sql`SELECT * FROM admin_goals WHERE social_account_id = ${socialAccountId} AND is_active = true LIMIT 1`;
      const goal = goals[0];

      if (!goal) throw new Error('No active goal found');

      // 3. Execute Search (Serper)
      const query = questions.join(' ');
      const searchRes = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': env.SERPER_API_KEY || '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ q: query })
      });
      
      const searchData = await searchRes.json();
      const sources = (searchData.organic || []).slice(0, 5).map((r: any) => ({
        title: r.title,
        snippet: r.snippet,
        url: r.link
      }));

      // 4. Synthesize with LLM
      const context: ResearchSynthesisContext = {
        query,
        category,
        sources,
        goal: goal.goalType,
      };

      const prompt = synthesizeResearchPrompt(context);
      const llmResponse = await this.llm.generateStructured(prompt);

      if (!llmResponse.structured) throw new Error('Failed to parse synthesis');

      const synthesis = llmResponse.structured;

      // 5. Save Results
      const researchRun = await sql`
        INSERT INTO research_runs (
          social_account_id, query, synthesized_findings
        ) VALUES (
          ${socialAccountId}, ${JSON.stringify({ questions, category })}, ${synthesis}
        ) RETURNING id
      `;

      // 6. Complete agent run
      await sql`
        UPDATE agent_runs 
        SET status = 'completed', completed_at = NOW(), output = ${JSON.stringify({ researchRunId: researchRun[0].id })}
        WHERE id = ${runId}
      `;

      return { success: true, researchRunId: researchRun[0].id, synthesis };

    } catch (error: any) {
      await sql`
        UPDATE agent_runs 
        SET status = 'failed', completed_at = NOW(), error = ${JSON.stringify({ message: error.message })}
        WHERE id = ${runId}
      `;
      throw error;
    }
  }
}
