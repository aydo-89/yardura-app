import React from 'react';
import { Droplets, Eye, AlertTriangle, Bug, Thermometer, Activity } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { wellnessTheme, type WellnessComputed } from '@/shared/wellness';

interface KeyInsightsProps {
  weeks: WellnessComputed['weekly'];
  avgWellness4w: number;
}

export const KeyInsights: React.FC<KeyInsightsProps> = ({ weeks, avgWellness4w }) => {
  // Get the most recent 4 weeks for insights
  const recentWeeks = weeks.slice(0, 4);

  const totalDeposits4w = recentWeeks.reduce((sum, w) => sum + w.deposits, 0);
  const weeksWithIssues = recentWeeks.filter(w => w.issues.length > 0).length;
  const goodWeeks = recentWeeks.filter(w => w.status === 'good').length;
  const monitorWeeks = recentWeeks.filter(w => w.status === 'monitor').length;
  const attentionWeeks = recentWeeks.filter(w => w.status === 'attention').length;

  // Generate conversational insights with icons
  const insights = [];

  if (goodWeeks >= 3) {
    insights.push({
      icon: Activity,
      text: 'Stool consistency looks normal most weeks — great job with their diet!',
      color: wellnessTheme.green,
    });
  }

  if (monitorWeeks > 0) {
    insights.push({
      icon: Eye,
      text: 'A few weeks with softer consistency — try adding more fiber from pumpkin or sweet potato.',
      color: wellnessTheme.yellow,
    });
  }

  if (attentionWeeks > 0) {
    insights.push({
      icon: AlertTriangle,
      text: 'Some weeks show concerning patterns — consider a vet visit to rule out any issues.',
      color: wellnessTheme.red,
    });
  }

  // Color insights
  const yellowWeeks = recentWeeks.filter(w => w.colors.yellow > 0).length;
  if (yellowWeeks > 0) {
    insights.push({
      icon: Thermometer,
      text: 'Yellow color detected in some samples — if this continues, ask your vet about liver function.',
      color: wellnessTheme.yellow,
    });
  }

  // Parasite insights
  const parasiteWeeks = recentWeeks.filter(w =>
    w.issues.some(issue => issue.includes('Mucous') || issue.includes('Greasy'))
  ).length;
  if (parasiteWeeks > 0) {
    insights.push({
      icon: Bug,
      text: 'Some signs of possible parasites — your vet can check for internal parasites.',
      color: wellnessTheme.orange,
    });
  }

  // Dry consistency insight
  const dryWeeks = recentWeeks.filter(w => w.consistency.dry > 0).length;
  if (dryWeeks > 0) {
    insights.push({
      icon: Droplets,
      text: 'A few dry samples — make sure they\'re getting enough water throughout the day.',
      color: wellnessTheme.blue,
    });
  }

  return (
    <Card
      style={{
        backgroundColor: wellnessTheme.slate50,
        boxShadow: wellnessTheme.cardShadow,
        borderRadius: wellnessTheme.radiusLg,
      }}
    >
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          What we're seeing
        </h3>

        <div className="space-y-3">
          {insights.map((insight, index) => {
            const Icon = insight.icon;
            return (
              <div key={index} className="flex items-start gap-3">
                <Icon className="size-4 mt-0.5 flex-shrink-0" style={{ color: insight.color }} />
                <div className="text-slate-700 leading-relaxed">{insight.text}</div>
              </div>
            );
          })}

          {/* Overall summary */}
          <div className="flex items-start gap-3 mt-4 pt-4 border-t border-slate-200">
            <Activity className="size-4 mt-0.5 flex-shrink-0" style={{ color: wellnessTheme.teal }} />
            <div className="text-slate-700">
              <strong>{totalDeposits4w} deposits</strong> tracked over 4 weeks, with{' '}
              <strong>{weeksWithIssues} week{weeksWithIssues !== 1 ? 's' : ''}</strong> showing patterns worth noting.
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
