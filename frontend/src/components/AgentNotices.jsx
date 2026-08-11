import { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { useLang } from '../lib/i18n';

/**
 * Lo que CALC hizo mientras no estabas.
 *
 * Los avisos los deja el vigía de precios, que corre solo cada mañana. Aparecen
 * arriba de todo porque su valor es llegar ANTES de la próxima compra; si se
 * ven cuando ya pagaste, no sirven de nada. Se pueden descartar uno por uno y
 * no vuelven.
 */
export default function AgentNotices() {
  const { user, getToken } = useAuth();
  const { t } = useLang();
  const [avisos, setAvisos] = useState([]);

  useEffect(() => {
    let cancelado = false;
    if (!user) {
      setAvisos([]);
      return undefined;
    }
    (async () => {
      try {
        const token = await getToken();
        const resp = await api('/notices', { method: 'GET', token });
        if (!cancelado && Array.isArray(resp.avisos)) setAvisos(resp.avisos);
      } catch {
        // Silencio a propósito: un aviso que no carga no debe estorbar la app
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [user, getToken]);

  const descartar = async (id) => {
    setAvisos((prev) => prev.filter((a) => a.id !== id));
    try {
      const token = await getToken();
      await api(`/notices/${id}/leido`, { token });
    } catch {
      // Si falla, vuelve a aparecer mañana. Preferible a bloquear la pantalla.
    }
  };

  if (avisos.length === 0) return null;

  return (
    <section className="mb-4">
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
        <Bell className="h-3.5 w-3.5" /> {t.agentNoticesTitle}
      </p>
      <div className="space-y-2">
        {avisos.map((a) => (
          <div
            key={a.id}
            className="flex items-start justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm"
          >
            <p className="text-sm text-slate-800">{a.mensaje}</p>
            <button
              onClick={() => descartar(a.id)}
              aria-label={t.dismiss}
              className="shrink-0 rounded-full p-1 text-amber-700 hover:bg-amber-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
