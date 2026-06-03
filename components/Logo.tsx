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
  const { session, appSlug } = useAuth();
  const isEsteticaApp = appSlug === 'estetica';
  const productLine = isEsteticaApp ? 'Aesthetic Intelligence' : 'Barber Intelligence';
  const brandTitle = isEsteticaApp ? 'SMG | Sou.Manager | Estética' : 'SMG | Sou.Manager | Barber';

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
      <div
        className={`relative ${containerPadding[size]} rounded-xl flex items-center justify-center border ${
          isEsteticaApp
            ? 'bg-[#F8F5ED] text-[#6F6845] border-[#D8C994] shadow-[0_16px_34px_rgba(111,104,69,0.18)]'
            : 'bg-gradient-to-br from-[#00D2FF] via-[#007BFF] to-[#003366] text-white border-white/25 shadow-[0_0_28px_rgba(0,210,255,0.28)]'
        }`}
      >
        <span className={`material-symbols-outlined ${iconSizes[size]}`}>{isEsteticaApp ? 'spa' : 'memory'}</span>
        <span
          className={`material-symbols-outlined absolute -right-1 -bottom-1 size-4 rounded-full text-[11px] flex items-center justify-center shadow-md ${
            isEsteticaApp
              ? 'bg-[#2E2B24] text-[#D8C994]'
              : 'bg-white text-[#003366] dark:bg-[#EAF7FF]'
          }`}
        >
          {isEsteticaApp ? 'auto_awesome' : 'content_cut'}
        </span>
      </div>
      {!iconOnly && (
        <div className="flex flex-col text-left mt-0.5">
          <div className="flex items-baseline gap-1.5">
            <span className={`${isEsteticaApp ? 'text-[#2E2B24]' : 'text-[#003366] dark:text-white'} ${size === 'lg' ? 'text-2xl' : 'text-xl'} font-extrabold leading-none display-font`}>
              SMG
            </span>
            <span className={`text-[11px] font-bold uppercase leading-none ${isEsteticaApp ? 'text-[#6F6758]' : 'text-slate-500 dark:text-slate-300'}`}>
              {isEsteticaApp ? 'ESTÉTICA' : 'SOU.MANAGER'}
            </span>
          </div>
          <p className={`${isEsteticaApp ? 'text-[#6F6845]' : 'text-[#007BFF] dark:text-[#00D2FF]'} text-[10px] font-bold uppercase mt-0.5`}>{productLine}</p>
        </div>
      )}
    </>
  );

  if (clickable) {
    return (
      <button
        type="button"
        className={`flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity ${className}`}
        onClick={handleClick}
        title="Ir para o início"
        aria-label="Ir para o início"
      >
        {innerContent}
      </button>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`} title={brandTitle}>
      {innerContent}
    </div>
  );
};

export default Logo;
