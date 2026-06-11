use anchor_lang::prelude::*;

/// Registro inmutable de un cálculo verificado.
/// PDA: ["calc", wallet, hash] — una cuenta por (wallet, hash).
#[account]
#[derive(InitSpace)]
pub struct CalcRecord {
    /// SHA-256(expresion_normalizada|resultado|timestamp|wallet) — calculado
    /// en el backend; aquí solo se guarda.
    pub hash: [u8; 32],
    /// Wallet que registró (el usuario, no CALC).
    pub wallet: Pubkey,
    /// Unix timestamp del slot en que se registró.
    pub timestamp: i64,
    pub bump: u8,
}

/// Evento para indexación (explorers, analytics del ecosistema).
#[event]
pub struct CalcRegistered {
    pub wallet: Pubkey,
    pub hash: [u8; 32],
    pub timestamp: i64,
}
