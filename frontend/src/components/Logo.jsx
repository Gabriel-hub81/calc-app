/**
 * Marca de CALC.
 *
 * - LogoMark: la libreta con palomitas (los pendientes hechos) y el «=» verde
 *   en la última línea — la cuenta resuelta. Es el logo completo de la app.
 * - IconMark: el «=» sobre azul noche. Es el ícono de instalación y el favicon;
 *   vive también en public/icon.svg (de ahí salen los PNG del manifiesto).
 *
 * Los dos comparten el mismo «=»: son la misma familia.
 */

export function LogoMark({ className = 'h-8 w-8' }) {
  return (
    <svg viewBox="0 0 50 56" className={className} role="img" aria-label="CALC">
      <rect
        x="1.5"
        y="1.5"
        width="47"
        height="53"
        rx="7"
        fill="#fff"
        stroke="currentColor"
        strokeWidth="3"
      />
      <circle cx="13" cy="8" r="2" fill="currentColor" />
      <circle cx="25" cy="8" r="2" fill="currentColor" />
      <circle cx="37" cy="8" r="2" fill="currentColor" />
      {/* pendientes ya palomeados */}
      <path
        d="M9 21 l4 4 l7 -8"
        fill="none"
        stroke="#10b981"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="24" y="20" width="17" height="3.5" rx="1.75" fill="#cbd5e1" />
      <path
        d="M9 34 l4 4 l7 -8"
        fill="none"
        stroke="#10b981"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="24" y="33" width="17" height="3.5" rx="1.75" fill="#cbd5e1" />
      {/* la cuenta resuelta: el «=» del ícono */}
      <rect x="9" y="43" width="32" height="4.5" rx="2.25" fill="#10b981" />
      <rect x="9" y="50" width="32" height="4.5" rx="2.25" fill="#10b981" />
    </svg>
  );
}

export function IconMark({ className = 'h-8 w-8' }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="CALC">
      <rect width="64" height="64" rx="14" fill="#0f172a" />
      <rect x="15" y="21" width="34" height="7.5" rx="3.75" fill="#34d399" />
      <rect x="15" y="35.5" width="34" height="7.5" rx="3.75" fill="#34d399" />
    </svg>
  );
}
