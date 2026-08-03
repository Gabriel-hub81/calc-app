import { useEffect, useRef, useState } from 'react';

const VOICE_LANG = { es: 'es-MX', en: 'en-US' };

/**
 * Web Speech API con detección de soporte: en navegadores sin soporte
 * (notablemente iOS Safari en algunos modos) el botón simplemente no
 * aparece — la voz es mejora progresiva; el texto siempre funciona.
 */
// Mensajes humanos para los errores del reconocimiento — "no pasa nada"
// no es aceptable: si la voz falla, se dice por qué y qué hacer.
const VOICE_ERRORS = {
  es: {
    'not-allowed': 'El navegador no tiene permiso para usar el micrófono. Revísalo en la configuración del sitio.',
    'service-not-allowed': 'Este navegador no permite el reconocimiento de voz aquí. Prueba con Chrome.',
    'no-speech': 'No te escuché — intenta de nuevo hablando más cerca.',
    'audio-capture': 'No encontré un micrófono disponible.',
    network: 'El reconocimiento de voz necesita internet y no pudo conectarse.',
    default: 'No pude usar el micrófono en este navegador. Puedes escribir tu operación.'
  },
  en: {
    'not-allowed': "The browser doesn't have microphone permission. Check the site settings.",
    'service-not-allowed': "This browser doesn't allow speech recognition here. Try Chrome.",
    'no-speech': "I didn't hear you — try again, closer to the mic.",
    'audio-capture': 'No microphone available.',
    network: 'Speech recognition needs internet and could not connect.',
    default: "Couldn't use the microphone in this browser. You can type instead."
  }
};

export function useVoice(lang, onResult) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState(null);
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
    rec.onerror = (e) => {
      setListening(false);
      const msgs = VOICE_ERRORS[lang] || VOICE_ERRORS.es;
      setError(msgs[e.error] || msgs.default);
    };
    recRef.current = rec;
    setError(null);
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
      setError((VOICE_ERRORS[lang] || VOICE_ERRORS.es).default);
    }
  };

  const stop = () => {
    recRef.current?.stop();
    setListening(false);
  };

  return { supported, listening, error, clearError: () => setError(null), start, stop };
}
