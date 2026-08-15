import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}




export type DataKey = {tag: "State", values: void} | {tag: "Config", values: void} | {tag: "AmountLocked", values: void};

export enum EscrowState {
  Init = 0,
  Deposited = 1,
  Released = 2,
  Refunded = 3,
}


export interface EscrowConfig {
  arbiter: string;
  depositor: string;
  recipients: Array<string>;
  shares: Array<u32>;
  timelock: u64;
  token: string;
}


export interface EscrowStatus {
  amount_locked: i128;
  config: EscrowConfig;
  state: EscrowState;
}

export const ContractError = {
  1: {message:"AlreadyInitialized"},
  2: {message:"NotInitialized"},
  3: {message:"InvalidState"},
  4: {message:"Unauthorized"},
  5: {message:"TimelockNotExpired"},
  6: {message:"InvalidShares"},
  7: {message:"EmptyRecipients"},
  8: {message:"InvalidAmount"}
}

export interface Client {
  /**
   * Construct and simulate a refund transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Refunds locked funds to the depositor if the timelock is expired. Requires authorization from the depositor.
   */
  refund: (options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a deposit transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Deposits funds into the contract. Requires authorization from the depositor.
   */
  deposit: ({amount}: {amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a release transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Releases locked funds to the recipients. Requires authorization from the arbiter.
   */
  release: (options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_status transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Queries the status of the escrow.
   */
  get_status: (options?: MethodOptions) => Promise<AssembledTransaction<Result<EscrowStatus>>>

  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Initializes the contract config.
   */
  initialize: ({depositor, recipients, shares, arbiter, timelock, token}: {depositor: string, recipients: Array<string>, shares: Array<u32>, arbiter: string, timelock: u64, token: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAAAwAAAAAAAAAAAAAABVN0YXRlAAAAAAAAAAAAAAAAAAAGQ29uZmlnAAAAAAAAAAAAAAAAAAxBbW91bnRMb2NrZWQ=",
        "AAAAAwAAAAAAAAAAAAAAC0VzY3Jvd1N0YXRlAAAAAAQAAAAAAAAABEluaXQAAAAAAAAAAAAAAAlEZXBvc2l0ZWQAAAAAAAABAAAAAAAAAAhSZWxlYXNlZAAAAAIAAAAAAAAACFJlZnVuZGVkAAAAAw==",
        "AAAAAQAAAAAAAAAAAAAADEVzY3Jvd0NvbmZpZwAAAAYAAAAAAAAAB2FyYml0ZXIAAAAAEwAAAAAAAAAJZGVwb3NpdG9yAAAAAAAAEwAAAAAAAAAKcmVjaXBpZW50cwAAAAAD6gAAABMAAAAAAAAABnNoYXJlcwAAAAAD6gAAAAQAAAAAAAAACHRpbWVsb2NrAAAABgAAAAAAAAAFdG9rZW4AAAAAAAAT",
        "AAAAAQAAAAAAAAAAAAAADEVzY3Jvd1N0YXR1cwAAAAMAAAAAAAAADWFtb3VudF9sb2NrZWQAAAAAAAALAAAAAAAAAAZjb25maWcAAAAAB9AAAAAMRXNjcm93Q29uZmlnAAAAAAAAAAVzdGF0ZQAAAAAAB9AAAAALRXNjcm93U3RhdGUA",
        "AAAABAAAAAAAAAAAAAAADUNvbnRyYWN0RXJyb3IAAAAAAAAIAAAAAAAAABJBbHJlYWR5SW5pdGlhbGl6ZWQAAAAAAAEAAAAAAAAADk5vdEluaXRpYWxpemVkAAAAAAACAAAAAAAAAAxJbnZhbGlkU3RhdGUAAAADAAAAAAAAAAxVbmF1dGhvcml6ZWQAAAAEAAAAAAAAABJUaW1lbG9ja05vdEV4cGlyZWQAAAAAAAUAAAAAAAAADUludmFsaWRTaGFyZXMAAAAAAAAGAAAAAAAAAA9FbXB0eVJlY2lwaWVudHMAAAAABwAAAAAAAAANSW52YWxpZEFtb3VudAAAAAAAAAg=",
        "AAAAAAAAAGxSZWZ1bmRzIGxvY2tlZCBmdW5kcyB0byB0aGUgZGVwb3NpdG9yIGlmIHRoZSB0aW1lbG9jayBpcyBleHBpcmVkLiBSZXF1aXJlcyBhdXRob3JpemF0aW9uIGZyb20gdGhlIGRlcG9zaXRvci4AAAAGcmVmdW5kAAAAAAAAAAAAAQAAA+kAAAACAAAH0AAAAA1Db250cmFjdEVycm9yAAAA",
        "AAAAAAAAAExEZXBvc2l0cyBmdW5kcyBpbnRvIHRoZSBjb250cmFjdC4gUmVxdWlyZXMgYXV0aG9yaXphdGlvbiBmcm9tIHRoZSBkZXBvc2l0b3IuAAAAB2RlcG9zaXQAAAAAAQAAAAAAAAAGYW1vdW50AAAAAAALAAAAAQAAA+kAAAACAAAH0AAAAA1Db250cmFjdEVycm9yAAAA",
        "AAAAAAAAAFFSZWxlYXNlcyBsb2NrZWQgZnVuZHMgdG8gdGhlIHJlY2lwaWVudHMuIFJlcXVpcmVzIGF1dGhvcml6YXRpb24gZnJvbSB0aGUgYXJiaXRlci4AAAAAAAAHcmVsZWFzZQAAAAAAAAAAAQAAA+kAAAACAAAH0AAAAA1Db250cmFjdEVycm9yAAAA",
        "AAAAAAAAACFRdWVyaWVzIHRoZSBzdGF0dXMgb2YgdGhlIGVzY3Jvdy4AAAAAAAAKZ2V0X3N0YXR1cwAAAAAAAAAAAAEAAAPpAAAH0AAAAAxFc2Nyb3dTdGF0dXMAAAfQAAAADUNvbnRyYWN0RXJyb3IAAAA=",
        "AAAAAAAAACBJbml0aWFsaXplcyB0aGUgY29udHJhY3QgY29uZmlnLgAAAAppbml0aWFsaXplAAAAAAAGAAAAAAAAAAlkZXBvc2l0b3IAAAAAAAATAAAAAAAAAApyZWNpcGllbnRzAAAAAAPqAAAAEwAAAAAAAAAGc2hhcmVzAAAAAAPqAAAABAAAAAAAAAAHYXJiaXRlcgAAAAATAAAAAAAAAAh0aW1lbG9jawAAAAYAAAAAAAAABXRva2VuAAAAAAAAEwAAAAEAAAPpAAAAAgAAB9AAAAANQ29udHJhY3RFcnJvcgAAAA==" ]),
      options
    )
  }
  public readonly fromJSON = {
    refund: this.txFromJSON<Result<void>>,
        deposit: this.txFromJSON<Result<void>>,
        release: this.txFromJSON<Result<void>>,
        get_status: this.txFromJSON<Result<EscrowStatus>>,
        initialize: this.txFromJSON<Result<void>>
  }
}