import { useRef } from 'react';
import { Camera } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useLang } from '../lib/i18n';

const NEEDS_LOGIN = {
  es: 'Entra con tu correo o teléfono para leer tickets.',
  en: 'Sign in with your email or phone to read receipts.'
};

/** Botón 📷: en móvil abre la cámara, en desktop el selector de archivos. */
export default function ReceiptCapture({ onFile, reading }) {
  const inputRef = useRef(null);
  const { user, login } = useAuth();
  const { lang } = useLang();
  const needsLogin = NEEDS_LOGIN[lang] || NEEDS_LOGIN.es;

  // Sin sesión ni siquiera se abre la cámara: el servidor rechazaría el ticket
  // (leerlo es la operación más cara). Mejor invitar a entrar que fallar después
  // de que la persona ya tomó la foto.
  const handleClick = () => (user ? inputRef.current?.click() : login());

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = '';
        }}
      />
      <button
        onClick={handleClick}
        disabled={reading}
        aria-label={user ? 'Foto de ticket' : needsLogin}
        title={user ? undefined : needsLogin}
        className={`flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-slate-100 disabled:opacity-40 ${
          user ? 'text-slate-500' : 'text-slate-300'
        }`}
      >
        <Camera className="h-5 w-5" />
      </button>
    </>
  );
}
