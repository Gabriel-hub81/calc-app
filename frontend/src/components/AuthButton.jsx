import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useLang } from '../lib/i18n';

/**
 * "Entrar con correo o teléfono" — el wallet embebido se crea por debajo,
 * sin que el usuario vea una llave. Se muestra nombre/inicial amable, nunca
 * una dirección hex (esa vive en ajustes, para el usuario avanzado).
 */
export default function AuthButton() {
  const { ready, user, login, logout } = useAuth();
  const { t } = useLang();
  const [menu, setMenu] = useState(false);

  if (!ready) return null;

  if (!user) {
    return (
      <button
        onClick={login}
        title={t.loginHint}
        className="rounded-xl bg-calc px-4 py-1.5 text-sm font-semibold text-white active:scale-95"
      >
        {t.login}
      </button>
    );
  }

  const inicial = (user.name || '?').charAt(0).toUpperCase();

  return (
    <div className="relative">
      <button
        onClick={() => setMenu((m) => !m)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 font-bold text-calc-dark"
        aria-label={user.name}
      >
        {inicial}
      </button>
      {menu && (
        <div className="absolute right-0 top-10 z-20 w-44 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          <p className="truncate px-2 py-1 text-sm font-medium text-slate-700">{user.name}</p>
          <button
            onClick={() => {
              setMenu(false);
              logout();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-slate-600 hover:bg-slate-50"
          >
            <LogOut className="h-4 w-4" /> {t.logout}
          </button>
        </div>
      )}
    </div>
  );
}
