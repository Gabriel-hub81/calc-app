import { useState } from 'react';
import { LoaderCircle, TrendingUp } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { useLang } from '../lib/i18n';
import PriceAlerts from './PriceAlerts';

const money = (n) => `$${Number(n || 0).toFixed(2)}`;

export default function DayPanel({ dia, setDia, alertas }) {
  const { t, lang } = useLang();
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [precios, setPrecios] = useState(null);

  const comoVoy = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const resp = await api('/calculate', {
        body: { texto: lang === 'es' ? '¿cómo voy hoy?' : 'how am I doing today?', idioma: lang },
        token
      });
      if (resp.consulta) setDia(resp);
    } finally {
      setLoading(false);
    }
  };

  const verPrecios = async () => {
    const token = await getToken();
    const resp = await api('/prices/summary', { method: 'GET', token });
    if (resp.productos) setPrecios(resp);
  };

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="font-bold">{t.myDay}</p>
        <button
          onClick={comoVoy}
          disabled={loading}
          className="flex items-center gap-1 text-sm font-semibold text-calc-dark hover:underline"
        >
          {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
          {t.howAmI}
        </button>
      </div>

      {dia ? (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-emerald-50 p-2">
              <p className="text-xs text-slate-500">{t.sales}</p>
              <p className="font-bold text-calc-dark">{money(dia.ventas)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-2">
              <p className="text-xs text-slate-500">{t.expenses}</p>
              <p className="font-bold text-slate-700">{money(dia.gastos)}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-2">
              <p className="text-xs text-slate-500">{t.balance}</p>
              <p className={`font-bold ${dia.balance >= 0 ? 'text-calc-dark' : 'text-red-600'}`}>
                {money(dia.balance)}
              </p>
            </div>
          </div>
          {dia.mensaje && <p className="mt-3 text-sm text-slate-600">{dia.mensaje}</p>}
        </>
      ) : (
        <p className="mt-2 text-sm text-slate-400">—</p>
      )}

      <PriceAlerts alertas={alertas} />

      <button
        onClick={verPrecios}
        className="mt-3 text-sm font-semibold text-amber-700 hover:underline"
      >
        {t.pricesQ}
      </button>

      {precios && (
        <div className="mt-2 space-y-1">
          {precios.productos.length === 0 ? (
            <p className="text-sm text-slate-500">{precios.mensaje}</p>
          ) : (
            precios.productos.map((p) => (
              <p key={p.producto} className="text-sm text-slate-600">
                {p.mensaje}
              </p>
            ))
          )}
        </div>
      )}
    </section>
  );
}
