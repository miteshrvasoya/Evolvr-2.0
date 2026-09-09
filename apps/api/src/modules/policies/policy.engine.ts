export type RiskLevel = 'low' | 'medium' | 'high';
export type Decision = 'ALLOW' | 'REVIEW' | 'BLOCK';

export interface PolicyCheckResult {
  check: string;
  passed: boolean;
  reason?: string;
  risk: RiskLevel;
}

export interface PolicyDecision {
  decision: Decision;
  risk: RiskLevel;
  reasons: string[];
  requiresApproval: boolean;
  checkResults: PolicyCheckResult[];
}

export interface ContentContext {
  caption: string;
  concept: string;
  bannedTopics: string[];
  autonomyLevel: 'manual' | 'supervised' | 'autonomous';
}

export class PolicyEngine {
  
  async evaluate(content: ContentContext): Promise<PolicyDecision> {
    const checkResults: PolicyCheckResult[] = [];
    const reasons: string[] = [];
    let highestRisk: RiskLevel = 'low';

    // 1. Banned Topics Check (Deterministic)
    const lowerCaption = content.caption.toLowerCase();
    const foundBanned = content.bannedTopics.filter(topic => lowerCaption.includes(topic.toLowerCase()));
    
    if (foundBanned.length > 0) {
      checkResults.push({
        check: 'banned_topics',
        passed: false,
        reason: `Contains banned topics: ${foundBanned.join(', ')}`,
        risk: 'high'
      });
    } else {
      checkResults.push({ check: 'banned_topics', passed: true, risk: 'low' });
    }

    // 2. Factuality Check (Mocked for scaffold, normally an LLM call)
    // We assume it passes for scaffold
    checkResults.push({ check: 'factuality', passed: true, risk: 'low' });

    // 3. Brand Voice Check
    // We assume it passes for scaffold
    checkResults.push({ check: 'brand_voice', passed: true, risk: 'low' });

    // Aggregate risks
    for (const result of checkResults) {
      if (!result.passed) {
        reasons.push(result.reason || `Failed ${result.check}`);
        if (result.risk === 'high') highestRisk = 'high';
        if (result.risk === 'medium' && highestRisk !== 'high') highestRisk = 'medium';
      }
    }

    // Determine final decision based on Autonomy Mode
    let decision: Decision = 'ALLOW';
    let requiresApproval = false;

    if (highestRisk === 'high') {
      decision = 'BLOCK';
      requiresApproval = false; // Blocked entirely
    } else if (content.autonomyLevel === 'manual') {
      decision = 'REVIEW';
      requiresApproval = true;
    } else if (content.autonomyLevel === 'supervised') {
      if (highestRisk === 'medium') {
        decision = 'REVIEW';
        requiresApproval = true;
      }
    } else if (content.autonomyLevel === 'autonomous') {
      // In autonomous, medium risk is allowed
      if (highestRisk === 'medium') {
        decision = 'ALLOW';
      }
    }

    return {
      decision,
      risk: highestRisk,
      reasons,
      requiresApproval,
      checkResults,
    };
  }
}
