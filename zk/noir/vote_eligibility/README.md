# Vote eligibility circuit

This circuit proves:
- the voter leaf is in the Merkle root
- the nullifier is derived from a secret
- the ciphertext commitment matches the encrypted vote

Public inputs (in order):
1) merkle_root
2) nullifier
3) commitment

Assumptions:
- identityHash = sha256(...) from `server/src/shared/crypto.ts`
- leaf = poseidon(identityHash[0..16], identityHash[16..32])
- vote ciphertext is from `encryptValue(0|1)` and is 114 bytes
- commitment = poseidon(ciphertext chunked into 16-byte field elements)

## Build + prove

1) Install nargo and sunspot.
2) Fill `Prover.toml` with inputs.
3) Run:

```
cd zk/noir/vote_eligibility
export GNARK_VERIFIER_BIN="$HOME/.local/share/sunspot/gnark-solana/crates/verifier-bin"
nargo compile
nargo execute
sunspot compile target/vote_eligibility.json
sunspot setup target/vote_eligibility.ccs
sunspot prove target/vote_eligibility.json target/vote_eligibility.gz target/vote_eligibility.ccs target/vote_eligibility.pk
sunspot deploy target/vote_eligibility.vk
```

Use `target/vote_eligibility.proof` and `target/vote_eligibility.pw` for the relayer endpoint.
The verifier program outputs to `target/vote_eligibility.so` with keypair `target/vote_eligibility-keypair.json`.
