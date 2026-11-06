import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  clickable?: boolean;
}

const Logo: React.FC<LogoProps> = ({ className = "", iconOnly = false, size = 'md', clickable = true }) => {
  const navigate = useNavigate();
  const { session, appSlug } = useAuth();
  const isEsteticaApp = appSlug === 'estetica';
  const brandTitle = isEsteticaApp ? 'SMG | Sou.Manager | Estética' : 'SMG Barber Intelligence';

  const heights = {
    sm: 'h-9 sm:h-10',
    md: 'h-14 sm:h-16',
    lg: 'h-18 sm:h-22',
    xl: 'h-22 sm:h-26 md:h-28'
  };

  const iconSizes = {
    sm: 'size-8',
    md: 'size-11 sm:size-12',
    lg: 'size-14 sm:size-16',
    xl: 'size-16 sm:size-20'
  };

  const handleClick = () => {
    if (!clickable) return;
    if (session) {
      navigate('/dashboard');
    } else {
      navigate('/');
    }
  };

  const innerContent = iconOnly ? (
    <img
      src="/branding/smg-chip-hero.png"
      alt="SMG"
      className={`${iconSizes[size]} object-contain filter drop-shadow-[0_0_12px_rgba(245,158,11,0.35)] transition-transform duration-300 hover:scale-105`}
    />
  ) : (
    <img
      src="/branding/smg-barber-intelligence-logo.png"
      alt="SMG Barber Intelligence"
      className={`${heights[size]} w-auto max-w-full object-contain filter drop-shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-transform duration-300 hover:scale-[1.02]`}
    />
  );

  if (clickable) {
    return (
      <button
        type="button"
        className={`flex items-center justify-center cursor-pointer hover:opacity-95 transition-opacity ${className}`}
        onClick={handleClick}
        title="Ir para o início"
        aria-label="Ir para o início"
      >
        {innerContent}
      </button>
    );
  }

  return (
    <div className={`flex items-center justify-center ${className}`} title={brandTitle}>
      {innerContent}
    </div>
  );
};

export default Logo;
