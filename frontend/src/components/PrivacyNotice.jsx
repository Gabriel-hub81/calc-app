import { useLang } from '../lib/i18n';

/**
 * Pie con la promesa de privacidad en una línea y el enlace al aviso completo
 * (public/privacidad.html, servido por el mismo origen). Deliberadamente sobrio:
 * genera confianza sin robarle atención a la calculadora.
 */
const TEXTS = {
  es: {
    promise: 'Tus cuentas son tuyas. CALC nunca toca tu dinero ni vende tus datos.',
    link: 'Aviso de privacidad'
  },
  en: {
    promise: "Your books are yours. CALC never touches your money or sells your data.",
    link: 'Privacy notice'
  }
};

export default function PrivacyNotice() {
  const { lang } = useLang();
  const t = TEXTS[lang] || TEXTS.es;

  return (
    <footer className="mt-10 border-t border-slate-200 pt-4 text-center">
      <p className="text-xs text-slate-500">{t.promise}</p>
      <a
        href="/privacidad.html"
        className="mt-1 inline-block text-xs font-semibold text-emerald-700 underline underline-offset-2"
      >
        {t.link}
      </a>
    </footer>
  );
}
