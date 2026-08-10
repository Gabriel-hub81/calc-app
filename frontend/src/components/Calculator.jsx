import { useState } from 'react';
import { SendHorizonal, LoaderCircle } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { useLang } from '../lib/i18n';
import { useReceipt } from '../hooks/useReceipt';
import VoiceButton from './VoiceButton';
import ReceiptCapture from './ReceiptCapture';
import ReceiptConfirm from './ReceiptConfirm';
import ResultCard from './ResultCard';
import AmbiguityModal from './AmbiguityModal';

export default function Calculator({ setDia, setAlertas }) {
  const { t, lang } = useLang();
  const { user, login, getToken } = useAuth();
  const [texto, setTexto] = useState('');
  const [loading, setLoading] = useState(false);
  const [respuesta, setRespuesta] = useState(null); // { kind, data }
  const [historial, setHistorial] = useState([]); // memoria de sesión, NO localStorage
  const receipt = useReceipt({ getToken });

  const enviar = async (texdoAEnviar) => {
    const q = (texdoAEnviar ?? texto).trim();
    if (!q || loading) return;
    setLoading(true);
    setRespuesta(null);
    try {
      const token = await getToken();
      const resp = await api('/calculate', { body: { texto: q, idioma: lang }, token });

      if (resp.requiere_login) {
        setRespuesta({ kind: 'login', data: resp });
      } else if (resp.ambiguo) {
        setRespuesta({ kind: 'ambiguo', data: resp });
      } else if (resp.error) {
        setRespuesta({ kind: 'error', data: resp });
      } else if (resp.registrado) {
        setRespuesta({ kind: 'registro', data: resp });
        setDia(resp.resumen_dia);
        setAlertas(resp.alertas_precio || []);
        setHistorial((h) => [...h.slice(-4), resp.mensaje]);
        setTexto('');
      } else if (resp.consulta) {
        setRespuesta({ kind: 'consulta', data: resp });
        setDia(resp);
        setTexto('');
      } else if (resp.resultado !== undefined) {
        setRespuesta({ kind: 'resultado', data: { ...resp, texto_original: q } });
        setHistorial((h) => [...h.slice(-4), `${q} = ${resp.resultado}`]);
        setTexto('');
      } else {
        setRespuesta({ kind: 'error', data: { mensaje: t.genericError } });
      }
    } catch {
      setRespuesta({ kind: 'error', data: { mensaje: t.genericError } });
    } finally {
      setLoading(false);
    }
  };

  // Si el ticket no se pudo leer, se dice por qué en vez de abrir una pantalla
  // de confirmación vacía (que parecía "no reconoció ningún renglón").
  const onReceiptFile = async (file) => {
    const resp = await receipt.read(file);
    if (resp?.error || resp?.requiere_login) {
      setRespuesta({
        kind: 'error',
        data: { mensaje: resp.mensaje || t.genericError, sugerencia: resp.sugerencia }
      });
    }
  };

  const onReceiptConfirmed = (resp) => {
    setDia(resp.resumen_dia);
    setAlertas(resp.alertas_precio || []);
    setHistorial((h) => [...h.slice(-4), resp.mensaje]);
    setRespuesta({ kind: 'registro', data: resp });
    receipt.clear();
  };

  return (
    <section>
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              enviar();
            }
          }}
          placeholder={t.placeholder}
          rows={2}
          className="w-full resize-none bg-transparent text-lg outline-none placeholder:text-slate-400"
        />
        <div className="relative mt-2 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <VoiceButton onText={(v) => setTexto(v)} />
            <ReceiptCapture onFile={onReceiptFile} reading={receipt.reading} />
          </div>
          <button
            onClick={() => enviar()}
            disabled={loading || !texto.trim()}
            className="flex items-center gap-2 rounded-xl bg-calc px-5 py-2.5 font-semibold text-white transition active:scale-95 disabled:opacity-40"
          >
            {loading ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" /> {t.thinking}
              </>
            ) : (
              <>
                {t.send} <SendHorizonal className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>

      {respuesta?.kind === 'login' && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
          <p className="mb-3 text-slate-700">{t.needLogin}</p>
          <button
            onClick={login}
            className="rounded-xl bg-calc px-5 py-2 font-semibold text-white active:scale-95"
          >
            {t.login}
          </button>
        </div>
      )}

      {(respuesta?.kind === 'resultado' || respuesta?.kind === 'registro') && (
        <ResultCard kind={respuesta.kind} data={respuesta.data} />
      )}

      {respuesta?.kind === 'consulta' && (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <p className="text-slate-800">{respuesta.data.mensaje}</p>
        </div>
      )}

      {respuesta?.kind === 'error' && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm">
          <p className="font-semibold text-red-700">{t.errorTitle}</p>
          <p className="mt-1 text-slate-700">{respuesta.data.mensaje}</p>
          {respuesta.data.sugerencia && (
            <p className="mt-1 text-sm text-slate-500">{respuesta.data.sugerencia}</p>
          )}
        </div>
      )}

      {respuesta?.kind === 'ambiguo' && (
        <AmbiguityModal
          data={respuesta.data}
          onPick={(opcion) => enviar(opcion)}
          onClose={() => setRespuesta(null)}
        />
      )}

      {receipt.reading && (
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-slate-600 shadow-sm">
          <LoaderCircle className="h-4 w-4 animate-spin" /> {t.receiptReading}
        </div>
      )}

      {receipt.proposal && !receipt.reading && (
        <ReceiptConfirm
          proposal={receipt.proposal}
          onConfirm={receipt.confirm}
          saving={receipt.saving}
          onConfirmed={onReceiptConfirmed}
          onClose={receipt.clear}
        />
      )}

      {historial.length > 0 && (
        <div className="mt-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t.history}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {historial.map((h, i) => (
              <span
                key={i}
                className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600"
              >
                {h}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
