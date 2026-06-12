import { useLang } from '../lib/i18n';

const STYLE = {
  alta: { dot: 'bg-calc', text: 'text-calc-dark' },
  media: { dot: 'bg-warn', text: 'text-amber-700' },
  baja: { dot: 'bg-red-500', text: 'text-red-700' }
};

export default function ConfidenceBar({ nivel = 'media' }) {
  const { t } = useLang();
  const s = STYLE[nivel] || STYLE.media;
  return (
    <p className={`mt-2 flex items-center gap-1.5 text-xs font-medium ${s.text}`}>
      <span className={`h-2 w-2 rounded-full ${s.dot}`} />
      {t.confidence[nivel] || t.confidence.media}
    </p>
  );
}
