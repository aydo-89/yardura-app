import React from 'react';
import { CheckCircle, Eye, AlertTriangle } from 'lucide-react';
import { wellnessTheme, type WellnessSimpleStatus, type WellnessStatus } from '@/shared/wellness';

interface StatusPillProps {
  status: WellnessSimpleStatus | WellnessStatus;
  className?: string;
  size?: 'sm' | 'md';
}

// Map old status types to new ones
const mapStatus = (status: WellnessSimpleStatus | WellnessStatus): keyof typeof statusConfig => {
  switch (status) {
    case 'normal':
    case 'good':
      return 'good';
    case 'monitor':
      return 'monitor';
    case 'action':
    case 'attention':
      return 'attention';
    default:
      return 'good';
  }
};

const statusConfig = {
  good: {
    icon: CheckCircle,
    label: 'All good',
    bgColor: wellnessTheme.green,
    textColor: wellnessTheme.slate800,
  },
  monitor: {
    icon: Eye,
    label: 'Monitor',
    bgColor: wellnessTheme.yellow,
    textColor: wellnessTheme.slate800,
  },
  attention: {
    icon: AlertTriangle,
    label: 'Needs attention',
    bgColor: wellnessTheme.red,
    textColor: wellnessTheme.slate800,
  },
};

export const StatusPill: React.FC<StatusPillProps> = ({
  status,
  className = '',
  size = 'sm',
}) => {
  const mappedStatus = mapStatus(status);
  const config = statusConfig[mappedStatus];
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'px-2.5 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
  };

  const iconSizeClasses = {
    sm: 'size-3',
    md: 'size-4',
  };

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${sizeClasses[size]} ${className}`}
      style={{
        backgroundColor: `${config.bgColor}20`,
        color: config.textColor,
      }}
    >
      <Icon className={iconSizeClasses[size]} aria-hidden="true" />
      <span>{config.label}</span>
    </div>
  );
};
