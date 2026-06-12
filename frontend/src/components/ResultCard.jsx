import { useState } from 'react';
import { BadgeCheck, ExternalLink, LoaderCircle } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { useLang } from '../lib/i18n';
import { txUrl } from '../lib/solanaExplorer';
import ConfidenceBar from './ConfidenceBar';

export default function ResultCard({ kind, data }) {
  const { t } = useLang();
  const { user, getToken } = useAuth();
  const [proof, setProof] = useState(null);
  const [saving, setSaving] = useState(false);

  const correcciones = Object.entries(data.correcciones || {});

  // "Guardar comprobante" — lenguaje simple, nada de jerga cripto.
  // Solo aparece si el usuario entró; es acción opcional.
  const guardarComprobante = async () => {
    if (saving || proof) return;
    setSaving(true);
    try {
      const token = await getToken();
      const resp = await api('/verify', {
        body: { expresion: data.expresion_parseada, resultado: data.resultado },
        token
      });
      setProof(resp);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
      {kind === 'resultado' ? (
        <>
          <p className="text-4xl font-extrabold tracking-tight text-slate-900">
            {data.resultado}
          </p>
          <p className="mt-1 text-slate-600">{data.texto_original}</p>
        </>
      ) : (
        <p className="text-lg font-semibold text-slate-800">{data.mensaje}</p>
      )}

      {correcciones.length > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          ({t.corrected}: {correcciones.map(([de, a]) => `${de} → ${a}`).join(', ')})
        </p>
      )}

      {kind === 'resultado' && <ConfidenceBar nivel={data.confianza} />}

      {kind === 'resultado' && user && !proof && (
        <button
          onClick={guardarComprobante}
          disabled={saving}
          className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-calc-dark hover:underline disabled:opacity-50"
        >
          {saving ? (
            <>
              <LoaderCircle className="h-4 w-4 animate-spin" /> {t.savingProof}
            </>
          ) : (
            <>
              <BadgeCheck className="h-4 w-4" /> {t.saveProof}
            </>
          )}
        </button>
      )}

      {proof && (
        <div className="mt-3 text-sm">
          {proof.verificado ? (
            <span className="flex items-center gap-1.5 font-semibold text-calc-dark">
              <BadgeCheck className="h-4 w-4" /> {t.proofSaved}
              <a
                href={txUrl(proof.tx_id)}
                target="_blank"
                rel="noreferrer"
                className="ml-1 inline-flex items-center gap-0.5 underline"
              >
                {t.viewProof} <ExternalLink className="h-3 w-3" />
              </a>
            </span>
          ) : (
            <span className="text-slate-500">{t.proofPending}</span>
          )}
        </div>
      )}
    </div>
  );
}
