import React from 'react';
import { LoadingSpinner, LoadingSpinnerProps } from './LoadingSpinner';

export interface LoadingBlockProps {
  loading: boolean;
  children: React.ReactNode;
  message?: string;
  minHeight?: string;
  overlayClassName?: string;
  spinnerProps?: Partial<LoadingSpinnerProps>;
  fullHeight?: boolean;
}

export const LoadingBlock: React.FC<LoadingBlockProps> = ({
  loading,
  children,
  message,
  minHeight = 'min-h-[200px]',
  overlayClassName = '',
  spinnerProps = { size: 'lg', color: 'primary' },
  fullHeight = false,
}) => {
  if (!loading) {
    return <>{children}</>;
  }

  return (
    <div className={`relative ${fullHeight ? 'min-h-screen' : minHeight}`}>
      {children}
      <div
        className={`absolute inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-background-dark/80 backdrop-blur-sm rounded-lg z-50 ${overlayClassName}`}
      >
        <LoadingSpinner
          {...spinnerProps}
          showLabel={!!message}
          label={message}
          className="gap-3"
        />
      </div>
    </div>
  );
};

export default LoadingBlock;
