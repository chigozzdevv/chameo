use anchor_lang::prelude::*;
use inco_lightning::cpi::accounts::{Operation, Allow};
use inco_lightning::cpi::{new_euint128, allow};
use inco_lightning::types::Euint128;
use inco_lightning::ID as INCO_LIGHTNING_ID;
use crate::ErrorCode;

#[account]
pub struct ClaimRecord {
    pub campaign_id: [u8; 32],
    pub claimer: Pubkey,
    pub encrypted_amount: Euint128,
    pub timestamp: i64,
}

impl ClaimRecord {
    pub const LEN: usize = 32 + 32 + 16 + 8;
}

#[derive(Accounts)]
#[instruction(campaign_id: [u8; 32])]
pub struct RecordClaim<'info> {
    #[account(
        init,
        payer = claimer,
        space = 8 + ClaimRecord::LEN,
        seeds = [b"claim", campaign_id.as_ref(), claimer.key().as_ref()],
        bump
    )]
    pub claim_record: Account<'info, ClaimRecord>,
    #[account(mut)]
    pub claimer: Signer<'info>,
    /// CHECK: Inco Lightning program
    #[account(address = INCO_LIGHTNING_ID)]
    pub inco_lightning_program: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

pub fn record_claim<'info>(
    ctx: Context<'_, '_, '_, 'info, RecordClaim<'info>>,
    campaign_id: [u8; 32],
    encrypted_amount: Vec<u8>,
) -> Result<()> {
    let claim_record = &mut ctx.accounts.claim_record;
    
    let cpi_ctx = CpiContext::new(
        ctx.accounts.inco_lightning_program.to_account_info(),
        Operation {
            signer: ctx.accounts.claimer.to_account_info(),
        },
    );
    
    let encrypted_handle = new_euint128(cpi_ctx, encrypted_amount, 0)?;
    
    claim_record.campaign_id = campaign_id;
    claim_record.claimer = ctx.accounts.claimer.key();
    claim_record.encrypted_amount = encrypted_handle;
    claim_record.timestamp = Clock::get()?.unix_timestamp;
    
    if ctx.remaining_accounts.len() >= 2 {
        let allowance_account = &ctx.remaining_accounts[0];
        let allowed_address = &ctx.remaining_accounts[1];
        
        let cpi_ctx = CpiContext::new(
            ctx.accounts.inco_lightning_program.to_account_info(),
            Allow {
                allowance_account: allowance_account.clone(),
                signer: ctx.accounts.claimer.to_account_info(),
                allowed_address: allowed_address.clone(),
                system_program: ctx.accounts.system_program.to_account_info(),
            },
        );
        
        allow(cpi_ctx, encrypted_handle.0, true, ctx.accounts.claimer.key())?;
    }
    
    Ok(())
}
