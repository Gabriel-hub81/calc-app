import { useState } from 'react';
import { api } from '../lib/api';

const MAX_DIM = 1280;

/** Comprime la foto en el cliente antes de subirla (datos móviles caros). */
async function compressImage(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
  return dataUrl.split(',')[1]; // solo el base64
}

export function useReceipt({ getToken }) {
  const [reading, setReading] = useState(false);
  const [proposal, setProposal] = useState(null); // respuesta de /receipt
  const [saving, setSaving] = useState(false);

  const read = async (file) => {
    setReading(true);
    try {
      const imagen_base64 = await compressImage(file);
      const resp = await api('/receipt', {
        body: { imagen_base64, mime_type: 'image/jpeg' }
      });
      setProposal(resp);
      return resp;
    } catch {
      const err = { error: true };
      setProposal(err);
      return err;
    } finally {
      setReading(false);
    }
  };

  const confirm = async (propuestaEditada) => {
    setSaving(true);
    try {
      const token = await getToken();
      return await api('/receipt/confirm', {
        body: { propuesta: propuestaEditada },
        token
      });
    } finally {
      setSaving(false);
    }
  };

  const clear = () => setProposal(null);

  return { reading, proposal, saving, read, confirm, clear };
}
