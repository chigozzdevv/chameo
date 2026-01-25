/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/chameo_privacy.json`.
 */
export type ChameoPrivacy = {
  "address": "FsoGyYnvQDu5zXHmWHiyCxi7nWMr7RYxB1zGgz8ciJVM",
  "metadata": {
    "name": "chameoPrivacy",
    "version": "0.1.0",
    "spec": "0.1.0"
  },
  "instructions": [
    {
      "name": "castVoteZk",
      "discriminator": [
        59,
        246,
        59,
        53,
        12,
        138,
        98,
        36
      ],
      "accounts": [
        {
          "name": "nullifier",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  110,
                  117,
                  108,
                  108,
                  105,
                  102,
                  105,
                  101,
                  114
                ]
              },
              {
                "kind": "arg",
                "path": "campaignId"
              },
              {
                "kind": "arg",
                "path": "nullifierValue"
              }
            ]
          }
        },
        {
          "name": "votingPool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  111,
                  116,
                  105,
                  110,
                  103,
                  95,
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "arg",
                "path": "campaignId"
              }
            ]
          }
        },
        {
          "name": "relayer",
          "writable": true,
          "signer": true
        },
        {
          "name": "zkVerifierProgram"
        },
        {
          "name": "incoLightningProgram",
          "address": "5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "campaignId",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "nullifierValue",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "proof",
          "type": "bytes"
        },
        {
          "name": "publicWitness",
          "type": "bytes"
        },
        {
          "name": "encryptedVote",
          "type": "bytes"
        }
      ]
    },
    {
      "name": "closeVoting",
      "discriminator": [
        148,
        200,
        139,
        134,
        50,
        55,
        60,
        216
      ],
      "accounts": [
        {
          "name": "votingPool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  111,
                  116,
                  105,
                  110,
                  103,
                  95,
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "arg",
                "path": "campaignId"
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "allowedAddress"
        },
        {
          "name": "allowanceRefund",
          "writable": true
        },
        {
          "name": "allowanceEqual",
          "writable": true
        },
        {
          "name": "incoLightningProgram",
          "address": "5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "campaignId",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "allowedAddress",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "grantAnalyticsAccess",
      "discriminator": [
        221,
        74,
        154,
        8,
        237,
        191,
        197,
        20
      ],
      "accounts": [
        {
          "name": "analytics",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  110,
                  97,
                  108,
                  121,
                  116,
                  105,
                  99,
                  115
                ]
              },
              {
                "kind": "arg",
                "path": "campaignId"
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "allowedAddress"
        },
        {
          "name": "allowancePageViews",
          "writable": true
        },
        {
          "name": "allowanceLinkClicks",
          "writable": true
        },
        {
          "name": "allowanceClaimStarts",
          "writable": true
        },
        {
          "name": "allowanceClaimSuccesses",
          "writable": true
        },
        {
          "name": "allowanceClaimFailures",
          "writable": true
        },
        {
          "name": "allowanceVotes",
          "writable": true
        },
        {
          "name": "incoLightningProgram",
          "address": "5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "campaignId",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "allowedAddress",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "initializeAnalytics",
      "discriminator": [
        39,
        6,
        0,
        253,
        143,
        16,
        81,
        194
      ],
      "accounts": [
        {
          "name": "analytics",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  110,
                  97,
                  108,
                  121,
                  116,
                  105,
                  99,
                  115
                ]
              },
              {
                "kind": "arg",
                "path": "campaignId"
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "incoLightningProgram",
          "address": "5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "campaignId",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "initializeVotingPool",
      "discriminator": [
        217,
        10,
        124,
        68,
        53,
        226,
        187,
        34
      ],
      "accounts": [
        {
          "name": "votingPool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  111,
                  116,
                  105,
                  110,
                  103,
                  95,
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "arg",
                "path": "campaignId"
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "incoLightningProgram",
          "address": "5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "campaignId",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "eligibilityRoot",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "zkVerifierProgram",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "setEligibilityRoot",
      "discriminator": [
        19,
        109,
        114,
        36,
        207,
        203,
        137,
        33
      ],
      "accounts": [
        {
          "name": "votingPool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  111,
                  116,
                  105,
                  110,
                  103,
                  95,
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "arg",
                "path": "campaignId"
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "campaignId",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "eligibilityRoot",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "trackEvent",
      "discriminator": [
        26,
        103,
        232,
        218,
        109,
        33,
        227,
        164
      ],
      "accounts": [
        {
          "name": "analytics",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  110,
                  97,
                  108,
                  121,
                  116,
                  105,
                  99,
                  115
                ]
              },
              {
                "kind": "arg",
                "path": "campaignId"
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "incoLightningProgram",
          "address": "5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj"
        }
      ],
      "args": [
        {
          "name": "campaignId",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "encryptedIncrement",
          "type": "bytes"
        },
        {
          "name": "eventType",
          "type": "u8"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "analytics",
      "discriminator": [
        135,
        28,
        189,
        27,
        51,
        143,
        253,
        88
      ]
    },
    {
      "name": "nullifier",
      "discriminator": [
        18,
        56,
        142,
        165,
        181,
        158,
        187,
        133
      ]
    },
    {
      "name": "votingPool",
      "discriminator": [
        89,
        90,
        181,
        87,
        76,
        21,
        248,
        159
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "unauthorized",
      "msg": "unauthorized"
    },
    {
      "code": 6001,
      "name": "votingNotActive",
      "msg": "Voting not active"
    },
    {
      "code": 6002,
      "name": "invalidEventType",
      "msg": "Invalid event type"
    },
    {
      "code": 6003,
      "name": "invalidZkVerifier",
      "msg": "Invalid ZK verifier program"
    },
    {
      "code": 6004,
      "name": "invalidProofLength",
      "msg": "Invalid ZK proof length"
    },
    {
      "code": 6005,
      "name": "invalidPublicWitnessLength",
      "msg": "Invalid ZK public witness length"
    },
    {
      "code": 6006,
      "name": "invalidCiphertextLength",
      "msg": "Invalid ciphertext length"
    },
    {
      "code": 6007,
      "name": "merkleRootMismatch",
      "msg": "Merkle root mismatch"
    },
    {
      "code": 6008,
      "name": "nullifierMismatch",
      "msg": "Nullifier mismatch"
    },
    {
      "code": 6009,
      "name": "commitmentMismatch",
      "msg": "Commitment mismatch"
    },
    {
      "code": 6010,
      "name": "invalidAllowedAddress",
      "msg": "Invalid allowed address"
    },
    {
      "code": 6011,
      "name": "invalidPoseidonInput",
      "msg": "Invalid poseidon input"
    }
  ],
  "types": [
    {
      "name": "analytics",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "campaignId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "pageViews",
            "type": {
              "defined": {
                "name": "euint128"
              }
            }
          },
          {
            "name": "linkClicks",
            "type": {
              "defined": {
                "name": "euint128"
              }
            }
          },
          {
            "name": "claimStarts",
            "type": {
              "defined": {
                "name": "euint128"
              }
            }
          },
          {
            "name": "claimSuccesses",
            "type": {
              "defined": {
                "name": "euint128"
              }
            }
          },
          {
            "name": "claimFailures",
            "type": {
              "defined": {
                "name": "euint128"
              }
            }
          },
          {
            "name": "votes",
            "type": {
              "defined": {
                "name": "euint128"
              }
            }
          }
        ]
      }
    },
    {
      "name": "euint128",
      "type": {
        "kind": "struct",
        "fields": [
          "u128"
        ]
      }
    },
    {
      "name": "nullifier",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "campaignId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "value",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "votingPool",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "campaignId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "eligibilityRoot",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "zkVerifierProgram",
            "type": "pubkey"
          },
          {
            "name": "refundHostVotes",
            "type": {
              "defined": {
                "name": "euint128"
              }
            }
          },
          {
            "name": "equalDistributionVotes",
            "type": {
              "defined": {
                "name": "euint128"
              }
            }
          },
          {
            "name": "totalVotes",
            "type": "u64"
          },
          {
            "name": "isActive",
            "type": "bool"
          }
        ]
      }
    }
  ]
};
