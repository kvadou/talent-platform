'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  SparklesIcon,
  EnvelopeIcon,
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  MagnifyingGlassIcon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
  LightBulbIcon,
} from '@heroicons/react/24/outline';

interface AISettings {
  id: string;
  aiEmailEditor: boolean;
  aiInterviewQuestions: boolean;
  aiJobNoteSummaries: boolean;
  aiJobDescriptions: boolean;
  aiKeywordSuggestions: boolean;
  aiOfferForecast: boolean;
  aiReportBuilder: boolean;
  aiScorecardSuggestions: boolean;
}

const AI_FEATURES = [
  {
    key: 'aiEmailEditor' as const,
    name: 'AI Email Editor',
    description: 'Get AI-powered suggestions and improvements when writing candidate emails',
    icon: EnvelopeIcon,
    category: 'communication',
  },
  {
    key: 'aiInterviewQuestions' as const,
    name: 'Interview Question Suggestions',
    description: 'Generate relevant interview questions based on job requirements and candidate background',
    icon: ChatBubbleLeftRightIcon,
    category: 'interviews',
  },
  {
    key: 'aiJobNoteSummaries' as const,
    name: 'Job Note Summaries',
    description: 'Automatically summarize notes and feedback across all candidates for a job',
    icon: DocumentTextIcon,
    category: 'productivity',
  },
  {
    key: 'aiJobDescriptions' as const,
    name: 'Job Description Generator',
    description: 'Create compelling job descriptions with AI assistance based on role requirements',
    icon: SparklesIcon,
    category: 'jobs',
  },
  {
    key: 'aiKeywordSuggestions' as const,
    name: 'Keyword Suggestions',
    description: 'Get suggested keywords and skills to look for when reviewing candidates',
    icon: MagnifyingGlassIcon,
    category: 'screening',
  },
  {
    key: 'aiOfferForecast' as const,
    name: 'Offer Forecast',
    description: 'Predict offer acceptance likelihood based on candidate engagement and market data',
    icon: ChartBarIcon,
    category: 'analytics',
    beta: true,
  },
  {
    key: 'aiReportBuilder' as const,
    name: 'AI Report Builder',
    description: 'Generate custom recruiting reports and insights using natural language queries',
    icon: ClipboardDocumentListIcon,
    category: 'analytics',
    beta: true,
  },
  {
    key: 'aiScorecardSuggestions' as const,
    name: 'Scorecard Suggestions',
    description: 'Get AI-suggested scorecard criteria and evaluation questions for each role',
    icon: LightBulbIcon,
    category: 'interviews',
  },
];

export default function AIToolsPage() {
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/ai-settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings);
      }
    } catch (error) {
      console.error('Error fetching AI settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFeature = async (key: keyof AISettings) => {
    if (!settings || key === 'id') return;

    setSaving(key);
    const newValue = !settings[key];

    // Optimistic update
    setSettings({ ...settings, [key]: newValue });

    try {
      const response = await fetch('/api/ai-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: newValue }),
      });

      if (!response.ok) {
        // Revert on error
        setSettings({ ...settings, [key]: !newValue });
        console.error('Error updating AI setting');
      }
    } catch (error) {
      // Revert on error
      setSettings({ ...settings, [key]: !newValue });
      console.error('Error updating AI setting:', error);
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">AI Tools</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure AI-powered features for your organization
          </p>
        </div>
        <Card>
          <CardContent className="p-8">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-purple"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Group features by category
  const categories = {
    communication: 'Communication',
    interviews: 'Interviews & Evaluation',
    productivity: 'Productivity',
    jobs: 'Job Management',
    screening: 'Candidate Screening',
    analytics: 'Analytics & Insights',
  };

  const featuresByCategory = AI_FEATURES.reduce((acc, feature) => {
    if (!acc[feature.category]) {
      acc[feature.category] = [];
    }
    acc[feature.category].push(feature);
    return acc;
  }, {} as Record<string, typeof AI_FEATURES>);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">AI Tools</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure AI-powered features for your organization. These features use AI to
          help streamline your recruiting workflow.
        </p>
      </div>

      {Object.entries(featuresByCategory).map(([category, features]) => (
        <Card key={category}>
          <CardHeader
            title={categories[category as keyof typeof categories]}
            action={
              features.some((f) => f.beta) ? (
                <Badge variant="purple">Includes Beta Features</Badge>
              ) : null
            }
          />
          <CardContent className="p-0">
            <div className="divide-y divide-gray-100">
              {features.map((feature) => {
                const Icon = feature.icon;
                const isEnabled = settings?.[feature.key] ?? false;
                const isSaving = saving === feature.key;

                return (
                  <div
                    key={feature.key}
                    className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-purple-50 rounded-lg">
                        <Icon className="w-5 h-5 text-brand-purple" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{feature.name}</span>
                          {feature.beta && (
                            <Badge variant="neutral" className="text-xs">
                              Beta
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">{feature.description}</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => toggleFeature(feature.key)}
                        disabled={isSaving}
                        className="sr-only peer"
                      />
                      <div
                        className={`w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-purple ${
                          isSaving ? 'opacity-50' : ''
                        }`}
                      ></div>
                    </label>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-cyan-50 rounded-lg">
              <SparklesIcon className="w-5 h-5 text-cyan-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">About AI Features</h3>
              <p className="text-sm text-gray-500 mt-1">
                AI features are powered by large language models. Data processed by these
                features is handled securely and in accordance with our privacy policy.
                Beta features are experimental and may change or be removed in future updates.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
