import { Check } from 'lucide-react';
import { useLang } from '../lib/i18n';

/**
 * "¿Cuál me conviene?" — muestra el veredicto primero y, debajo, el precio por
 * unidad de cada opción. La transparencia es la misma que en un cálculo: se ve
 * de dónde salió la respuesta, para que la persona pueda confiar (o corregir).
 */
function money(n, lang) {
  return Number(n).toLocaleString(lang === 'en' ? 'en-US' : 'es-MX', {
    style: 'currency',
    currency: lang === 'en' ? 'USD' : 'MXN',
    maximumFractionDigits: 2
  });
}

export default function ComparisonCard({ data }) {
  const { t, lang } = useLang();
  const opciones = data.opciones || [];
  const unidad = data.unidad || '';

  return (
    <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
      <p className="text-lg font-bold text-slate-900">{data.mensaje}</p>

      <div className="mt-3 space-y-2">
        {opciones.map((op, i) => {
          const gana = op.etiqueta === data.mejor;
          return (
            <div
              key={i}
              className={`flex items-center justify-between rounded-xl px-3 py-2 ${
                gana ? 'bg-white ring-2 ring-emerald-500' : 'bg-white/60'
              }`}
            >
              <span className="flex items-center gap-2 text-sm text-slate-700">
                {gana && <Check className="h-4 w-4 shrink-0 text-emerald-600" />}
                {op.etiqueta}
              </span>
              <span
                className={`shrink-0 text-sm ${
                  gana ? 'font-bold text-emerald-700' : 'text-slate-500'
                }`}
              >
                {money(op.precio_unitario, lang)}/{unidad || op.unidad}
              </span>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-slate-500">{t.comparisonHint}</p>
    </div>
  );
}
