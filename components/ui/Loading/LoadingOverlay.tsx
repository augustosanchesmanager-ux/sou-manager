import React from 'react';
import { LoadingSpinner, LoadingSpinnerProps } from './LoadingSpinner';

export interface LoadingOverlayProps {
  message?: string;
  showBackdrop?: boolean;
  spinnerProps?: Partial<LoadingSpinnerProps>;
  className?: string;
  minHeight?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  message = 'Carregando...',
  showBackdrop = true,
  spinnerProps = { size: 'lg', color: 'primary' },
  className = '',
  minHeight = 'min-h-screen',
}) => {
  const baseStyles = `flex flex-col items-center justify-center ${minHeight} transition-all duration-300`;
  const backdropStyles = showBackdrop
    ? 'bg-white/80 dark:bg-background-dark/80 backdrop-blur-sm'
    : 'bg-transparent';

  return (
    <div className={`${baseStyles} ${backdropStyles} ${className}`}>
      <LoadingSpinner
        {...spinnerProps}
        showLabel={!!message}
        label={message}
        className="gap-3"
      />
    </div>
  );
};

export default LoadingOverlay;
