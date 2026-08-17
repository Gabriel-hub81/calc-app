import { useMemo, useState } from 'react';
import { Check, LoaderCircle, TriangleAlert, X } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useLang } from '../lib/i18n';

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * LA PANTALLA MÁS IMPORTANTE: lo extraído del ticket se muestra editable y
 * NADA se guarda hasta que el usuario confirma. Si la suma no cuadra con el
 * total, se avisa y no se puede confirmar. Nunca auto-guardar dinero leído
 * por OCR.
 */
export default function ReceiptConfirm({ proposal, onConfirm, saving, onConfirmed, onClose }) {
  const { t } = useLang();
  const { user, login } = useAuth();
  const [items, setItems] = useState(
    (proposal.propuesta?.items || []).map((it) => ({
      ...it,
      qty: it.qty ?? 1,
      unit_price: it.unit_price ?? 0,
      // El IMPORTE del renglón es el dato mandón, igual que en el backend.
      // Un ticket de Costco imprime "2.845 kg @ 433.64 /kg" y abajo el importe
      // real: cantidad por precio unitario NO da ese importe. Recalcular aquí
      // inflaba la suma casi $2,000 y bloqueaba el botón de guardar con un
      // ticket que en realidad cuadraba perfecto.
      total: typeof it.total === 'number' ? it.total : (it.qty ?? 1) * (it.unit_price ?? 0)
    }))
  );
  const [totalTicket, setTotalTicket] = useState(proposal.propuesta?.total_ticket ?? 0);
  const [serverError, setServerError] = useState(null);

  const suma = useMemo(
    () => round2(items.reduce((s, it) => s + (Number(it.total) || 0), 0)),
    [items]
  );
  const cuadra = Math.abs(suma - Number(totalTicket)) <= Math.max(0.01, Number(totalTicket) * 0.01);

  /**
   * Mantiene coherente el renglón mientras la usuaria edita:
   * - toca cantidad o precio unitario → se recalcula el importe
   * - toca el importe → se recalcula el precio unitario (que es el derivado)
   * Así el precio que se guarda en el historial es el precio por unidad de
   * verdad, no el importe del renglón disfrazado de precio.
   */
  const setItem = (i, campo, valor) => {
    setItems((prev) =>
      prev.map((it, j) => {
        if (j !== i) return it;
        const next = { ...it, [campo]: valor };
        if (campo === 'qty' || campo === 'unit_price') {
          next.total = round2((Number(next.qty) || 0) * (Number(next.unit_price) || 0));
        } else if (campo === 'total') {
          const q = Number(next.qty) || 0;
          if (q > 0) next.unit_price = round2((Number(next.total) || 0) / q);
        }
        return next;
      })
    );
  };

  const confirmar = async () => {
    setServerError(null);
    const propuesta = {
      ...proposal.propuesta,
      items: items.map((it) => ({
        ...it,
        qty: Number(it.qty),
        unit_price: Number(it.unit_price),
        // Se manda el importe que la usuaria vio y aprobó en pantalla. Volver
        // a multiplicar aquí reintroduciría el descuadre por la puerta de
        // atrás, justo después de que ella confirmó que estaba bien.
        total: round2(Number(it.total)),
        name_canonical: it.name_canonical || it.name_raw
      })),
      total_ticket: Number(totalTicket)
    };
    const resp = await onConfirm(propuesta);
    if (resp.guardado) {
      onConfirmed(resp);
    } else {
      setServerError(resp.mensaje || t.genericError);
    }
  };

  if (proposal.error) {
    return (
      <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm">
        <p className="text-slate-700">{proposal.mensaje || t.genericError}</p>
        {proposal.sugerencia && <p className="mt-1 text-sm text-slate-500">{proposal.sugerencia}</p>}
        <button onClick={onClose} className="mt-2 text-sm font-semibold text-slate-500 underline">
          OK
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[92dvh] w-full max-w-md flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <p className="text-lg font-bold">{t.receiptConfirmTitle}</p>
          <button onClick={onClose} aria-label="Cerrar" className="text-slate-400">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grow overflow-y-auto p-4">
          {proposal.propuesta?.comercio && (
            <p className="mb-3 text-sm text-slate-500">{proposal.propuesta.comercio}</p>
          )}

          <div className="mb-2 grid grid-cols-[1fr_2.75rem_4rem_4.5rem] gap-1.5 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">
            <span>{t.receiptItem}</span>
            <span className="text-right">{t.receiptQty}</span>
            <span className="text-right">{t.receiptPrice}</span>
            <span className="text-right">{t.receiptAmount}</span>
          </div>

          {items.map((it, i) => (
            <div key={i} className="mb-2 grid grid-cols-[1fr_2.75rem_4rem_4.5rem] items-center gap-1.5">
              <input
                value={it.name_canonical || it.name_raw || ''}
                onChange={(e) => setItem(i, 'name_canonical', e.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              />
              <input
                type="number"
                inputMode="decimal"
                value={it.qty}
                onChange={(e) => setItem(i, 'qty', e.target.value)}
                className="rounded-lg border border-slate-200 px-1 py-1.5 text-right text-sm"
              />
              <input
                type="number"
                inputMode="decimal"
                value={it.unit_price}
                onChange={(e) => setItem(i, 'unit_price', e.target.value)}
                className="rounded-lg border border-slate-200 px-1.5 py-1.5 text-right text-sm"
              />
              <input
                type="number"
                inputMode="decimal"
                value={it.total}
                onChange={(e) => setItem(i, 'total', e.target.value)}
                className={`rounded-lg border px-1.5 py-1.5 text-right text-sm font-medium ${
                  Number(it.total) < 0
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200'
                }`}
              />
            </div>
          ))}

          <div className="mt-4 space-y-1 border-t border-slate-100 pt-3 text-sm">
            <div className="flex justify-between text-slate-500">
              <span>{t.receiptSum}</span>
              <span>${suma.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between font-semibold">
              <span>{t.receiptTotal}</span>
              <input
                type="number"
                inputMode="decimal"
                value={totalTicket}
                onChange={(e) => setTotalTicket(e.target.value)}
                className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-right"
              />
            </div>
          </div>

          {!cuadra && (
            <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              {t.receiptMismatch}
            </p>
          )}

          {serverError && (
            <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{serverError}</p>
          )}
        </div>

        <div className="border-t border-slate-100 p-4">
          {user ? (
            <button
              onClick={confirmar}
              disabled={!cuadra || saving || items.length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-calc py-3 font-semibold text-white active:scale-[0.99] disabled:opacity-40"
            >
              {saving ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
              {t.receiptOk}
            </button>
          ) : (
            <button
              onClick={login}
              className="w-full rounded-xl bg-calc py-3 font-semibold text-white active:scale-[0.99]"
            >
              {t.receiptLoginFirst}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
