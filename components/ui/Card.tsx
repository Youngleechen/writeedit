import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  elevation?: 'low' | 'medium' | 'high';
}

export const Card: React.FC<CardProps> = ({ 
  children, 
  className = '', 
  elevation = 'medium' 
}) => {
  const elevationClasses = {
    low: 'shadow-sm',
    medium: 'shadow-md',
    high: 'shadow-lg',
  };

  return (
    <div className={`bg-white rounded-lg ${elevationClasses[elevation]} ${className}`}>
      {children}
    </div>
  );
};