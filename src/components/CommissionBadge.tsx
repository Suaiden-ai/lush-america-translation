import React from 'react';
import { Star, TrendingUp } from 'lucide-react';

interface CommissionBadgeProps {
  level: number;
  rate: number;
  className?: string;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
  levelText?: string;
  perPageText?: string;
}

export function CommissionBadge({ 
  level, 
  rate, 
  className = '',
  showIcon = true,
  size = 'md',
  levelText = `Level ${level}`,
  perPageText = '/page'
}: CommissionBadgeProps) {
  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2'
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  const isLevel2 = level === 2;
  const bgColor = isLevel2 ? 'bg-gradient-to-r from-purple-500 to-purple-600' : 'bg-gradient-to-r from-tfe-blue-500 to-tfe-blue-600';
  const textColor = 'text-white';
  const borderColor = isLevel2 ? 'border-purple-200' : 'border-tfe-blue-200';

  return (
    <div className={`inline-flex items-center gap-2 ${bgColor} ${textColor} rounded-full border ${borderColor} ${sizeClasses[size]} ${className}`}>
      {showIcon && (
        <div className="flex items-center">
          {isLevel2 ? (
            <Star className={`${iconSizes[size]} fill-current`} />
          ) : (
            <TrendingUp className={iconSizes[size]} />
          )}
        </div>
      )}
      <div className="flex flex-col items-center">
        <span className="font-semibold">
          {levelText}
        </span>
        <span className="text-xs opacity-90">
          ${rate.toFixed(2)}{perPageText}
        </span>
      </div>
    </div>
  );
}
