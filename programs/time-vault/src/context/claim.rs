use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token,
    token_interface::{Mint, TokenAccount, TokenInterface},
};
use anchor_lang::system_program;
use crate::error::TimeVaultErrors;
use crate::state::Vault;
use solana_program::pubkey;


#[derive(Accounts)]
// seed is a unique identifier of the vault, there can be multiple vaults between sender and receiver but each one is unique
#[instruction(seed: u64)]
pub struct ClaimFromVault<'info> {
    #[account(mut)]
    // Payer is paying for the TX, this can be anyone (doesn't need to be the sender or receiver)
    pub payer: Signer<'info>,
    // sender used in vault constraint
    #[account(mut)]
    pub sender: InterfaceAccount<'info, TokenAccount>,
    // Receiver of funds
    #[account(mut)]
    pub receiver: InterfaceAccount<'info, TokenAccount>,
    #[account(mut,
        token::mint = mint,
        token::authority = vault,
    )]
    // Vault_bank contains the tokens
    pub vault_bank: InterfaceAccount<'info, TokenAccount>,
    // Mint of the tokens
    pub mint: InterfaceAccount<'info, Mint>,
    // close vault account upon completion and send lamports to the signer/payer
    // can change the destination to sender or ask-a-dev
    #[account(mut, has_one=sender, close=askadev)]
    pub vault: Account<'info, Vault>,
    // rent get's refunded to the askadev account (which also paid for the initalisations)
    #[account(address = pubkey!("2wy3g8KC8QQz92TyEhAxP63WZEdu4uRfnj58DRQmx2bn"))]
    /// CHECK: currently unchecked but constrained by account address
    pub askadev: UncheckedAccount<'info>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> ClaimFromVault<'info> {
    // we claim from the vault which means we: 
    // - check if the deadline has not yet passed
    // - transfer tokens to the receiver
    // - transfer rent out of vault bank
    pub fn process_claim(&mut self) -> Result<()> {

        // get the current time
        let current_time: u32 = Clock::get().unwrap().unix_timestamp as u32;
        // check if the vault deadline hasn't passed yet
        require!(current_time <= self.vault.deadline, TimeVaultErrors::ResponseTimeExceeded);

        // Check if the provided sender account matches the sender account stored in the vault
        require!(self.sender.key() == self.vault.sender, TimeVaultErrors::SendersDoNotMatch);
        // Check if the provided receiver account matches the receiver account stored in the vault
        require!(self.receiver.key() == self.vault.receiver, TimeVaultErrors::ReceiversDoNotMatch);

        // Generate the seeds needed to sign the transfer from the vault to the receiver
        let signer_seeds: [&[&[u8]];1] = [
            &[
                b"vault", 
                self.sender.to_account_info().key.as_ref(),
                self.receiver.to_account_info().key.as_ref(), 
                &self.vault.seed.to_le_bytes()[..],
                &[self.vault.bump]
            ]
        ];
    
        let cpi_accounts = token::Transfer {
          // vault_bank holds the tokens
          from: self.vault_bank.to_account_info(),
          to: self.receiver.to_account_info(),
          // vault is the authority of the vault_bank
          authority: self.vault.to_account_info()
        };
    
        let ctx = CpiContext::new_with_signer(
            self.token_program.to_account_info(), 
            cpi_accounts, 
            &signer_seeds
        );
    
        // perform the actual transfer
        token::transfer(ctx, self.vault.amount)

    }


    pub fn close_vault_bank(&mut self) -> Result<()> {

        // define the account used for the transfer
        let accts = system_program::Transfer {
            from: self.vault_bank.to_account_info(),
            to: self.askadev.to_account_info(),
        };

        // define the needed program for CPI (system program)
        let cpi_ctx = CpiContext::new(
            self.system_program.to_account_info(),
            accts
        );

        // get the amount of lamports we transfer out of the PDA to close it
        let rent = self.vault_bank.get_lamports();

        // perform the actual transfer
        system_program::transfer(cpi_ctx, rent)

    }
}

