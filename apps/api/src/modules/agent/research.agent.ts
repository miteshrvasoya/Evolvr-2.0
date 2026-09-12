import { randomUUID } from 'crypto';
import { sql } from '../../db/client.js';
import { getLLMProvider } from '../llm/index.js';
import { synthesizeResearchPrompt, ResearchSynthesisContext } from '../../prompts/research.v1.js';
import { env } from '../../config/env.js';
import { AgentRunTracker } from './agent-tracker.js';

export class ResearchAgent {
  private llm = getLLMProvider();

  async runResearch(socialAccountId: string, goalId: string, agentRunId: string, attemptNumber: number, maxAttempts: number) {
    const tracker = new AgentRunTracker(agentRunId);
    const stepId = await tracker.startStep('run_research', attemptNumber, maxAttempts);

    try {
      await tracker.addLog(`Starting research phase for account ${socialAccountId}`);

      // 1. Fetch Goal
      const goals = await sql`SELECT * FROM admin_goals WHERE id = ${goalId} AND is_active = true LIMIT 1`;
      const goal = goals[0];

      if (!goal) throw new Error('No active goal found');

      const category = 'industry_trends';
      const questions = [
        `Latest trends in ${goal.goal_type || 'social media'}`,
        `What is currently going viral in this niche?`
      ];

      // 2. Execute Search (Tavily or Serper)
      const query = questions.join(' ');
      let sources: Array<{ title: string, snippet: string, url: string }> = [];

      const start = Date.now();
      if (env.RESEARCH_PROVIDER === 'tavily') {
        const searchRes = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            api_key: env.TAVILY_API_KEY,
            query: query,
            search_depth: 'advanced',
            include_answer: false,
            max_results: 5,
          })
        });

        const latencyMs = Date.now() - start;
        await tracker.logToolCall(stepId, `Tavily Search: "${query}"`, 'tavily', 'https://api.tavily.com/search', searchRes.status, latencyMs);
        
        if (!searchRes.ok) throw new Error(`Tavily API error: ${searchRes.statusText}`);
        
        const searchData = await searchRes.json();
        sources = (searchData.results || []).map((r: any) => ({
          title: r.title,
          snippet: r.content,
          url: r.url
        }));
      } else {
        const searchRes = await fetch('https://google.serper.dev/search', {
          method: 'POST',
          headers: {
            'X-API-KEY': env.SERPER_API_KEY || '',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ q: query })
        });
        
        const latencyMs = Date.now() - start;
        await tracker.logToolCall(stepId, `Serper Search: "${query}"`, 'serper', 'https://google.serper.dev/search', searchRes.status, latencyMs);

        if (!searchRes.ok) throw new Error(`Serper API error: ${searchRes.statusText}`);

        const searchData = await searchRes.json();
        sources = (searchData.organic || []).slice(0, 5).map((r: any) => ({
          title: r.title,
          snippet: r.snippet,
          url: r.link
        }));
      }

      await tracker.addLog(`Found ${sources.length} sources from search.`);

      // 3. Synthesize with LLM
      const context: ResearchSynthesisContext = {
        query,
        category,
        sources,
        goal: goal.goal_type,
      };

      const prompt = synthesizeResearchPrompt(context);
      
      const llmResponse = await this.llm.generateStructured(prompt);

      await tracker.logLlmCall(
        stepId, 
        'Synthesized research findings', 
        'research_synthesis', 
        llmResponse.model, 
        llmResponse.latencyMs, 
        llmResponse.inputTokens, 
        llmResponse.outputTokens
      );

      if (!llmResponse.structured) throw new Error('Failed to parse synthesis');

      const synthesis = llmResponse.structured;

      // 4. Save Results
      const researchRun = await sql`
        INSERT INTO research_runs (
          social_account_id, query, synthesized_findings
        ) VALUES (
          ${socialAccountId}, ${JSON.stringify({ questions, category })}, ${sql.json(synthesis || {})}
        ) RETURNING id
      `;

      await tracker.completeStep(stepId, { researchRunId: researchRun[0].id, synthesis });

      return { success: true, researchRunId: researchRun[0].id, synthesis };

    } catch (error: any) {
      await tracker.failStep(stepId, error.message, true, new Date(Date.now() + 5000));
      throw { error, stepId };
    }
  }
}
