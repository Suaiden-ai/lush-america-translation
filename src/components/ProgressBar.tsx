import React from 'react';

interface ProgressBarProps {
  current: number;
  target: number;
  label?: string;
  className?: string;
  showPercentage?: boolean;
  color?: 'blue' | 'green' | 'purple' | 'orange';
}

export function ProgressBar({ 
  current, 
  target, 
  label = 'Progress', 
  className = '',
  showPercentage = true,
  color = 'blue'
}: ProgressBarProps) {
  const percentage = Math.min((current / target) * 100, 100);
  const remaining = Math.max(target - current, 0);

  const colorClasses = {
    blue: 'bg-tfe-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500'
  };

  const bgColorClasses = {
    blue: 'bg-tfe-blue-100',
    green: 'bg-green-100',
    purple: 'bg-purple-100',
    orange: 'bg-orange-100'
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        {showPercentage && (
          <span className="text-sm font-semibold text-gray-900">
            {Math.round(percentage)}%
          </span>
        )}
      </div>

      {/* Progress Bar */}
      <div className={`w-full h-3 rounded-full ${bgColorClasses[color]} overflow-hidden`}>
        <div
          className={`h-full transition-all duration-500 ease-out ${colorClasses[color]} rounded-full`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Stats */}
      <div className="flex justify-between items-center mt-2 text-xs text-gray-600">
        <span>{current.toLocaleString()} / {target.toLocaleString()}</span>
        <span>{remaining.toLocaleString()} remaining</span>
      </div>

      {/* Milestone indicator */}
      {percentage >= 100 && (
        <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm font-medium text-green-800">
              🎉 Goal reached! You've achieved the next level!
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
