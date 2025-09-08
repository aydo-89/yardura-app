import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusPill } from './StatusPill';
import { wellnessTheme, type WellnessComputed } from '@/shared/wellness';

interface WellnessHeaderProps {
  wellnessData: WellnessComputed;
  onExport: () => void;
}

export const WellnessHeader: React.FC<WellnessHeaderProps> = ({
  wellnessData,
  onExport,
}) => {
  const { latestStatus, latestCopy } = wellnessData;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card
        className="border-0 shadow-sm"
        style={{
          backgroundColor: 'white',
          borderRadius: wellnessTheme.radiusLg,
        }}
      >
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-6">
            {/* Status Section - Just the Chip */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <StatusPill status={latestStatus} size="md" />
                <p className="text-slate-600 text-sm leading-relaxed mb-2">
                  {latestCopy.subtitle}
                </p>
              </div>

              {/* Compact Advice List */}
              {latestCopy.advice.length > 0 && (
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {latestCopy.advice.map((advice, index) => (
                    <span key={index} className="text-xs text-slate-500">
                      {advice}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* CTA Section - More Compact */}
            <div className="flex items-center gap-3">
              <Button
                onClick={onExport}
                variant="outline"
                size="sm"
                className="text-xs"
                style={{
                  borderColor: wellnessTheme.slate200,
                  borderRadius: wellnessTheme.radiusLg,
                }}
              >
                Export
              </Button>

              {latestCopy.cta && (
                <motion.div
                  initial={{ scale: 0.95 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, duration: 0.3 }}
                >
                  <Button
                    asChild
                    size="sm"
                    className="text-xs font-medium"
                    style={{
                      backgroundColor: latestStatus === 'attention' ? wellnessTheme.red : wellnessTheme.teal,
                      borderRadius: wellnessTheme.radiusLg,
                    }}
                  >
                    <a
                      href={latestCopy.cta.href}
                      className="inline-flex items-center justify-center gap-1.5 text-white"
                    >
                      {latestCopy.cta.label}
                      <span className="text-xs">→</span>
                    </a>
                  </Button>
                </motion.div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
