import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
  size?: 'sm' | 'md' | 'lg';
  clickable?: boolean;
}

const Logo: React.FC<LogoProps> = ({ className = "", iconOnly = false, size = 'md', clickable = true }) => {
  const navigate = useNavigate();
  const { session } = useAuth();

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

  const handleClick = () => {
    if (!clickable) return;
    if (session) {
      navigate('/dashboard');
    } else {
      navigate('/');
    }
  };

  const innerContent = (
    <>
      <div className={`bg-gradient-to-br from-primary to-primary-dark ${containerPadding[size]} rounded-xl flex items-center justify-center shadow-lg shadow-primary/30 border border-primary-light/20`}>
        <span className={`material-symbols-outlined text-white ${iconSizes[size]}`}>content_cut</span>
      </div>
      {!iconOnly && (
        <div className="flex flex-col text-left mt-0.5">
          <h1 className={`text-slate-900 dark:text-white ${size === 'lg' ? 'text-2xl' : 'text-xl'} font-bold leading-none tracking-tight uppercase display-font`}>SOU MANA.GER</h1>
          <p className="text-primary-dark dark:text-primary text-[10px] font-bold tracking-[0.25em] uppercase mt-0.5">Elite Tech</p>
        </div>
      )}
    </>
  );

  if (clickable) {
    return (
      <button
        className={`flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity ${className}`}
        onClick={handleClick}
        title="Ir para o início"
      >
        {innerContent}
      </button>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`} title="SOU MANA.GER Logo">
      {innerContent}
    </div>
  );
};

export default Logo;
