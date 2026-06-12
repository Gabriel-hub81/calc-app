import { X } from 'lucide-react';
import { useLang } from '../lib/i18n';

/** Cuando hay duda con dinero, CALC pregunta — nunca adivina. */
export default function AmbiguityModal({ data, onPick, onClose }) {
  const { t } = useLang();
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <p className="font-semibold text-amber-700">{t.ambiguousTitle}</p>
          <button onClick={onClose} aria-label="Cerrar" className="text-slate-400">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-2 text-lg text-slate-800">{data.mensaje}</p>
        {(data.opciones || []).length > 0 && (
          <div className="mt-4 flex flex-col gap-2">
            {data.opciones.map((op) => (
              <button
                key={op}
                onClick={() => {
                  onClose();
                  onPick(op);
                }}
                className="rounded-xl border-2 border-warn/60 bg-amber-50 px-4 py-3 text-left font-medium text-slate-800 active:scale-[0.99]"
              >
                {op}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
