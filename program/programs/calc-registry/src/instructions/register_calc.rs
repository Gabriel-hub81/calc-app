use anchor_lang::prelude::*;

use crate::constants::CALC_SEED;
use crate::state::{CalcRecord, CalcRegistered};

#[derive(Accounts)]
#[instruction(hash: [u8; 32])]
pub struct RegisterCalc<'info> {
    /// `init` falla si la PDA ya existe → registrar el mismo hash dos veces
    /// falla con error claro. Sin instrucción de cierre: el registro es inmutable.
    #[account(
        init,
        payer = signer,
        space = 8 + CalcRecord::INIT_SPACE,
        seeds = [CALC_SEED, signer.key().as_ref(), hash.as_ref()],
        bump
    )]
    pub record: Account<'info, CalcRecord>,

    #[account(mut)]
    pub signer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<RegisterCalc>, hash: [u8; 32]) -> Result<()> {
    let record = &mut ctx.accounts.record;
    record.hash = hash;
    record.wallet = ctx.accounts.signer.key();
    record.timestamp = Clock::get()?.unix_timestamp;
    record.bump = ctx.bumps.record;

    emit!(CalcRegistered {
        wallet: record.wallet,
        hash,
        timestamp: record.timestamp,
    });

    Ok(())
}
