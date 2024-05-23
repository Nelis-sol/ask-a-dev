use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};
use crate::state::Vault;


#[derive(Accounts)]
// seed is a unique identifier of the vault, there can be multiple vaults between sender and receiver but each one is unique
// amount is the amount of tokens of a specific mint (e.g. USDC)
#[instruction(seed: u64, amount: u64)]
pub struct OpenVault<'info> {
    #[account(mut)]
    // Payer is paying for the TX, this can be anyone (doesn't need to be the sender or receiver)
    pub payer: Signer<'info>,
    // Sender of funds (receives funds back from vault when canceled)
    #[account(mut)]
    pub sender: InterfaceAccount<'info, TokenAccount>,
    // Receiver of funds (receives funds from vault when claimed)
    #[account(mut)]
    pub receiver: InterfaceAccount<'info, TokenAccount>,
    #[account(init,
      payer = payer,
      space = Vault::INIT_SPACE,
      seeds = [b"vault", sender.key().as_ref(), receiver.key().as_ref(), seed.to_le_bytes().as_ref()],
      bump)]
    // Vault contains parameters of agreement between sender and receiver
    pub vault: Account<'info, Vault>,
    // Mint of the tokens that are exchanged between sender and receiver
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        init,
        payer = payer,
        seeds = [b"vault_bank", vault.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = vault
    )]
    // Vault Bank holds the actual tokens from the sender that will go to receiver
    pub vault_bank: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}


impl<'info> OpenVault<'info> {
    // we open a vault which means we: 
    // - set data to vault pda
    pub fn process(&mut self, seed: u64, amount: u64, deadline: u32, bumps: &OpenVaultBumps) -> Result<()> {
        // Save data into the Vault PDA
        self.vault.set_inner(Vault {
            sender: self.sender.to_account_info().key(),
            receiver: self.receiver.to_account_info().key(),
            mint: self.mint.to_account_info().key(),
            seed,
            amount,
            deadline,
            bump: bumps.vault,
        });

        Ok(())
    }
}

