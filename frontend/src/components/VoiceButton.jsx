import { Mic } from 'lucide-react';
import { useLang } from '../lib/i18n';
import { useAuth } from '../auth/AuthContext';
import { useVoice } from '../hooks/useVoice';

const NEEDS_LOGIN = {
  es: 'Entra con tu correo o teléfono para usar el micrófono.',
  en: 'Sign in with your email or phone to use the microphone.'
};

export default function VoiceButton({ onText }) {
  const { lang } = useLang();
  const { user, login } = useAuth();
  const { supported, listening, error, clearError, start, stop } = useVoice(lang, onText);

  // sin soporte (p. ej. iOS Safari en algunos modos) → no aparece;
  // la voz es mejora progresiva, el texto siempre funciona
  if (!supported) return null;

  // Sin sesión el botón se ve pero invita a entrar en vez de escuchar: dictar
  // dispara trabajo caro en el servidor, y así queda atado a una persona real.
  // Se muestra (no se esconde) para que la función siga siendo descubrible.
  const handleClick = () => {
    if (!user) return login();
    return listening ? stop() : start();
  };

  return (
    <>
      <button
        onClick={handleClick}
        aria-label={user ? 'Hablar' : NEEDS_LOGIN[lang] || NEEDS_LOGIN.es}
        title={user ? undefined : NEEDS_LOGIN[lang] || NEEDS_LOGIN.es}
        className={`flex h-10 w-10 items-center justify-center rounded-full transition ${
          listening
            ? 'animate-pulse bg-red-100 text-red-600'
            : user
              ? 'text-slate-500 hover:bg-slate-100'
              : 'text-slate-300 hover:bg-slate-100'
        }`}
      >
        <Mic className="h-5 w-5" />
      </button>
      {error && (
        <div className="absolute left-0 right-0 top-full z-10 mt-1 flex items-start justify-between gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 shadow">
          <span>{error}</span>
          <button onClick={clearError} aria-label="Cerrar" className="font-bold">
            ×
          </button>
        </div>
      )}
    </>
  );
}
