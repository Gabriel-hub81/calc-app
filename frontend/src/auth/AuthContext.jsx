/**
 * Autenticación con el wallet embebido NO-CUSTODIAL.
 *
 * Dos modos, misma interfaz useAuth() → { ready, user, login, logout, getToken }:
 *
 * - PRIVY (producción): VITE_PRIVY_APP_ID configurado. El usuario entra con
 *   correo o teléfono; Privy genera un wallet de Solana auto-custodial por
 *   debajo (MPC) sin que vea llaves ni frases semilla. Ni Privy ni CALC
 *   tienen acceso a sus fondos.
 * - DEMO (desarrollo, sin App ID): login simulado local con token "dev:<uid>"
 *   que el backend acepta en AUTH_MODE=dev. Permite probar todo el flujo
 *   end-to-end sin cuenta de Privy.
 *
 * Regla de UX: el wallet es INVISIBLE. Nada de "wallet/blockchain/llaves" en
 * el flujo principal. Calcular SIEMPRE funciona sin login.
 */
import { createContext, useContext, useState } from 'react';
import { PrivyProvider, usePrivy } from '@privy-io/react-auth';

const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID || '';

const DemoAuthContext = createContext(null);

function DemoAuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = sessionStorage.getItem('calc_demo_user');
    return saved ? JSON.parse(saved) : null;
  });

  const login = () => {
    const u = { uid: 'demo', name: 'Demo' };
    sessionStorage.setItem('calc_demo_user', JSON.stringify(u));
    setUser(u);
  };
  const logout = () => {
    sessionStorage.removeItem('calc_demo_user');
    setUser(null);
  };
  const getToken = async () => (user ? `dev:${user.uid}` : null);

  return (
    <DemoAuthContext.Provider value={{ ready: true, user, login, logout, getToken }}>
      {children}
    </DemoAuthContext.Provider>
  );
}

function usePrivyAdapter() {
  // TODO (Sesión 3 final, con App ID real): verificar contra la doc vigente
  // de Privy los nombres exactos de la API al conectar.
  const { ready, authenticated, user, login, logout, getAccessToken } = usePrivy();
  return {
    ready,
    user: authenticated
      ? {
          uid: user?.id,
          name: user?.email?.address || user?.phone?.number || 'Tú'
        }
      : null,
    login,
    logout,
    getToken: getAccessToken
  };
}

const PrivyAdapterContext = createContext(null);

function PrivyAdapter({ children }) {
  const value = usePrivyAdapter();
  return <PrivyAdapterContext.Provider value={value}>{children}</PrivyAdapterContext.Provider>;
}

export function AuthProvider({ children }) {
  if (!PRIVY_APP_ID) {
    return <DemoAuthProvider>{children}</DemoAuthProvider>;
  }
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ['email', 'sms'],
        appearance: { theme: 'light', accentColor: '#10b981' },
        embeddedWallets: {
          solana: { createOnLogin: 'users-without-wallets' }
        }
      }}
    >
      <PrivyAdapter>{children}</PrivyAdapter>
    </PrivyProvider>
  );
}

export function useAuth() {
  const demo = useContext(DemoAuthContext);
  const privy = useContext(PrivyAdapterContext);
  return demo || privy;
}
