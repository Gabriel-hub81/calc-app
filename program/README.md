# calc-registry — Programa Solana de CALC

Registro de verificación on-chain para CALC. **Principio rector**: solo va on-chain lo que da valor real al usuario — no se hashea cada cálculo por ceremonia. Registrar un comprobante es una acción **opcional** que el usuario elige; nunca un side-effect automático de calcular.

## Qué hace

Una sola instrucción:

```
register_calc(hash: [u8; 32])
```

- Crea una PDA con seeds `["calc", signer, hash]`
- Guarda: `hash`, `wallet` (Pubkey del firmante), `timestamp`, `bump`
- Emite el evento `CalcRegistered { wallet, hash, timestamp }`
- Registrar el mismo hash dos veces **falla** (init sobre PDA existente)
- Sin lógica de negocio, sin custodia de fondos — solo el rent de la PDA, que paga el firmante

El hash se calcula en el backend: `SHA256(expresion_normalizada|resultado|timestamp|wallet)`.

## Versiones usadas (junio 2026)

| Herramienta | Versión |
|---|---|
| Anchor CLI | 1.0.2 (vía avm) |
| Solana CLI (Agave) | 3.1.10 (gestionada por Anchor) / 4.0.x standalone |
| Rust | 1.96 stable |
| Cliente TS | `@anchor-lang/core` 1.0.2 (renombrado desde `@coral-xyz/anchor`) |

> El repo canónico de Anchor vive hoy en `github.com/otter-sec/anchor` (cadena de transfers coral-xyz → solana-foundation → otter-sec, verificada contra crates.io).

## Instalación de la toolchain

```bash
# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
# Solana CLI (Agave)
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
# Anchor vía avm
cargo install --git https://github.com/solana-foundation/anchor avm --force
avm install 1.0.2 && avm use 1.0.2
```

## Build y tests

```bash
anchor build      # compila el programa → target/deploy/calc_registry.so
cargo test        # tests con LiteSVM — rápidos, sin validador local
```

Los tests (`programs/calc-registry/tests/test_register_calc.rs`) cubren: registro exitoso, datos correctos on-chain, hash duplicado falla, evento emitido, y cinco registros de la misma wallet.

> Anchor 1.x usa tests en Rust con [LiteSVM](https://github.com/LiteSVM/litesvm) en lugar de los tests TS con validador local de las versiones 0.x — son deterministas y corren en milisegundos.

## Deploy

```bash
# Devnet (gratis, para desarrollo)
solana config set --url devnet
solana airdrop 2
anchor deploy --provider.cluster devnet

# Mainnet (deploy final, semana 6 del plan)
# 1. Genera keypair nuevo de programa y actualiza declare_id! y Anchor.toml
# 2. anchor deploy --provider.cluster mainnet-beta
#    (requiere ~2-3 SOL para rent del programa)
```

**Program ID actual (localnet/devnet)**: `Gh3WhpAtc8HDUUU59amgzaxvg4nCV3V4pSN3EntBHwRL`

## Cómo lo llama el backend

`backend/src/services/solana.js` construye la instrucción sin SDK de Anchor (discriminator + hash, 40 bytes):

```js
const data = Buffer.concat([
  sha256('global:register_calc').subarray(0, 8),  // discriminator de Anchor
  hashBytes                                        // [u8; 32]
]);
// accounts: [record PDA (w), signer (ws), system program]
```

Y `POST /verify` aplica la regla: **si Solana falla, el cálculo igual se entrega** — la verificación es un plus, nunca un bloqueo.

**Nota no-custodial**: en producción la transacción la firma el usuario desde su wallet embebido en el cliente (Sesión 3). El modo "backend firma" (`SOLANA_KEYPAIR_PATH`) es solo para devnet/demo y queda claramente delimitado en el código.

## ⚠ Decisión pendiente antes del deploy a mainnet (semana 6)

El diseño actual crea una PDA por comprobante → **~0.00145 SOL (~$0.22) de rent
cada uno**, insubsidiable a escala. Antes de mainnet, cambiar a **evento-only**:
la instrucción emite `CalcRegistered` sin crear cuenta; la prueba es la
transacción misma (el link a Solscan que el usuario ya ve). Costo resultante:
~$0.001/comprobante, pagado por CALC como fee payer patrocinado (el usuario
firma; CALC paga; no-custodial intacto). La PDA consultable queda para el tier
B2B. Detalle completo: `CALC_Plan_v3.md` § 11.5.

## Roadmap on-chain — hacia dónde se extiende este programa

El programa es deliberadamente mínimo, pero su arquitectura (PDAs por usuario, eventos para indexación, cero custodia) está pensada para crecer hacia donde Solana **sí** agrega valor real:

### 1. Tanda digital (Capa 2 — prioridad de revenue)
Contrato que administra un círculo de ahorro rotativo (tanda/vaquita/cundina): aportes, turno de cobro y distribución automática, con reglas que nadie — ni CALC — puede alterar. **Este es el caso donde Solana brilla**: confianza sin intermediario para un mecanismo de ahorro que usan millones de personas en LatAm y que hoy depende de la honradez del organizador.

### 2. Recompensas CALC (futuro, condicionado a comunidad real)
Distribución del token CALC a quienes contribuyen al ecosistema (validar parseos, aportar datos, reportar errores de dinero). Por decisión de diseño (junio 2026), esto está **fuera del camino crítico**: se diseñará con mecanismos anti-farming solo cuando exista comunidad real.

Ambas extensiones son no-custodiales: el usuario firma desde su wallet embebido; CALC nunca mueve fondos sin su firma.
