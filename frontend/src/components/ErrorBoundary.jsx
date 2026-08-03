import { Component } from 'react';

/**
 * Última red de seguridad: si algo truena al renderizar, jamás una pantalla
 * en blanco muda — se muestra qué pasó y cómo reintentar. Clave para probar
 * en celulares, donde no hay consola que consultar.
 */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto mt-10 max-w-md rounded-2xl border border-red-200 bg-red-50 p-6 text-slate-800">
        <p className="text-lg font-bold">Algo salió mal al cargar CALC</p>
        <p className="mt-2 text-sm">
          Recarga la página para intentar de nuevo. Si sigue pasando, comparte
          este detalle técnico:
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-white p-3 text-xs text-red-700">
          {String(this.state.error?.message || this.state.error)}
        </pre>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white"
        >
          Recargar
        </button>
      </div>
    );
  }
}
