use anchor_lang::prelude::*;

pub mod eligibility;
pub mod voting;
pub mod claims;
pub mod analytics;

pub use eligibility::*;
pub use voting::*;
pub use claims::*;
pub use analytics::*;

declare_id!("ChameoPrivacyProgramID11111111111111111111");

#[program]
pub mod chameo_privacy {
    use super::*;

    pub fn register_eligibility<'info>(
        ctx: Context<'_, '_, '_, 'info, RegisterEligibility<'info>>,
        campaign_id: [u8; 32],
        encrypted_proof: Vec<u8>,
    ) -> Result<()> {
        eligibility::register_eligibility(ctx, campaign_id, encrypted_proof)
    }

    pub fn verify_eligibility<'info>(
        ctx: Context<'_, '_, '_, 'info, VerifyEligibility<'info>>,
        campaign_id: [u8; 32],
    ) -> Result<()> {
        eligibility::verify_eligibility(ctx, campaign_id)
    }

    pub fn cast_vote<'info>(
        ctx: Context<'_, '_, '_, 'info, CastVote<'info>>,
        campaign_id: [u8; 32],
        encrypted_vote: Vec<u8>,
    ) -> Result<()> {
        voting::cast_vote(ctx, campaign_id, encrypted_vote)
    }

    pub fn tally_votes<'info>(
        ctx: Context<'_, '_, '_, 'info, TallyVotes<'info>>,
        campaign_id: [u8; 32],
    ) -> Result<()> {
        voting::tally_votes(ctx, campaign_id)
    }

    pub fn record_claim<'info>(
        ctx: Context<'_, '_, '_, 'info, RecordClaim<'info>>,
        campaign_id: [u8; 32],
        encrypted_amount: Vec<u8>,
    ) -> Result<()> {
        claims::record_claim(ctx, campaign_id, encrypted_amount)
    }

    pub fn track_event<'info>(
        ctx: Context<'_, '_, '_, 'info, TrackEvent<'info>>,
        campaign_id: [u8; 32],
        event_type: u8,
    ) -> Result<()> {
        analytics::track_event(ctx, campaign_id, event_type)
    }
}

#[error_code]
pub enum ErrorCode {
    #[msg("Campaign not found")]
    CampaignNotFound,
    #[msg("Not eligible")]
    NotEligible,
    #[msg("Already voted")]
    AlreadyVoted,
    #[msg("Already claimed")]
    AlreadyClaimed,
    #[msg("Invalid vote option")]
    InvalidVoteOption,
    #[msg("Voting not active")]
    VotingNotActive,
}
