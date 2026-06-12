import { useRef } from 'react';
import { Camera } from 'lucide-react';

/** Botón 📷: en móvil abre la cámara, en desktop el selector de archivos. */
export default function ReceiptCapture({ onFile, reading }) {
  const inputRef = useRef(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = '';
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={reading}
        aria-label="Foto de ticket"
        className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 disabled:opacity-40"
      >
        <Camera className="h-5 w-5" />
      </button>
    </>
  );
}
