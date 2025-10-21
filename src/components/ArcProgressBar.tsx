import React, { useEffect, useState } from 'react';

interface ArcProgressBarProps {
  current: number;
  target: number;
  label?: string;
  color?: 'blue' | 'green' | 'yellow';
  currentLevel?: number;
  maxLevelText?: string;
  maxLevelReachedText?: string;
  pagesToNextLevelText?: string;
}

export function ArcProgressBar({ 
  current, 
  target, 
  label = "Progress", 
  color = 'blue',
  currentLevel = 1,
  maxLevelText = "Max Level",
  maxLevelReachedText = "Maximum level reached",
  pagesToNextLevelText = "pages to next level"
}: ArcProgressBarProps) {
  const [animatedProgress, setAnimatedProgress] = useState(0);
  
  const percentage = Math.min((current / target) * 100, 100);
  const remaining = Math.max(target - current, 0);
  
  const colorClasses = {
    blue: {
      stroke: '#3B82F6',
      glow: '#3B82F6'
    },
    green: {
      stroke: '#10B981',
      glow: '#10B981'
    },
    yellow: {
      stroke: '#F59E0B',
      glow: '#F59E0B'
    }
  };

  const selectedColor = colorClasses[color];

  useEffect(() => {
    // Animate progress on mount
    const timer = setTimeout(() => {
      setAnimatedProgress(percentage);
    }, 100);
    
    return () => clearTimeout(timer);
  }, [percentage]);

  // SVG path for the arc (semi-circle) - smaller
  const arcPath = "M 15 60 A 45 45 0 0 1 105 60";
  const arcLength = 141.4; // Approximate length of the arc
  const strokeDasharray = arcLength;
  const strokeDashoffset = arcLength - (arcLength * animatedProgress / 100);

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <div className="relative">
        <svg 
          width="120" 
          height="75" 
          viewBox="0 0 120 75" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          className="drop-shadow-sm"
        >
          <defs>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge> 
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          
          {/* Background arc */}
          <path
            d={arcPath}
            stroke="#E5E7EB"
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
          />
          
          {/* Progress arc */}
          <path
            d={arcPath}
            stroke={selectedColor.stroke}
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            filter="url(#glow)"
            style={{
              transition: 'stroke-dashoffset 1.5s ease-in-out'
            }}
          />
        </svg>
        
        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-6">
          <div className="text-center">
            {currentLevel >= 2 ? (
              <>
                <div className="text-lg font-bold text-gray-900">
                  {current}
                </div>
                <div className="text-xs text-gray-500">
                  / ∞
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {maxLevelText}
                </div>
              </>
            ) : (
              <>
                <div className="text-lg font-bold text-gray-900">
                  {current}
                </div>
                <div className="text-xs text-gray-500">
                  / {target}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {Math.round(animatedProgress)}%
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Label */}
      {label && (
        <div className="mt-4 text-center">
          <div className="text-sm font-medium text-gray-700">
            {label}
          </div>
          {currentLevel >= 2 ? (
            <div className="text-xs text-gray-500 mt-1">
              {maxLevelReachedText}
            </div>
          ) : remaining > 0 && (
            <div className="text-xs text-gray-500 mt-1">
              {remaining} {pagesToNextLevelText}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
