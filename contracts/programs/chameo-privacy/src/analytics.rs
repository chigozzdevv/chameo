use anchor_lang::prelude::*;
use inco_lightning::cpi::accounts::{Operation, Allow};
use inco_lightning::cpi::{new_euint128, as_euint128, e_add, allow};
use inco_lightning::types::Euint128;
use inco_lightning::ID as INCO_LIGHTNING_ID;
use crate::ErrorCode;

#[account]
pub struct Analytics {
    pub campaign_id: [u8; 32],
    pub authority: Pubkey,
    pub page_views: Euint128,
    pub link_clicks: Euint128,
    pub claim_starts: Euint128,
    pub claim_successes: Euint128,
    pub claim_failures: Euint128,
    pub votes: Euint128,
}

impl Analytics {
    pub const LEN: usize = 32 + 32 + 16 * 6;
}

#[derive(Accounts)]
#[instruction(campaign_id: [u8; 32])]
pub struct InitializeAnalytics<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Analytics::LEN,
        seeds = [b"analytics", campaign_id.as_ref()],
        bump
    )]
    pub analytics: Account<'info, Analytics>,
    #[account(mut)]
    pub authority: Signer<'info>,
    /// CHECK: Inco Lightning program
    #[account(address = INCO_LIGHTNING_ID)]
    pub inco_lightning_program: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(campaign_id: [u8; 32])]
pub struct TrackEvent<'info> {
    #[account(
        mut,
        seeds = [b"analytics", campaign_id.as_ref()],
        bump,
        constraint = analytics.authority == authority.key() @ ErrorCode::Unauthorized
    )]
    pub analytics: Account<'info, Analytics>,
    pub authority: Signer<'info>,
    /// CHECK: Inco Lightning program
    #[account(address = INCO_LIGHTNING_ID)]
    pub inco_lightning_program: AccountInfo<'info>,
}

#[derive(Accounts)]
#[instruction(campaign_id: [u8; 32])]
pub struct GrantAnalyticsAccess<'info> {
    #[account(
        mut,
        seeds = [b"analytics", campaign_id.as_ref()],
        bump,
        constraint = analytics.authority == authority.key() @ ErrorCode::Unauthorized
    )]
    pub analytics: Account<'info, Analytics>,
    #[account(mut)]
    pub authority: Signer<'info>,
    /// CHECK: Address to grant decrypt access to
    pub allowed_address: UncheckedAccount<'info>,
    /// CHECK: Allowance PDA for page_views
    #[account(mut)]
    pub allowance_page_views: AccountInfo<'info>,
    /// CHECK: Allowance PDA for link_clicks
    #[account(mut)]
    pub allowance_link_clicks: AccountInfo<'info>,
    /// CHECK: Allowance PDA for claim_starts
    #[account(mut)]
    pub allowance_claim_starts: AccountInfo<'info>,
    /// CHECK: Allowance PDA for claim_successes
    #[account(mut)]
    pub allowance_claim_successes: AccountInfo<'info>,
    /// CHECK: Allowance PDA for claim_failures
    #[account(mut)]
    pub allowance_claim_failures: AccountInfo<'info>,
    /// CHECK: Allowance PDA for votes
    #[account(mut)]
    pub allowance_votes: AccountInfo<'info>,
    /// CHECK: Inco Lightning program
    #[account(address = INCO_LIGHTNING_ID)]
    pub inco_lightning_program: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

pub fn initialize_analytics<'info>(
    ctx: Context<'_, '_, '_, 'info, InitializeAnalytics<'info>>,
    campaign_id: [u8; 32],
) -> Result<()> {
    let analytics = &mut ctx.accounts.analytics;
    let inco = ctx.accounts.inco_lightning_program.to_account_info();
    let signer = ctx.accounts.authority.to_account_info();
    
    analytics.campaign_id = campaign_id;
    analytics.authority = ctx.accounts.authority.key();
    
    let cpi_ctx = CpiContext::new(inco.clone(), Operation { signer: signer.clone() });
    analytics.page_views = as_euint128(cpi_ctx, 0)?;
    
    let cpi_ctx = CpiContext::new(inco.clone(), Operation { signer: signer.clone() });
    analytics.link_clicks = as_euint128(cpi_ctx, 0)?;
    
    let cpi_ctx = CpiContext::new(inco.clone(), Operation { signer: signer.clone() });
    analytics.claim_starts = as_euint128(cpi_ctx, 0)?;

    let cpi_ctx = CpiContext::new(inco.clone(), Operation { signer: signer.clone() });
    analytics.claim_successes = as_euint128(cpi_ctx, 0)?;

    let cpi_ctx = CpiContext::new(inco.clone(), Operation { signer: signer.clone() });
    analytics.claim_failures = as_euint128(cpi_ctx, 0)?;

    let cpi_ctx = CpiContext::new(inco, Operation { signer });
    analytics.votes = as_euint128(cpi_ctx, 0)?;
    
    Ok(())
}

pub fn track_event<'info>(
    ctx: Context<'_, '_, '_, 'info, TrackEvent<'info>>,
    _campaign_id: [u8; 32],
    encrypted_increment: Vec<u8>,
    event_type: u8,
) -> Result<()> {
    let analytics = &mut ctx.accounts.analytics;
    let inco = ctx.accounts.inco_lightning_program.to_account_info();
    let signer = ctx.accounts.authority.to_account_info();
    
    let cpi_ctx = CpiContext::new(inco.clone(), Operation { signer: signer.clone() });
    let increment = new_euint128(cpi_ctx, encrypted_increment, 0)?;
    
    match event_type {
        0 => {
            let cpi_ctx = CpiContext::new(inco, Operation { signer });
            analytics.page_views = e_add(cpi_ctx, analytics.page_views, increment, 0)?;
        }
        1 => {
            let cpi_ctx = CpiContext::new(inco, Operation { signer });
            analytics.link_clicks = e_add(cpi_ctx, analytics.link_clicks, increment, 0)?;
        }
        2 => {
            let cpi_ctx = CpiContext::new(inco, Operation { signer });
            analytics.claim_starts = e_add(cpi_ctx, analytics.claim_starts, increment, 0)?;
        }
        3 => {
            let cpi_ctx = CpiContext::new(inco, Operation { signer });
            analytics.claim_successes = e_add(cpi_ctx, analytics.claim_successes, increment, 0)?;
        }
        4 => {
            let cpi_ctx = CpiContext::new(inco, Operation { signer });
            analytics.claim_failures = e_add(cpi_ctx, analytics.claim_failures, increment, 0)?;
        }
        5 => {
            let cpi_ctx = CpiContext::new(inco, Operation { signer });
            analytics.votes = e_add(cpi_ctx, analytics.votes, increment, 0)?;
        }
        _ => return Err(ErrorCode::InvalidEventType.into()),
    }
    
    Ok(())
}

pub fn grant_analytics_access<'info>(
    ctx: Context<'_, '_, '_, 'info, GrantAnalyticsAccess<'info>>,
    _campaign_id: [u8; 32],
    allowed_address: Pubkey,
) -> Result<()> {
    let analytics = &ctx.accounts.analytics;
    let inco = ctx.accounts.inco_lightning_program.to_account_info();
    let signer = ctx.accounts.authority.to_account_info();

    let cpi_ctx = CpiContext::new(
        inco.clone(),
        Allow {
            allowance_account: ctx.accounts.allowance_page_views.to_account_info(),
            signer: signer.clone(),
            allowed_address: ctx.accounts.allowed_address.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
        },
    );
    allow(cpi_ctx, analytics.page_views.0, true, allowed_address)?;

    let cpi_ctx = CpiContext::new(
        inco.clone(),
        Allow {
            allowance_account: ctx.accounts.allowance_link_clicks.to_account_info(),
            signer: signer.clone(),
            allowed_address: ctx.accounts.allowed_address.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
        },
    );
    allow(cpi_ctx, analytics.link_clicks.0, true, allowed_address)?;

    let cpi_ctx = CpiContext::new(
        inco.clone(),
        Allow {
            allowance_account: ctx.accounts.allowance_claim_starts.to_account_info(),
            signer: signer.clone(),
            allowed_address: ctx.accounts.allowed_address.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
        },
    );
    allow(cpi_ctx, analytics.claim_starts.0, true, allowed_address)?;

    let cpi_ctx = CpiContext::new(
        inco.clone(),
        Allow {
            allowance_account: ctx.accounts.allowance_claim_successes.to_account_info(),
            signer: signer.clone(),
            allowed_address: ctx.accounts.allowed_address.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
        },
    );
    allow(cpi_ctx, analytics.claim_successes.0, true, allowed_address)?;

    let cpi_ctx = CpiContext::new(
        inco.clone(),
        Allow {
            allowance_account: ctx.accounts.allowance_claim_failures.to_account_info(),
            signer: signer.clone(),
            allowed_address: ctx.accounts.allowed_address.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
        },
    );
    allow(cpi_ctx, analytics.claim_failures.0, true, allowed_address)?;

    let cpi_ctx = CpiContext::new(
        inco,
        Allow {
            allowance_account: ctx.accounts.allowance_votes.to_account_info(),
            signer,
            allowed_address: ctx.accounts.allowed_address.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
        },
    );
    allow(cpi_ctx, analytics.votes.0, true, allowed_address)?;

    Ok(())
}
