#![allow(unexpected_cfgs)]
#![allow(clippy::result_large_err)]

use anchor_lang::prelude::*;

pub mod voting;
pub mod analytics;

pub use voting::*;
pub use analytics::*;

declare_id!("FsoGyYnvQDu5zXHmWHiyCxi7nWMr7RYxB1zGgz8ciJVM");

#[program]
pub mod chameo_privacy {
    use super::*;

    pub fn initialize_voting_pool<'info>(
        ctx: Context<'_, '_, '_, 'info, InitializeVotingPool<'info>>,
        campaign_id: [u8; 32],
        eligibility_root: [u8; 32],
        zk_verifier_program: Pubkey,
    ) -> Result<()> {
        voting::initialize_voting_pool(ctx, campaign_id, eligibility_root, zk_verifier_program)
    }

    pub fn cast_vote_zk<'info>(
        ctx: Context<'_, '_, '_, 'info, CastVoteZk<'info>>,
        campaign_id: [u8; 32],
        nullifier_value: [u8; 32],
        proof: Vec<u8>,
        public_witness: Vec<u8>,
        encrypted_vote: Vec<u8>,
    ) -> Result<()> {
        voting::cast_vote_zk(ctx, campaign_id, nullifier_value, proof, public_witness, encrypted_vote)
    }

    pub fn close_voting<'info>(
        ctx: Context<'_, '_, '_, 'info, CloseVoting<'info>>,
        campaign_id: [u8; 32],
        allowed_address: Pubkey,
    ) -> Result<()> {
        voting::close_voting(ctx, campaign_id, allowed_address)
    }

    pub fn set_eligibility_root<'info>(
        ctx: Context<'_, '_, '_, 'info, SetEligibilityRoot<'info>>,
        campaign_id: [u8; 32],
        eligibility_root: [u8; 32],
    ) -> Result<()> {
        voting::set_eligibility_root(ctx, campaign_id, eligibility_root)
    }

    pub fn initialize_analytics<'info>(
        ctx: Context<'_, '_, '_, 'info, InitializeAnalytics<'info>>,
        campaign_id: [u8; 32],
    ) -> Result<()> {
        analytics::initialize_analytics(ctx, campaign_id)
    }

    pub fn track_event<'info>(
        ctx: Context<'_, '_, '_, 'info, TrackEvent<'info>>,
        campaign_id: [u8; 32],
        encrypted_increment: Vec<u8>,
        event_type: u8,
    ) -> Result<()> {
        analytics::track_event(ctx, campaign_id, encrypted_increment, event_type)
    }

    pub fn grant_analytics_access<'info>(
        ctx: Context<'_, '_, '_, 'info, GrantAnalyticsAccess<'info>>,
        campaign_id: [u8; 32],
        allowed_address: Pubkey,
    ) -> Result<()> {
        analytics::grant_analytics_access(ctx, campaign_id, allowed_address)
    }
}

#[error_code]
pub enum ErrorCode {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Voting not active")]
    VotingNotActive,
    #[msg("Invalid event type")]
    InvalidEventType,
    #[msg("Invalid ZK verifier program")]
    InvalidZkVerifier,
    #[msg("Invalid ZK proof length")]
    InvalidProofLength,
    #[msg("Invalid ZK public witness length")]
    InvalidPublicWitnessLength,
    #[msg("Invalid ciphertext length")]
    InvalidCiphertextLength,
    #[msg("Merkle root mismatch")]
    MerkleRootMismatch,
    #[msg("Nullifier mismatch")]
    NullifierMismatch,
    #[msg("Commitment mismatch")]
    CommitmentMismatch,
    #[msg("Invalid allowed address")]
    InvalidAllowedAddress,
    #[msg("Invalid poseidon input")]
    InvalidPoseidonInput,
}
