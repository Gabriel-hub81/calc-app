pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("Gh3WhpAtc8HDUUU59amgzaxvg4nCV3V4pSN3EntBHwRL");

/// calc-registry — registro de verificación de CALC.
///
/// PRINCIPIO: solo va on-chain lo que da valor real al usuario. Este programa
/// NO se llama en cada cálculo — registrar es una acción OPCIONAL que el
/// usuario elige ("guardar comprobante"). Sin lógica de negocio, sin custodia
/// de fondos (solo el rent de la PDA, que paga el firmante).
///
/// Roadmap on-chain (ver README): tanda digital y recompensas — extensiones
/// no-custodiales donde el usuario siempre firma desde su propio wallet.
#[program]
pub mod calc_registry {
    use super::*;

    /// Registra el hash SHA-256 de un cálculo verificado.
    /// La PDA ["calc", signer, hash] hace que registrar el mismo hash dos
    /// veces falle (init sobre cuenta existente).
    pub fn register_calc(ctx: Context<RegisterCalc>, hash: [u8; 32]) -> Result<()> {
        instructions::register_calc::handler(ctx, hash)
    }
}
