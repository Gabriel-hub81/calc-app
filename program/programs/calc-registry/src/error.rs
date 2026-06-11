use anchor_lang::prelude::*;

#[error_code]
pub enum CalcRegistryError {
    // El caso "mismo hash dos veces" lo cubre `init` sobre la PDA existente
    // (falla a nivel sistema). Este enum queda para extensiones futuras
    // (tanda, recompensas) — ver roadmap en el README.
    #[msg("Operación no soportada todavía")]
    NotSupported,
}
