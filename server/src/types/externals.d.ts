declare module "ffjavascript" {
  export const utils: {
    stringifyBigInts: (obj: any) => any;
    unstringifyBigInts: (obj: any) => any;
    leInt2Buff: (n: any, len: number) => Uint8Array;
  };
}

declare module "snarkjs" {
  export const groth16: {
    fullProve: (input: any, wasmFile: string, zkeyFile: string) => Promise<{ proof: any; publicSignals: string[] }>;
  };
}

declare module "@inco/solana-sdk/encryption" {
  export function encryptValue(value: bigint): Promise<string>;
}

declare module "@inco/solana-sdk/attested-decrypt" {
  export function decrypt(handles: string[], signer: any): Promise<{ plaintexts: string[] }>;
}
