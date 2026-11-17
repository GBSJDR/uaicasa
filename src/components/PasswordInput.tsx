'use client';

import { useState } from 'react';

/** Campo de senha com botão para mostrar/ocultar. */
export default function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  const { className = '', ...rest } = props;
  return (
    <div className="relative">
      <input {...rest} type={show ? 'text' : 'password'} className={`${className} pr-20`} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={show}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-medium text-serra hover:bg-areia"
      >
        {show ? '🙈 Ocultar' : '👁 Mostrar'}
      </button>
    </div>
  );
}
