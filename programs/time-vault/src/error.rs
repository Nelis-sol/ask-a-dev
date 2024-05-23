use anchor_lang::prelude::*;

#[error_code]
pub enum TimeVaultErrors {
    #[msg("Time to respond has not yet been exceeded - deadline has not yet been passed")]
    ResponseTimeNotExceeded,
    #[msg("Time to respond has been exceeded - deadline has passed")]
    ResponseTimeExceeded,
    #[msg("Senders don't match")]
    SendersDoNotMatch,
    #[msg("Receivers don't match")]
    ReceiversDoNotMatch,
}