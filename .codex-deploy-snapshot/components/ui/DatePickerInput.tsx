import React, { useRef } from 'react';

type DatePickerInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  containerClassName?: string;
  buttonClassName?: string;
  iconClassName?: string;
  containerStyle?: React.CSSProperties;
  buttonStyle?: React.CSSProperties;
  icon?: React.ReactNode;
};

const DatePickerInput: React.FC<DatePickerInputProps> = ({
  className = '',
  containerClassName = '',
  buttonClassName = 'absolute inset-y-0 right-0 flex items-center justify-center w-11 text-slate-400 hover:text-primary transition-colors',
  iconClassName = 'material-symbols-outlined text-[20px]',
  style,
  containerStyle,
  buttonStyle,
  icon,
  ...props
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    const input = inputRef.current;
    if (!input || input.disabled || input.readOnly) return;

    input.focus();
    if (typeof input.showPicker === 'function') {
      input.showPicker();
    } else {
      input.click();
    }
  };

  return (
    <div className={`relative ${containerClassName}`.trim()} style={containerStyle}>
      <input
        {...props}
        ref={inputRef}
        type="date"
        style={style}
        className={`${className} pr-11 cursor-pointer`.trim()}
      />
      <button
        type="button"
        onClick={openPicker}
        className={buttonClassName}
        style={buttonStyle}
        aria-label={props['aria-label'] || 'Abrir calendário'}
      >
        {icon || <span className={iconClassName}>calendar_month</span>}
      </button>
    </div>
  );
};

export default DatePickerInput;
