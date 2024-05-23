use anchor_lang::prelude::*;

mod state;
mod context;
use context::*;
pub mod error;

declare_id!("GDWgbqLRpusbwSbXunQyvDpy2YTPjfXQuHxeU4Vu8dzJ");

#[program]
pub mod time_vault {
    use super::*;

    pub fn open_vault(ctx: Context<OpenVault>, seed: u64, amount: u64, deadline: u32) -> Result<()> {
        ctx.accounts.process(seed, amount, deadline, &ctx.bumps)
    }

    pub fn claim_from_vault(ctx: Context<ClaimFromVault>, _seed: u64) -> Result<()> {
        ctx.accounts.process_claim()?;
        ctx.accounts.close_vault_bank()
    }

    pub fn cancel_vault(ctx: Context<CancelVault>, _seed: u64) -> Result<()> {
        ctx.accounts.process_cancel()?;
        ctx.accounts.close_vault_bank()
    }
}
