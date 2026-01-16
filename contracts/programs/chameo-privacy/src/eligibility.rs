use anchor_lang::prelude::*;
use inco_lightning::cpi::accounts::{Operation, Allow};
use inco_lightning::cpi::{new_euint128, allow};
use inco_lightning::types::Euint128;
use inco_lightning::ID as INCO_LIGHTNING_ID;
use crate::ErrorCode;

#[account]
pub struct EligibilityProof {
    pub campaign_id: [u8; 32],
    pub user: Pubkey,
    pub encrypted_proof: Euint128,
    pub verified: bool,
}

impl EligibilityProof {
    pub const LEN: usize = 32 + 32 + 16 + 1;
}

#[derive(Accounts)]
#[instruction(campaign_id: [u8; 32])]
pub struct RegisterEligibility<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + EligibilityProof::LEN,
        seeds = [b"eligibility", campaign_id.as_ref(), user.key().as_ref()],
        bump
    )]
    pub proof: Account<'info, EligibilityProof>,
    #[account(mut)]
    pub user: Signer<'info>,
    /// CHECK: Inco Lightning program
    #[account(address = INCO_LIGHTNING_ID)]
    pub inco_lightning_program: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(campaign_id: [u8; 32])]
pub struct VerifyEligibility<'info> {
    #[account(
        mut,
        seeds = [b"eligibility", campaign_id.as_ref(), user.key().as_ref()],
        bump
    )]
    pub proof: Account<'info, EligibilityProof>,
    pub user: Signer<'info>,
    /// CHECK: Inco Lightning program
    #[account(address = INCO_LIGHTNING_ID)]
    pub inco_lightning_program: AccountInfo<'info>,
}

pub fn register_eligibility<'info>(
    ctx: Context<'_, '_, '_, 'info, RegisterEligibility<'info>>,
    campaign_id: [u8; 32],
    encrypted_proof: Vec<u8>,
) -> Result<()> {
    let proof = &mut ctx.accounts.proof;
    
    let cpi_ctx = CpiContext::new(
        ctx.accounts.inco_lightning_program.to_account_info(),
        Operation {
            signer: ctx.accounts.user.to_account_info(),
        },
    );
    
    let encrypted_handle = new_euint128(cpi_ctx, encrypted_proof, 0)?;
    
    proof.campaign_id = campaign_id;
    proof.user = ctx.accounts.user.key();
    proof.encrypted_proof = encrypted_handle;
    proof.verified = false;
    
    if ctx.remaining_accounts.len() >= 2 {
        let allowance_account = &ctx.remaining_accounts[0];
        let allowed_address = &ctx.remaining_accounts[1];
        
        let cpi_ctx = CpiContext::new(
            ctx.accounts.inco_lightning_program.to_account_info(),
            Allow {
                allowance_account: allowance_account.clone(),
                signer: ctx.accounts.user.to_account_info(),
                allowed_address: allowed_address.clone(),
                system_program: ctx.accounts.system_program.to_account_info(),
            },
        );
        
        allow(cpi_ctx, encrypted_handle.0, true, ctx.accounts.user.key())?;
    }
    
    Ok(())
}

pub fn verify_eligibility<'info>(
    ctx: Context<'_, '_, '_, 'info, VerifyEligibility<'info>>,
    _campaign_id: [u8; 32],
) -> Result<()> {
    let proof = &mut ctx.accounts.proof;
    proof.verified = true;
    Ok(())
}
