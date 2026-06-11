process.env.AUTH_MODE = 'dev';
process.env.STORE = 'memory';

const request = require('supertest');

jest.mock('../src/services/gemini', () => ({
  parseTexto: jest.fn(),
  parseReceipt: jest.fn(),
  MODEL: 'mock'
}));

jest.mock('../src/services/solana', () => {
  const actual = jest.requireActual('../src/services/solana');
  return {
    ...actual,
    computeCalcHash: actual.computeCalcHash, // el hash real, siempre
    isOnChainEnabled: jest.fn(),
    registerOnChain: jest.fn()
  };
});

const { computeCalcHash, isOnChainEnabled, registerOnChain } = require('../src/services/solana');
const { createApp } = require('../src/index');

const auth = { Authorization: 'Bearer dev:user1' };

let app;
beforeEach(() => {
  jest.clearAllMocks();
  app = createApp({ rateLimits: { perMinute: 10000, perDay: 100000 } });
});

describe('computeCalcHash', () => {
  test('determinista y sensible a cada componente', () => {
    const base = { expresion: '0.15 * 800', resultado: 120, timestamp: 1718000000000, wallet: 'user1' };
    const a = computeCalcHash(base);
    expect(a.hex).toHaveLength(64);
    expect(a.bytes).toHaveLength(32);
    expect(computeCalcHash(base).hex).toBe(a.hex); // determinista
    expect(computeCalcHash({ ...base, resultado: 121 }).hex).not.toBe(a.hex);
    expect(computeCalcHash({ ...base, wallet: 'user2' }).hex).not.toBe(a.hex);
  });

  test('normaliza espacios en la expresión', () => {
    const base = { resultado: 120, timestamp: 1, wallet: 'u' };
    expect(computeCalcHash({ ...base, expresion: '0.15  *  800' }).hex)
      .toBe(computeCalcHash({ ...base, expresion: '0.15 * 800' }).hex);
  });
});

describe('POST /verify', () => {
  test('sin login → 401 (es una acción del usuario)', async () => {
    const res = await request(app).post('/verify').send({ expresion: '2 + 2', resultado: 4 });
    expect(res.status).toBe(401);
  });

  test('body inválido → 400', async () => {
    const res = await request(app).post('/verify').set(auth).send({ expresion: '2 + 2' });
    expect(res.status).toBe(400);
  });

  test('Solana no configurado → comprobante generado, registro pendiente', async () => {
    isOnChainEnabled.mockReturnValue(false);
    const res = await request(app).post('/verify').set(auth).send({ expresion: '0.15 * 800', resultado: 120 });

    expect(res.status).toBe(200);
    expect(res.body.verificado).toBe(false);
    expect(res.body.registro_pendiente).toBe(true);
    expect(res.body.hash).toHaveLength(64);
    expect(registerOnChain).not.toHaveBeenCalled();
  });

  test('registro on-chain exitoso → tx_id y explorer_url', async () => {
    isOnChainEnabled.mockReturnValue(true);
    registerOnChain.mockResolvedValue({
      txId: 'abc123',
      explorerUrl: 'https://solscan.io/tx/abc123?cluster=devnet'
    });
    const res = await request(app).post('/verify').set(auth).send({ expresion: '0.15 * 800', resultado: 120 });

    expect(res.body.verificado).toBe(true);
    expect(res.body.tx_id).toBe('abc123');
    expect(res.body.explorer_url).toMatch(/solscan\.io/);
  });

  test('si Solana falla, el cálculo igual es válido — nunca bloquea', async () => {
    isOnChainEnabled.mockReturnValue(true);
    registerOnChain.mockRejectedValue(new Error('RPC timeout'));
    const res = await request(app).post('/verify').set(auth).send({ expresion: '0.15 * 800', resultado: 120 });

    expect(res.status).toBe(200);
    expect(res.body.verificado).toBe(false);
    expect(res.body.hash).toHaveLength(64);
    expect(res.body.mensaje).toMatch(/válido/);
    expect(JSON.stringify(res.body)).not.toMatch(/RPC timeout/);
  });
});
