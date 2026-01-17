use dep::poseidon::poseidon;

global MERKLE_DEPTH: u32 = 16;
global CIPHERTEXT_LEN: u32 = 114;
global SECRET_LEN: u32 = 32;
global CHUNK_SIZE: u32 = 16;
global LEAF_FIELDS: u32 = 2;
global SECRET_FIELDS: u32 = 2;
global CIPHERTEXT_FIELDS: u32 = 8;

type Hash = [u8; 32];

type Siblings = [Hash; MERKLE_DEPTH];
type PathBits = [u1; MERKLE_DEPTH];

type Ciphertext = [u8; CIPHERTEXT_LEN];
type Secret = [u8; SECRET_LEN];

fn hash_pair(left: Field, right: Field) -> Field {
    poseidon::bn254::hash_2([left, right])
}

fn bytes32_to_field(bytes: Hash) -> Field {
    Field::from_be_bytes::<32>(bytes)
}

fn pack_bytes_16<let N: u32, let OUT: u32>(bytes: [u8; N]) -> [Field; OUT] {
    let mut out: [Field; OUT] = [0; OUT];
    for i in 0..OUT {
        let mut acc: Field = 0;
        for j in 0..CHUNK_SIZE {
            let idx = i * CHUNK_SIZE + j;
            let byte = if idx < N { bytes[idx] } else { 0 };
            acc = acc * 256 + byte as Field;
        }
        out[i] = acc;
    }
    out
}

fn main(
    leaf: Hash,
    siblings: Siblings,
    path_bits: PathBits,
    secret: Secret,
    ciphertext: Ciphertext,
    merkle_root: pub Field,
    nullifier: pub Field,
    commitment: pub Field,
) {
    let leaf_fields = pack_bytes_16::<32, LEAF_FIELDS>(leaf);
    let mut current = poseidon::bn254::hash_2(leaf_fields);
    for i in 0..MERKLE_DEPTH {
        let sibling = bytes32_to_field(siblings[i]);
        let bit = path_bits[i];
        let left = if bit == 0 { current } else { sibling };
        let right = if bit == 0 { sibling } else { current };
        current = hash_pair(left, right);
    }

    assert(current == merkle_root);

    let secret_fields = pack_bytes_16::<SECRET_LEN, SECRET_FIELDS>(secret);
    let nullifier_field = poseidon::bn254::hash_2(secret_fields);
    assert(nullifier_field == nullifier);

    let ciphertext_fields = pack_bytes_16::<CIPHERTEXT_LEN, CIPHERTEXT_FIELDS>(ciphertext);
    let commitment_field = poseidon::bn254::hash_8(ciphertext_fields);
    assert(commitment_field == commitment);
}
