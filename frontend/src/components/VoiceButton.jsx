import { Mic } from 'lucide-react';
import { useLang } from '../lib/i18n';
import { useVoice } from '../hooks/useVoice';

export default function VoiceButton({ onText }) {
  const { lang } = useLang();
  const { supported, listening, start, stop } = useVoice(lang, onText);

  // sin soporte (p. ej. iOS Safari en algunos modos) → no aparece;
  // la voz es mejora progresiva, el texto siempre funciona
  if (!supported) return null;

  return (
    <button
      onClick={listening ? stop : start}
      aria-label="Hablar"
      className={`flex h-10 w-10 items-center justify-center rounded-full transition ${
        listening
          ? 'animate-pulse bg-red-100 text-red-600'
          : 'text-slate-500 hover:bg-slate-100'
      }`}
    >
      <Mic className="h-5 w-5" />
    </button>
  );
}
