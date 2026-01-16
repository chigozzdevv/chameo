use anchor_lang::prelude::*;
use inco_lightning::cpi::accounts::Operation;
use inco_lightning::cpi::{e_add, as_euint128};
use inco_lightning::types::Euint128;
use inco_lightning::ID as INCO_LIGHTNING_ID;

#[account]
pub struct CampaignAnalytics {
    pub campaign_id: [u8; 32],
    pub encrypted_views: Euint128,
    pub encrypted_claims: Euint128,
    pub encrypted_failures: Euint128,
    pub creator: Pubkey,
}

impl CampaignAnalytics {
    pub const LEN: usize = 32 + 16 + 16 + 16 + 32;
}

#[derive(Accounts)]
#[instruction(campaign_id: [u8; 32])]
pub struct TrackEvent<'info> {
    #[account(
        mut,
        seeds = [b"analytics", campaign_id.as_ref()],
        bump
    )]
    pub analytics: Account<'info, CampaignAnalytics>,
    pub authority: Signer<'info>,
    /// CHECK: Inco Lightning program
    #[account(address = INCO_LIGHTNING_ID)]
    pub inco_lightning_program: AccountInfo<'info>,
}

pub fn track_event<'info>(
    ctx: Context<'_, '_, '_, 'info, TrackEvent<'info>>,
    _campaign_id: [u8; 32],
    event_type: u8,
) -> Result<()> {
    let analytics = &mut ctx.accounts.analytics;
    let inco = ctx.accounts.inco_lightning_program.to_account_info();
    let signer = ctx.accounts.authority.to_account_info();
    
    let cpi_ctx = CpiContext::new(inco.clone(), Operation { signer: signer.clone() });
    let one = as_euint128(cpi_ctx, 1)?;
    
    match event_type {
        0 => {
            let cpi_ctx = CpiContext::new(inco, Operation { signer });
            analytics.encrypted_views = e_add(cpi_ctx, analytics.encrypted_views, one, 0)?;
        }
        1 => {
            let cpi_ctx = CpiContext::new(inco, Operation { signer });
            analytics.encrypted_claims = e_add(cpi_ctx, analytics.encrypted_claims, one, 0)?;
        }
        2 => {
            let cpi_ctx = CpiContext::new(inco, Operation { signer });
            analytics.encrypted_failures = e_add(cpi_ctx, analytics.encrypted_failures, one, 0)?;
        }
        _ => {}
    }
    
    Ok(())
}
