/**
 * Integración con el programa calc-registry en Solana.
 *
 * PRINCIPIOS:
 * - La verificación on-chain es OPCIONAL: nunca bloquea un cálculo. Si Solana
 *   falla, el cálculo igual se entrega.
 * - NO-CUSTODIAL: en producción (Sesión 3) la transacción la firma el usuario
 *   desde su wallet embebido, en el cliente. El modo "backend firma" de aquí
 *   es SOLO para devnet/demo (SOLANA_KEYPAIR_PATH) y registra la wallet del
 *   backend, no la del usuario — está claramente delimitado.
 */
const crypto = require('crypto');
const fs = require('fs');

const PROGRAM_ID = process.env.CALC_PROGRAM_ID || 'Gh3WhpAtc8HDUUU59amgzaxvg4nCV3V4pSN3EntBHwRL';
const RPC_URL = process.env.SOLANA_RPC_URL || '';
const KEYPAIR_PATH = process.env.SOLANA_KEYPAIR_PATH || '';
const CLUSTER = process.env.SOLANA_CLUSTER || 'devnet';

/**
 * Hash canónico de un cálculo verificado:
 * SHA256(expresion_normalizada|resultado|timestamp|wallet)
 */
function computeCalcHash({ expresion, resultado, timestamp, wallet }) {
  const normalizada = String(expresion).replace(/\s+/g, ' ').trim();
  const payload = `${normalizada}|${resultado}|${timestamp}|${wallet}`;
  const bytes = crypto.createHash('sha256').update(payload, 'utf8').digest();
  return { hex: bytes.toString('hex'), bytes };
}

/** Discriminator de Anchor para la instrucción global register_calc. */
function instructionDiscriminator(name) {
  return crypto.createHash('sha256').update(`global:${name}`).digest().subarray(0, 8);
}

function isOnChainEnabled() {
  return Boolean(RPC_URL && KEYPAIR_PATH);
}

function explorerUrl(txId) {
  const suffix = CLUSTER === 'mainnet-beta' ? '' : `?cluster=${CLUSTER}`;
  return `https://solscan.io/tx/${txId}${suffix}`;
}

/**
 * Registra un hash on-chain (modo devnet/demo: firma el keypair del backend).
 * Lanza si Solana falla — el caller decide qué hacer (nunca bloquear el cálculo).
 */
async function registerOnChain(hashBytes) {
  if (!isOnChainEnabled()) {
    throw new Error('Solana no está configurado (SOLANA_RPC_URL / SOLANA_KEYPAIR_PATH)');
  }
  // require perezoso: el backend funciona completo sin esta dependencia activa
  const {
    Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction,
    sendAndConfirmTransaction
  } = require('@solana/web3.js');

  const connection = new Connection(RPC_URL, 'confirmed');
  const signer = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(KEYPAIR_PATH, 'utf8')))
  );
  const programId = new PublicKey(PROGRAM_ID);

  const [recordPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('calc'), signer.publicKey.toBuffer(), hashBytes],
    programId
  );

  const data = Buffer.concat([instructionDiscriminator('register_calc'), hashBytes]);
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: recordPda, isSigner: false, isWritable: true },
      { pubkey: signer.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
    ],
    data
  });

  const txId = await sendAndConfirmTransaction(connection, new Transaction().add(ix), [signer]);
  return { txId, explorerUrl: explorerUrl(txId), wallet: signer.publicKey.toBase58() };
}

module.exports = { computeCalcHash, registerOnChain, isOnChainEnabled, PROGRAM_ID, CLUSTER };
