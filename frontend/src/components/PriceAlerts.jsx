import { TriangleAlert } from 'lucide-react';
import { useLang } from '../lib/i18n';

export default function PriceAlerts({ alertas }) {
  const { t } = useLang();
  if (!alertas || alertas.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-600">
        {t.priceAlerts}
      </p>
      {alertas.map((a) => (
        <p
          key={a.producto}
          className="mb-1 flex items-start gap-1.5 rounded-xl bg-amber-50 p-2.5 text-sm text-amber-800"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {a.mensaje}
        </p>
      ))}
    </div>
  );
}
