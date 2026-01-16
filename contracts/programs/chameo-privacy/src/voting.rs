use anchor_lang::prelude::*;
use inco_lightning::cpi::accounts::{Operation, Allow};
use inco_lightning::cpi::{new_euint128, e_add, allow};
use inco_lightning::types::Euint128;
use inco_lightning::ID as INCO_LIGHTNING_ID;
use crate::ErrorCode;

#[account]
pub struct VotingPool {
    pub campaign_id: [u8; 32],
    pub refund_host_votes: Euint128,
    pub equal_distribution_votes: Euint128,
    pub total_votes: u64,
    pub is_active: bool,
}

impl VotingPool {
    pub const LEN: usize = 32 + 16 + 16 + 8 + 1;
}

#[account]
pub struct Vote {
    pub campaign_id: [u8; 32],
    pub voter: Pubkey,
    pub encrypted_choice: Euint128,
    pub timestamp: i64,
}

impl Vote {
    pub const LEN: usize = 32 + 32 + 16 + 8;
}

#[derive(Accounts)]
#[instruction(campaign_id: [u8; 32])]
pub struct CastVote<'info> {
    #[account(
        init,
        payer = voter,
        space = 8 + Vote::LEN,
        seeds = [b"vote", campaign_id.as_ref(), voter.key().as_ref()],
        bump
    )]
    pub vote: Account<'info, Vote>,
    #[account(
        mut,
        seeds = [b"voting_pool", campaign_id.as_ref()],
        bump
    )]
    pub voting_pool: Account<'info, VotingPool>,
    #[account(mut)]
    pub voter: Signer<'info>,
    /// CHECK: Inco Lightning program
    #[account(address = INCO_LIGHTNING_ID)]
    pub inco_lightning_program: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(campaign_id: [u8; 32])]
pub struct TallyVotes<'info> {
    #[account(
        mut,
        seeds = [b"voting_pool", campaign_id.as_ref()],
        bump
    )]
    pub voting_pool: Account<'info, VotingPool>,
    pub authority: Signer<'info>,
    /// CHECK: Inco Lightning program
    #[account(address = INCO_LIGHTNING_ID)]
    pub inco_lightning_program: AccountInfo<'info>,
}

pub fn cast_vote<'info>(
    ctx: Context<'_, '_, '_, 'info, CastVote<'info>>,
    campaign_id: [u8; 32],
    encrypted_vote: Vec<u8>,
) -> Result<()> {
    let voting_pool = &mut ctx.accounts.voting_pool;
    require!(voting_pool.is_active, ErrorCode::VotingNotActive);
    
    let vote = &mut ctx.accounts.vote;
    
    let cpi_ctx = CpiContext::new(
        ctx.accounts.inco_lightning_program.to_account_info(),
        Operation {
            signer: ctx.accounts.voter.to_account_info(),
        },
    );
    
    let encrypted_choice = new_euint128(cpi_ctx, encrypted_vote, 0)?;
    
    vote.campaign_id = campaign_id;
    vote.voter = ctx.accounts.voter.key();
    vote.encrypted_choice = encrypted_choice;
    vote.timestamp = Clock::get()?.unix_timestamp;
    
    voting_pool.total_votes += 1;
    
    if ctx.remaining_accounts.len() >= 2 {
        let allowance_account = &ctx.remaining_accounts[0];
        let allowed_address = &ctx.remaining_accounts[1];
        
        let cpi_ctx = CpiContext::new(
            ctx.accounts.inco_lightning_program.to_account_info(),
            Allow {
                allowance_account: allowance_account.clone(),
                signer: ctx.accounts.voter.to_account_info(),
                allowed_address: allowed_address.clone(),
                system_program: ctx.accounts.system_program.to_account_info(),
            },
        );
        
        allow(cpi_ctx, encrypted_choice.0, true, ctx.accounts.voter.key())?;
    }
    
    Ok(())
}

pub fn tally_votes<'info>(
    ctx: Context<'_, '_, '_, 'info, TallyVotes<'info>>,
    _campaign_id: [u8; 32],
) -> Result<()> {
    let voting_pool = &mut ctx.accounts.voting_pool;
    voting_pool.is_active = false;
    Ok(())
}
