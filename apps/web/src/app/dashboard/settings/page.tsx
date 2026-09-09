'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Save, CheckCircle, XCircle, Wifi, WifiOff } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/lib/hooks/use-toast';
import { apiClient } from '@/lib/api-client';
import type {
  GoalType,
  PrimaryMetric,
  AutonomyMode,
  LLMProviderName,
} from '@evolvr/types';

// ── Goal Form ──────────────────────────────────────────────────────────────────

const goalSchema = z.object({
  goalType: z.enum(['GROW_ACCOUNT', 'INCREASE_ENGAGEMENT', 'DRIVE_TRAFFIC', 'BUILD_BRAND_AWARENESS', 'GENERATE_LEADS']),
  primaryMetric: z.enum(['followers', 'reach', 'engagement_rate', 'profile_visits', 'website_clicks', 'shares', 'saves']),
  target: z.number().min(1),
  deadline: z.string().min(1),
  audience: z.string().min(1),
  businessOutcome: z.string().min(1),
  autonomyLevel: z.enum(['manual', 'supervised', 'autonomous']),
  noPolitics: z.boolean(),
  noControversialContent: z.boolean(),
});

type GoalFormData = z.infer<typeof goalSchema>;

function GoalTab() {
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<GoalFormData>({
    resolver: zodResolver(goalSchema),
    defaultValues: {
      goalType: 'GROW_ACCOUNT',
      primaryMetric: 'followers',
      autonomyLevel: 'supervised',
      noPolitics: true,
      noControversialContent: true,
    },
  });

  async function onSubmit(data: GoalFormData) {
    setSaving(true);
    try {
      await apiClient.post('/api/settings/goal', data);
      toast({ title: 'Goal saved', description: 'Your goal has been updated.' });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not save goal.' });
    } finally {
      setSaving(false);
    }
  }

  const autonomyLevel = watch('autonomyLevel');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Goal Configuration</CardTitle>
        <CardDescription>Define what you want the agent to achieve</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Goal Type</Label>
              <Select onValueChange={(v) => setValue('goalType', v as GoalType)} defaultValue="GROW_ACCOUNT">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GROW_ACCOUNT">Grow Account</SelectItem>
                  <SelectItem value="INCREASE_ENGAGEMENT">Increase Engagement</SelectItem>
                  <SelectItem value="DRIVE_TRAFFIC">Drive Traffic</SelectItem>
                  <SelectItem value="BUILD_BRAND_AWARENESS">Build Brand Awareness</SelectItem>
                  <SelectItem value="GENERATE_LEADS">Generate Leads</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Primary Metric</Label>
              <Select onValueChange={(v) => setValue('primaryMetric', v as PrimaryMetric)} defaultValue="followers">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="followers">Followers</SelectItem>
                  <SelectItem value="reach">Reach</SelectItem>
                  <SelectItem value="engagement_rate">Engagement Rate</SelectItem>
                  <SelectItem value="profile_visits">Profile Visits</SelectItem>
                  <SelectItem value="website_clicks">Website Clicks</SelectItem>
                  <SelectItem value="shares">Shares</SelectItem>
                  <SelectItem value="saves">Saves</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="target">Target Value</Label>
              <Input
                id="target"
                type="number"
                placeholder="e.g. 10000"
                {...register('target', { valueAsNumber: true })}
              />
              {errors.target && <p className="text-xs text-destructive">{errors.target.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="deadline">Deadline</Label>
              <Input id="deadline" type="date" {...register('deadline')} />
              {errors.deadline && <p className="text-xs text-destructive">{errors.deadline.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="audience">Target Audience Description</Label>
            <Input
              id="audience"
              placeholder="e.g. Indie SaaS founders, B2B marketers..."
              {...register('audience')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="businessOutcome">Business Outcome</Label>
            <Input
              id="businessOutcome"
              placeholder="e.g. Drive sign-ups to our newsletter"
              {...register('businessOutcome')}
            />
          </div>

          <Separator />

          {/* Autonomy */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Autonomy Level</h3>
            <div className="grid grid-cols-3 gap-3">
              {(['manual', 'supervised', 'autonomous'] as AutonomyMode[]).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setValue('autonomyLevel', level)}
                  className={`rounded-lg border-2 p-4 text-left transition-colors ${autonomyLevel === level
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/50'
                    }`}
                >
                  <p className="font-medium capitalize">{level}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {level === 'manual' && 'Agent plans, you approve everything'}
                    {level === 'supervised' && 'Auto-approve low-risk, review high-risk'}
                    {level === 'autonomous' && 'Agent acts fully independently'}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Constraints */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Content Constraints</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>No Political Content</Label>
                <Switch
                  checked={watch('noPolitics')}
                  onCheckedChange={(v) => setValue('noPolitics', v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>No Controversial Content</Label>
                <Switch
                  checked={watch('noControversialContent')}
                  onCheckedChange={(v) => setValue('noControversialContent', v)}
                />
              </div>
            </div>
          </div>

          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Goal
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ── Platform Connection Tab ────────────────────────────────────────────────────

function PlatformTab() {
  const [simMode, setSimMode] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [account, setAccount] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAccounts() {
      try {
        const data = await apiClient.get<{ accounts: any[] }>('/api/accounts');
        if (data.accounts && data.accounts.length > 0) {
          setAccount(data.accounts[0]);
        }
      } catch (e) {
        console.error('Failed to load accounts', e);
      } finally {
        setLoading(false);
      }
    }
    loadAccounts();
  }, []);

  async function handleConnect() {
    setConnecting(true);
    try {
      const { url } = await apiClient.get<{ url: string }>('/api/oauth/instagram/url');
      window.location.href = url;
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not connect Instagram' });
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Instagram
                {account ? (
                  <Badge variant="default" className="bg-green-500 hover:bg-green-600 font-normal">
                    <Wifi className="mr-1 h-3 w-3" />
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="font-normal">
                    <WifiOff className="mr-1 h-3 w-3" />
                    Disconnected
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>Connect your Instagram Business account</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading...</span>
            </div>
          ) : account ? (
            <div className="flex items-center space-x-4 border rounded-lg p-4">
              {account.profile_image_url ? (
                <img src={account.profile_image_url} alt={account.username} className="h-12 w-12 rounded-full" />
              ) : (
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <span className="text-xl font-bold uppercase">{account.username?.[0] || 'I'}</span>
                </div>
              )}
              <div>
                <p className="font-medium text-lg">{account.display_name || account.username}</p>
                <p className="text-sm text-muted-foreground">@{account.username}</p>
              </div>
            </div>
          ) : (
            <Button variant="outline" onClick={handleConnect} disabled={connecting}>
              {connecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wifi className="mr-2 h-4 w-4" />}
              Connect Instagram
            </Button>
          )}
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Simulation Mode</p>
              <p className="text-xs text-muted-foreground">
                Posts will be generated but not actually published
              </p>
            </div>
            <Switch checked={simMode} onCheckedChange={setSimMode} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


// ── LLM Config Tab ────────────────────────────────────────────────────────────

const LLM_MODELS: Record<LLMProviderName, string[]> = {
  openrouter: ['openai/gpt-4o', 'openai/gpt-4o-mini', 'anthropic/claude-3-5-sonnet', 'meta-llama/llama-3.1-70b-instruct'],
  gemini: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'],
};

function LLMTab() {
  const [provider, setProvider] = useState<LLMProviderName>('openrouter');
  const [apiKey, setApiKey] = useState('');
  const [defaultModel, setDefaultModel] = useState('');
  const [strongModel, setStrongModel] = useState('');
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const models = LLM_MODELS[provider] ?? [];

  async function handleTest() {
    setTesting(true);
    try {
      await apiClient.post('/api/settings/llm/test', { provider, apiKey });
      toast({ title: 'Connection successful', description: 'LLM provider is reachable.' });
    } catch {
      toast({ variant: 'destructive', title: 'Connection failed', description: 'Could not reach LLM provider.' });
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await apiClient.post('/api/settings/llm', { provider, apiKey, defaultModel, strongModel });
      toast({ title: 'LLM config saved' });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not save LLM config.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>LLM Configuration</CardTitle>
        <CardDescription>Configure the language model provider and models</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Provider</Label>
          <Select onValueChange={(v) => setProvider(v as LLMProviderName)} value={provider}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="openrouter">OpenRouter</SelectItem>
              <SelectItem value="gemini">Google Gemini</SelectItem>
              <SelectItem value="openai">OpenAI</SelectItem>
              <SelectItem value="anthropic">Anthropic</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="apiKey">API Key</Label>
          <Input
            id="apiKey"
            type="password"
            placeholder="sk-..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Default Model</Label>
            <Select onValueChange={setDefaultModel} value={defaultModel}>
              <SelectTrigger>
                <SelectValue placeholder="Select model..." />
              </SelectTrigger>
              <SelectContent>
                {models.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Strong Model (for complex tasks)</Label>
            <Select onValueChange={setStrongModel} value={strongModel}>
              <SelectTrigger>
                <SelectValue placeholder="Select model..." />
              </SelectTrigger>
              <SelectContent>
                {models.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={handleTest} disabled={testing}>
            {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
            Test Connection
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Config
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Autonomy Controls Tab ──────────────────────────────────────────────────────

function AutonomyTab() {
  const [mode, setMode] = useState<AutonomyMode>('supervised');

  const riskPolicies = [
    { level: 'Low Risk', description: 'Regular content posts, minor edits', auto: true },
    { level: 'Medium Risk', description: 'Strategy changes, new experiments', auto: mode === 'autonomous' },
    { level: 'High Risk', description: 'Platform reconnection, goal changes', auto: false },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Autonomy Mode</CardTitle>
          <CardDescription>Control how much the agent acts independently</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {(['manual', 'supervised', 'autonomous'] as AutonomyMode[]).map((level) => (
              <button
                key={level}
                onClick={() => setMode(level)}
                className={`rounded-xl border-2 p-5 text-left transition-all ${mode === level ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-muted-foreground/50'
                  }`}
              >
                <p className="font-semibold capitalize">{level}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {level === 'manual' && 'Every action requires your approval before execution'}
                  {level === 'supervised' && 'Low-risk actions auto-execute. High-risk requires approval'}
                  {level === 'autonomous' && 'Agent operates completely independently 24/7'}
                </p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Risk Policy Table</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="pb-2 text-left font-medium">Risk Level</th>
                <th className="pb-2 text-left font-medium">Examples</th>
                <th className="pb-2 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {riskPolicies.map((policy) => (
                <tr key={policy.level} className="border-b last:border-0">
                  <td className="py-3 pr-4 font-medium">{policy.level}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{policy.description}</td>
                  <td className="py-3 text-right">
                    <Badge variant={policy.auto ? 'success' : 'warning'}>
                      {policy.auto ? 'Auto-execute' : 'Approval Required'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Account Profile Tab ────────────────────────────────────────────────────────

function ProfileTab() {
  const [saving, setSaving] = useState(false);
  const [niche, setNiche] = useState('');
  const [valueProposition, setValueProposition] = useState('');

  async function handleSave() {
    setSaving(true);
    try {
      await apiClient.patch('/api/settings/profile', { niche, valueProposition });
      toast({ title: 'Profile saved' });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not save profile.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account Profile</CardTitle>
        <CardDescription>Brand memory and voice configuration</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="niche">Niche</Label>
          <Input
            id="niche"
            placeholder="e.g. B2B SaaS for developers"
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="vp">Value Proposition</Label>
          <Input
            id="vp"
            placeholder="e.g. We help developers ship faster with AI-powered code review"
            value={valueProposition}
            onChange={(e) => setValueProposition(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Brand Voice Tones</Label>
          <div className="flex flex-wrap gap-2">
            {['practical', 'credible', 'concise', 'inspiring', 'educational', 'conversational', 'bold'].map((tone) => (
              <button
                key={tone}
                type="button"
                className="rounded-full border px-3 py-1 text-xs font-medium hover:bg-accent transition-colors"
              >
                {tone}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="maxPosts">Max Posts Per Day</Label>
            <Input id="maxPosts" type="number" defaultValue={3} min={1} max={10} />
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Profile
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Main Settings Page ─────────────────────────────────────────────────────────

import { useSearchParams } from 'next/navigation';
import { useEffect, Suspense } from 'react';

function SettingsContent() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');

    if (success === 'instagram_connected') {
      toast({ title: 'Success', description: 'Instagram account connected successfully!' });
    }
    if (error) {
      toast({ variant: 'destructive', title: 'Connection Failed', description: error });
    }
  }, [searchParams]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Settings</h2>
        <p className="text-muted-foreground text-sm">Configure your Evolvr autonomous agent</p>
      </div>

      <Tabs defaultValue="goal">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="goal">Goal</TabsTrigger>
          <TabsTrigger value="profile">Account Profile</TabsTrigger>
          <TabsTrigger value="platform">Platform Connection</TabsTrigger>
          <TabsTrigger value="llm">LLM Config</TabsTrigger>
          <TabsTrigger value="autonomy">Autonomy Controls</TabsTrigger>
        </TabsList>
        <div className="mt-4">
          <TabsContent value="goal"><GoalTab /></TabsContent>
          <TabsContent value="profile"><ProfileTab /></TabsContent>
          <TabsContent value="platform"><PlatformTab /></TabsContent>
          <TabsContent value="llm"><LLMTab /></TabsContent>
          <TabsContent value="autonomy"><AutonomyTab /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div>Loading settings...</div>}>
      <SettingsContent />
    </Suspense>
  );
}
