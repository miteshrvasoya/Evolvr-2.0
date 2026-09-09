import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, BrainCircuit, CheckCircle2, XCircle } from "lucide-react";

export default function AgentThinkingPage() {
  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Agent Thinking & Logs</h2>
      </div>
      <p className="text-muted-foreground">
        Transparent view into the agent&apos;s decision-making process, internal reasoning, and LLM prompts.
      </p>

      <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-3">
        {/* Mock Decision Log */}
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Recent Decisions</CardTitle>
            <CardDescription>Live log of autonomous decisions.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {[
                {
                  id: 1,
                  type: 'STRATEGY_UPDATE',
                  reason: 'Educational reels outperformed product posts by 2.4x. Shifting mix.',
                  confidence: 0.85,
                  time: '10 minutes ago',
                  status: 'executed'
                },
                {
                  id: 2,
                  type: 'GENERATE_CONTENT',
                  reason: 'Drafted 3 new posts matching the "Educational" pillar.',
                  confidence: 0.92,
                  time: '1 hour ago',
                  status: 'executed'
                },
                {
                  id: 3,
                  type: 'POLICY_BLOCK',
                  reason: 'Content idea flagged for unsupported factual claims.',
                  confidence: 0.99,
                  time: '2 hours ago',
                  status: 'blocked'
                }
              ].map((decision) => (
                <div key={decision.id} className="flex items-center">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium leading-none">{decision.type}</p>
                      {decision.status === 'blocked' ? (
                        <Badge variant="destructive">Blocked</Badge>
                      ) : (
                        <Badge variant="default" className="bg-green-600">Executed</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {decision.reason}
                    </p>
                  </div>
                  <div className="ml-auto font-medium text-sm flex flex-col items-end">
                    <span className="flex items-center text-muted-foreground">
                      <Clock className="mr-1 h-3 w-3" />
                      {decision.time}
                    </span>
                    <span className="text-xs text-muted-foreground mt-1">
                      Conf: {(decision.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Mock LLM Trace / Details */}
        <Card>
          <CardHeader>
            <CardTitle>Decision Inspector</CardTitle>
            <CardDescription>Click a decision to view prompts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md bg-muted p-4 space-y-4">
              <div>
                <h4 className="text-sm font-semibold flex items-center gap-2 mb-1">
                  <BrainCircuit className="h-4 w-4" /> System Prompt
                </h4>
                <div className="text-xs text-muted-foreground font-mono bg-background p-2 rounded border max-h-32 overflow-y-auto">
                  You are the strategy agent for a social media account...
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold flex items-center gap-2 mb-1">
                  User Context
                </h4>
                <div className="text-xs text-muted-foreground font-mono bg-background p-2 rounded border max-h-32 overflow-y-auto">
                  Goal: 10K followers
                  Recent performance: [Metrics JSON]
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold flex items-center gap-2 mb-1">
                  Model Output
                </h4>
                <div className="text-xs text-muted-foreground font-mono bg-background p-2 rounded border max-h-32 overflow-y-auto">
                  {`{
  "contentMix": { "education": 0.5, "product": 0.1 },
  "rationale": "Educational reels outperformed..."
}`}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
