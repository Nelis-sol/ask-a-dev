use anchor_lang::prelude::*;

#[account]
pub struct Vault {
    pub sender: Pubkey, // 32 bytes
    pub receiver: Pubkey,   // 32 bytes
    pub mint: Pubkey, // 32 bytes
    pub seed: u64, // 8 bytes
    pub amount: u64, // 8 bytes
    pub deadline: u32,   // 4 bytes
    pub bump: u8,   // 1 byte
}

impl Space for Vault {
    const INIT_SPACE: usize = 8
        + 32
        + 32
        + 32
        + 8
        + 8
        + 4
        + 1;
}



