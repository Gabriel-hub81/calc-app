import { useEffect, useRef, useState } from 'react';

const VOICE_LANG = { es: 'es-MX', en: 'en-US' };

/**
 * Web Speech API con detección de soporte: en navegadores sin soporte
 * (notablemente iOS Safari en algunos modos) el botón simplemente no
 * aparece — la voz es mejora progresiva; el texto siempre funciona.
 */
export function useVoice(lang, onResult) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSupported(Boolean(SR));
  }, []);

  const start = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR || listening) return;
    const rec = new SR();
    rec.lang = VOICE_LANG[lang] || 'es-MX';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const texto = e.results[0]?.[0]?.transcript;
      if (texto) onResult(texto);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  const stop = () => {
    recRef.current?.stop();
    setListening(false);
  };

  return { supported, listening, start, stop };
}
