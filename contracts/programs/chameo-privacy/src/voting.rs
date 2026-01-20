use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::Instruction;
use anchor_lang::solana_program::program::invoke;
use solana_poseidon::{hashv as poseidon_hashv, Endianness, Parameters};
use inco_lightning::cpi::accounts::{Operation, Allow};
use inco_lightning::cpi::{new_euint128, as_euint128, e_add, e_eq, e_select, allow};
use inco_lightning::types::Euint128;
use inco_lightning::ID as INCO_LIGHTNING_ID;
use crate::ErrorCode;

const ZK_PROOF_LEN: usize = 388;
const ZK_PUBLIC_WITNESS_LEN: usize = 12 + 32 + 32 + 32;
const CIPHERTEXT_LEN: usize = 114;
const POSEIDON_CHUNK_LEN: usize = 16;

#[account]
pub struct VotingPool {
    pub campaign_id: [u8; 32],
    pub authority: Pubkey,
    pub eligibility_root: [u8; 32],
    pub zk_verifier_program: Pubkey,
    pub refund_host_votes: Euint128,
    pub equal_distribution_votes: Euint128,
    pub total_votes: u64,
    pub is_active: bool,
}

impl VotingPool {
    pub const LEN: usize = 32 + 32 + 32 + 32 + 16 + 16 + 8 + 1;
}

#[account]
pub struct Nullifier {
    pub campaign_id: [u8; 32],
    pub value: [u8; 32],
}

impl Nullifier {
    pub const LEN: usize = 32 + 32;
}

#[derive(Accounts)]
#[instruction(campaign_id: [u8; 32])]
pub struct InitializeVotingPool<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + VotingPool::LEN,
        seeds = [b"voting_pool", campaign_id.as_ref()],
        bump
    )]
    pub voting_pool: Account<'info, VotingPool>,
    #[account(mut)]
    pub authority: Signer<'info>,
    /// CHECK: Inco Lightning program
    #[account(address = INCO_LIGHTNING_ID)]
    pub inco_lightning_program: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(campaign_id: [u8; 32], nullifier_value: [u8; 32])]
pub struct CastVoteZk<'info> {
    #[account(
        init,
        payer = relayer,
        space = 8 + Nullifier::LEN,
        seeds = [b"nullifier", campaign_id.as_ref(), nullifier_value.as_ref()],
        bump
    )]
    pub nullifier: Account<'info, Nullifier>,
    #[account(
        mut,
        seeds = [b"voting_pool", campaign_id.as_ref()],
        bump
    )]
    pub voting_pool: Account<'info, VotingPool>,
    #[account(mut)]
    pub relayer: Signer<'info>,
    /// CHECK: ZK verifier program
    pub zk_verifier_program: AccountInfo<'info>,
    /// CHECK: Inco Lightning program
    #[account(address = INCO_LIGHTNING_ID)]
    pub inco_lightning_program: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(campaign_id: [u8; 32])]
pub struct CloseVoting<'info> {
    #[account(
        mut,
        seeds = [b"voting_pool", campaign_id.as_ref()],
        bump,
        constraint = voting_pool.authority == authority.key() @ ErrorCode::Unauthorized
    )]
    pub voting_pool: Account<'info, VotingPool>,
    #[account(mut)]
    pub authority: Signer<'info>,
    /// CHECK: Address granted decryption access
    pub allowed_address: UncheckedAccount<'info>,
    /// CHECK: Allowance account for refund votes
    #[account(mut)]
    pub allowance_refund: AccountInfo<'info>,
    /// CHECK: Allowance account for equal dist votes
    #[account(mut)]
    pub allowance_equal: AccountInfo<'info>,
    /// CHECK: Inco Lightning program
    #[account(address = INCO_LIGHTNING_ID)]
    pub inco_lightning_program: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(campaign_id: [u8; 32])]
pub struct SetEligibilityRoot<'info> {
    #[account(
        mut,
        seeds = [b"voting_pool", campaign_id.as_ref()],
        bump,
        constraint = voting_pool.authority == authority.key() @ ErrorCode::Unauthorized
    )]
    pub voting_pool: Account<'info, VotingPool>,
    pub authority: Signer<'info>,
}

pub fn initialize_voting_pool<'info>(
    ctx: Context<'_, '_, '_, 'info, InitializeVotingPool<'info>>,
    campaign_id: [u8; 32],
    eligibility_root: [u8; 32],
    zk_verifier_program: Pubkey,
) -> Result<()> {
    let pool = &mut ctx.accounts.voting_pool;
    let inco = ctx.accounts.inco_lightning_program.to_account_info();
    let signer = ctx.accounts.authority.to_account_info();
    
    pool.campaign_id = campaign_id;
    pool.authority = ctx.accounts.authority.key();
    pool.eligibility_root = eligibility_root;
    pool.zk_verifier_program = zk_verifier_program;
    pool.total_votes = 0;
    pool.is_active = true;
    
    let cpi_ctx = CpiContext::new(inco.clone(), Operation { signer: signer.clone() });
    pool.refund_host_votes = as_euint128(cpi_ctx, 0)?;
    
    let cpi_ctx = CpiContext::new(inco, Operation { signer });
    pool.equal_distribution_votes = as_euint128(cpi_ctx, 0)?;
    
    Ok(())
}

pub fn set_eligibility_root<'info>(
    ctx: Context<'_, '_, '_, 'info, SetEligibilityRoot<'info>>,
    _campaign_id: [u8; 32],
    eligibility_root: [u8; 32],
) -> Result<()> {
    let voting_pool = &mut ctx.accounts.voting_pool;
    voting_pool.eligibility_root = eligibility_root;
    Ok(())
}

pub fn cast_vote_zk<'info>(
    ctx: Context<'_, '_, '_, 'info, CastVoteZk<'info>>,
    campaign_id: [u8; 32],
    nullifier_value: [u8; 32],
    proof: Vec<u8>,
    public_witness: Vec<u8>,
    encrypted_vote: Vec<u8>,
) -> Result<()> {
    let voting_pool = &mut ctx.accounts.voting_pool;
    require!(voting_pool.is_active, ErrorCode::VotingNotActive);
    require!(
        ctx.accounts.zk_verifier_program.key() == voting_pool.zk_verifier_program,
        ErrorCode::InvalidZkVerifier
    );
    require!(proof.len() == ZK_PROOF_LEN, ErrorCode::InvalidProofLength);
    require!(
        public_witness.len() == ZK_PUBLIC_WITNESS_LEN,
        ErrorCode::InvalidPublicWitnessLength
    );
    require!(
        encrypted_vote.len() == CIPHERTEXT_LEN,
        ErrorCode::InvalidCiphertextLength
    );

    let witness_root = &public_witness[12..44];
    let witness_nullifier = &public_witness[44..76];
    let witness_commitment = &public_witness[76..108];

    require!(
        witness_root == voting_pool.eligibility_root.as_ref(),
        ErrorCode::MerkleRootMismatch
    );
    require!(
        witness_nullifier == nullifier_value.as_ref(),
        ErrorCode::NullifierMismatch
    );

    let commitment_bytes = poseidon_hash_bytes(&encrypted_vote)?;
    require!(
        commitment_bytes.as_ref() == witness_commitment,
        ErrorCode::CommitmentMismatch
    );

    let mut verifier_data = Vec::with_capacity(proof.len() + public_witness.len());
    verifier_data.extend_from_slice(&proof);
    verifier_data.extend_from_slice(&public_witness);

    let verify_ix = Instruction {
        program_id: ctx.accounts.zk_verifier_program.key(),
        accounts: vec![],
        data: verifier_data,
    };
    invoke(&verify_ix, &[])?;

    let nullifier_account = &mut ctx.accounts.nullifier;
    nullifier_account.campaign_id = campaign_id;
    nullifier_account.value = nullifier_value;

    let inco = ctx.accounts.inco_lightning_program.to_account_info();
    let signer = ctx.accounts.relayer.to_account_info();

    let cpi_ctx = CpiContext::new(inco.clone(), Operation { signer: signer.clone() });
    let encrypted_choice = new_euint128(cpi_ctx, encrypted_vote, 0)?;

    let cpi_ctx = CpiContext::new(inco.clone(), Operation { signer: signer.clone() });
    let one = as_euint128(cpi_ctx, 1)?;

    let cpi_ctx = CpiContext::new(inco.clone(), Operation { signer: signer.clone() });
    let zero = as_euint128(cpi_ctx, 0)?;

    let cpi_ctx = CpiContext::new(inco.clone(), Operation { signer: signer.clone() });
    let is_equal_dist = e_eq(cpi_ctx, encrypted_choice, one, 0)?;

    let cpi_ctx = CpiContext::new(inco.clone(), Operation { signer: signer.clone() });
    let add_to_equal = e_select(cpi_ctx, is_equal_dist, one, zero, 0)?;

    let cpi_ctx = CpiContext::new(inco.clone(), Operation { signer: signer.clone() });
    voting_pool.equal_distribution_votes = e_add(cpi_ctx, voting_pool.equal_distribution_votes, add_to_equal, 0)?;

    let cpi_ctx = CpiContext::new(inco.clone(), Operation { signer: signer.clone() });
    let add_to_refund = e_select(cpi_ctx, is_equal_dist, zero, one, 0)?;

    let cpi_ctx = CpiContext::new(inco, Operation { signer });
    voting_pool.refund_host_votes = e_add(cpi_ctx, voting_pool.refund_host_votes, add_to_refund, 0)?;

    voting_pool.total_votes += 1;

    Ok(())
}

fn poseidon_hash_bytes(bytes: &[u8]) -> Result<[u8; 32]> {
    let chunks = (bytes.len() + POSEIDON_CHUNK_LEN - 1) / POSEIDON_CHUNK_LEN;
    let mut fields: Vec<[u8; 32]> = Vec::with_capacity(chunks);

    for i in 0..chunks {
        // Chunk into 16-byte limbs and left-pad to 32-byte field elements for Poseidon.
        let start = i * POSEIDON_CHUNK_LEN;
        let end = core::cmp::min(start + POSEIDON_CHUNK_LEN, bytes.len());
        let mut chunk = [0u8; POSEIDON_CHUNK_LEN];
        chunk[..end - start].copy_from_slice(&bytes[start..end]);
        let mut field = [0u8; 32];
        field[32 - POSEIDON_CHUNK_LEN..].copy_from_slice(&chunk);
        fields.push(field);
    }

    let mut refs: Vec<&[u8]> = Vec::with_capacity(fields.len());
    for field in &fields {
        refs.push(field.as_ref());
    }

    let hash = poseidon_hashv(Parameters::Bn254X5, Endianness::BigEndian, &refs)
        .map_err(|_| ErrorCode::InvalidPoseidonInput)?;
    Ok(hash.to_bytes())
}

pub fn close_voting<'info>(
    ctx: Context<'_, '_, '_, 'info, CloseVoting<'info>>,
    _campaign_id: [u8; 32],
    allowed_address: Pubkey,
) -> Result<()> {
    let voting_pool = &mut ctx.accounts.voting_pool;
    require!(voting_pool.is_active, ErrorCode::VotingNotActive);
    voting_pool.is_active = false;
    require!(
        allowed_address == ctx.accounts.allowed_address.key(),
        ErrorCode::InvalidAllowedAddress
    );
    
    let inco = ctx.accounts.inco_lightning_program.to_account_info();
    let signer = ctx.accounts.authority.to_account_info();
    let allowed_key = ctx.accounts.allowed_address.key();
    
    let cpi_ctx = CpiContext::new(
        inco.clone(),
        Allow {
            allowance_account: ctx.accounts.allowance_refund.to_account_info(),
            signer: signer.clone(),
            allowed_address: ctx.accounts.allowed_address.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
        },
    );
    allow(cpi_ctx, voting_pool.refund_host_votes.0, true, allowed_key)?;
    
    let cpi_ctx = CpiContext::new(
        inco,
        Allow {
            allowance_account: ctx.accounts.allowance_equal.to_account_info(),
            signer,
            allowed_address: ctx.accounts.allowed_address.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
        },
    );
    allow(cpi_ctx, voting_pool.equal_distribution_votes.0, true, allowed_key)?;
    
    Ok(())
}
