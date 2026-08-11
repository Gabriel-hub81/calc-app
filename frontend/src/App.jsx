import { useState } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { LangProvider, useLang } from './lib/i18n';
import Calculator from './components/Calculator';
import DayPanel from './components/DayPanel';
import VisionSection from './components/VisionSection';
import AuthButton from './components/AuthButton';
import { LogoMark } from './components/Logo';
import PrivacyNotice from './components/PrivacyNotice';
import AgentNotices from './components/AgentNotices';

function Shell() {
  const { t, lang, setLang } = useLang();
  const { user } = useAuth();
  // resumen del día y alertas: los actualizan Calculator y el flujo de recibos
  const [dia, setDia] = useState(null);
  const [alertas, setAlertas] = useState([]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <LogoMark className="h-8 w-8 text-slate-900" />
            <span className="text-xl font-extrabold tracking-tight">CALC</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
              className="rounded-full px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100"
              aria-label="Cambiar idioma"
            >
              {lang === 'es' ? 'ES · en' : 'EN · es'}
            </button>
            <AuthButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pb-16 pt-6">
        <AgentNotices />
        <h1 className="mb-4 text-center text-2xl font-bold">{t.tagline}</h1>
        <Calculator setDia={setDia} setAlertas={setAlertas} />
        {user && <DayPanel dia={dia} setDia={setDia} alertas={alertas} />}
        <VisionSection />
        <PrivacyNotice />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <LangProvider>
        <Shell />
      </LangProvider>
    </AuthProvider>
  );
}
