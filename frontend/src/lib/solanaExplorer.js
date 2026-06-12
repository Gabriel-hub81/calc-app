const NETWORK = import.meta.env.VITE_SOLANA_NETWORK || 'devnet';

export function txUrl(txId) {
  const suffix = NETWORK === 'mainnet-beta' ? '' : `?cluster=${NETWORK}`;
  return `https://solscan.io/tx/${txId}${suffix}`;
}
