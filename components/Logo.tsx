import React from 'react';

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const Logo: React.FC<LogoProps> = ({ className = "", iconOnly = false, size = 'md' }) => {
  const iconSizes = {
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-3xl'
  };

  const containerPadding = {
    sm: 'p-1',
    md: 'p-1.5',
    lg: 'p-2'
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className={`bg-primary ${containerPadding[size]} rounded-lg flex items-center justify-center shadow-lg shadow-primary/20`}>
        <span className={`material-symbols-outlined text-white ${iconSizes[size]}`}>content_cut</span>
      </div>
      {!iconOnly && (
        <div className="flex flex-col">
          <h1 className={`text-slate-900 dark:text-white ${size === 'lg' ? 'text-xl' : 'text-lg'} font-bold leading-tight tracking-tight uppercase`}>SOU MANA.GER</h1>
          <p className="text-primary text-[10px] font-bold tracking-[0.2em]">ELITE TECH</p>
        </div>
      )}
    </div>
  );
};

export default Logo;
