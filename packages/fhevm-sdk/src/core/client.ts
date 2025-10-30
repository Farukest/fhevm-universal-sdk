/**
 * @fileoverview Core FHEVM Client - Framework-agnostic implementation
 * @module @fhevm-sdk/core
 */

import type { Eip1193Provider } from "ethers";
import { JsonRpcSigner } from "ethers";
import { createFhevmInstance } from "../internal/fhevm";
import type { FhevmInstance } from "../fhevmTypes";
import { FhevmDecryptionSignature } from "../FhevmDecryptionSignature";
import type { GenericStringStorage } from "../storage/GenericStringStorage";
import { GenericStringInMemoryStorage } from "../storage/GenericStringStorage";
import type { RelayerEncryptedInput } from "@zama-fhe/relayer-sdk/web";

/**
 * Configuration options for FHEVM Client
 */
export interface FHEVMClientConfig {
  /** Network provider (EIP-1193 compatible or RPC URL) */
  provider: Eip1193Provider | string;

  /** Chain ID for the target network */
  chainId?: number;

  /**
   * Mock mode for local development
   * - true: Use mock FHEVM (instant local encryption, no KMS)
   * - false: Use real FHEVM (with KMS/gateway, works on any network)
   * - undefined: Auto-detect (31337 = mock, others = real)
   *
   * @default undefined (auto-detect)
   */
  mockMode?: boolean;

  /**
   * Advanced: Mock chains configuration for local development (chainId -> rpcUrl)
   * Use mockMode instead for simpler configuration
   */
  mockChains?: Record<number, string>;

  /** Storage adapter for caching decryption signatures */
  signatureStorage?: GenericStringStorage;

  /** Enable automatic initialization on creation */
  autoInit?: boolean;
}

/**
 * Status of the FHEVM client lifecycle
 */
export type FHEVMClientStatus =
  | "idle"           // Not initialized
  | "initializing"   // SDK loading/initializing
  | "ready"          // Ready for operations
  | "error";         // Error state

/**
 * Encryption request configuration
 */
export interface EncryptionConfig {
  /** Contract address to encrypt for */
  contractAddress: `0x${string}`;

  /** User address performing encryption */
  userAddress: `0x${string}`;
}

/**
 * Decryption request for a single encrypted value
 */
export interface DecryptionRequest {
  /** Encrypted handle (ciphertext reference) */
  handle: string;

  /** Contract address that owns the encrypted value */
  contractAddress: `0x${string}`;
}

/**
 * Result of an encryption operation
 */
export interface EncryptionResult {
  /** Array of encrypted handles */
  handles: Uint8Array[];

  /** Zero-knowledge proof for the encryption */
  inputProof: Uint8Array;
}

/**
 * Builder function for encrypted input
 */
export type EncryptedInputBuilder = (input: RelayerEncryptedInput) => void;

/**
 * Core FHEVM Client - Framework-agnostic
 *
 * This class provides the foundational FHEVM functionality without any
 * framework-specific dependencies. It can be used directly in Node.js,
 * or wrapped by framework-specific adapters (React, Vue, etc.)
 *
 * @example
 * ```typescript
 * const client = new FHEVMClient({
 *   provider: window.ethereum,
 *   chainId: 11155111, // Sepolia
 * });
 *
 * await client.init();
 *
 * const encrypted = await client.encrypt(
 *   (input) => input.add32(42),
 *   { contractAddress: '0x...', userAddress: '0x...' }
 * );
 * ```
 */
export class FHEVMClient {
  private config: FHEVMClientConfig;
  private instance?: FhevmInstance;
  private abortController?: AbortController;
  private _status: FHEVMClientStatus = "idle";
  private _error?: Error;
  private statusListeners: Set<(status: FHEVMClientStatus) => void> = new Set();

  constructor(config: FHEVMClientConfig) {
    this.config = {
      autoInit: false,
      ...config,
    };

    if (this.config.autoInit) {
      this.init().catch((error) => {
        this._error = error;
        this.setStatus("error");
      });
    }
  }

  /**
   * Current status of the client
   */
  get status(): FHEVMClientStatus {
    return this._status;
  }

  /**
   * Last error encountered
   */
  get error(): Error | undefined {
    return this._error;
  }

  /**
   * Whether the client is ready for operations
   */
  get isReady(): boolean {
    return this._status === "ready" && this.instance !== undefined;
  }

  /**
   * Get the underlying FHEVM instance
   * @throws {Error} If client is not initialized
   */
  getInstance(): FhevmInstance {
    if (!this.instance) {
      throw new Error("FHEVM Client not initialized. Call init() first.");
    }
    return this.instance;
  }

  /**
   * Subscribe to status changes
   */
  onStatusChange(listener: (status: FHEVMClientStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  private setStatus(status: FHEVMClientStatus): void {
    this._status = status;
    this.statusListeners.forEach(listener => listener(status));
  }

  /**
   * Initialize the FHEVM client
   *
   * This method:
   * 1. Loads the Zama Relayer SDK (if not in mock mode)
   * 2. Initializes the SDK with network configuration
   * 3. Creates an FHEVM instance ready for encryption/decryption
   *
   * @throws {FhevmAbortError} If initialization is aborted
   * @throws {Error} If initialization fails
   */
  async init(): Promise<void> {
    if (this._status === "initializing") {
      throw new Error("Already initializing");
    }

    if (this._status === "ready") {
      return; // Already initialized
    }

    this.setStatus("initializing");
    this._error = undefined;

    // Create abort controller for this initialization
    this.abortController = new AbortController();

    try {
      // Determine mockChains based on mockMode
      let mockChains = this.config.mockChains;

      if (this.config.mockMode !== undefined) {
        if (this.config.mockMode === true) {
          // Force mock mode: treat current network as mock
          const provider = this.config.provider;
          const rpcUrl = typeof provider === "string" ? provider : "http://localhost:8545";

          // If chainId is provided, use it for mock
          // Otherwise createFhevmInstance will detect it
          if (this.config.chainId) {
            mockChains = {
              [this.config.chainId]: rpcUrl,
            };
          } else {
            // Default to Hardhat local dev chain
            mockChains = {
              31337: rpcUrl,
            };
          }
        } else if (this.config.mockMode === false) {
          // Force real mode: no mock chains
          mockChains = {};
        }
        // If mockMode is undefined, use existing mockChains or default behavior
      }

      this.instance = await createFhevmInstance({
        provider: this.config.provider,
        mockChains,
        signal: this.abortController.signal,
        chainId: this.config.chainId,
        onStatusChange: (_status) => {
          // Internal status from createFhevmInstance
          // Silent - no logging needed in production
        },
      });

      this.setStatus("ready");
    } catch (error) {
      this._error = error as Error;
      this.setStatus("error");
      throw error;
    }
  }

  /**
   * Abort ongoing initialization
   */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = undefined;
    }
    this.setStatus("idle");
  }

  /**
   * Reinitialize the client (useful when provider changes)
   */
  async reinit(newConfig?: Partial<FHEVMClientConfig>): Promise<void> {
    this.abort();

    if (newConfig) {
      this.config = { ...this.config, ...newConfig };
    }

    this.instance = undefined;
    await this.init();
  }

  /**
   * Encrypt values for a smart contract
   *
   * @param builder - Function that adds values to encrypt
   * @param config - Encryption configuration
   * @returns Encryption result with handles and proof
   *
   * @example
   * ```typescript
   * const result = await client.encrypt(
   *   (input) => {
   *     input.add32(42);      // Add a uint32
   *     input.addBool(true);  // Add a boolean
   *   },
   *   {
   *     contractAddress: '0x...',
   *     userAddress: '0x...'
   *   }
   * );
   * ```
   */
  async encrypt(
    builder: EncryptedInputBuilder,
    config: EncryptionConfig
  ): Promise<EncryptionResult> {
    const instance = this.getInstance();

    const input = instance.createEncryptedInput(
      config.contractAddress,
      config.userAddress
    ) as RelayerEncryptedInput;

    builder(input);

    const encrypted = await input.encrypt();

    return {
      handles: encrypted.handles,
      inputProof: encrypted.inputProof,
    };
  }

  /**
   * Decrypt encrypted values (user decryption with EIP-712 signature)
   *
   * This performs "user decryption" which requires:
   * 1. The user to have proper FHE permissions on the contract
   * 2. EIP-712 signature from the user's wallet
   * 3. A keypair for decryption (auto-generated if not provided)
   *
   * @param requests - Array of decryption requests
   * @param signer - Ethers JsonRpcSigner for EIP-712 signing
   * @param signatureStorage - Optional storage for caching signatures
   * @returns Decrypted values mapped by handle
   *
   * @example
   * ```typescript
   * const results = await client.decrypt(
   *   [
   *     { handle: '0x...', contractAddress: '0x...' },
   *     { handle: '0x...', contractAddress: '0x...' }
   *   ],
   *   ethersSigner
   * );
   *
   * console.log(results['0x...']); // Decrypted value
   * ```
   */
  async decrypt(
    requests: DecryptionRequest[],
    signer: JsonRpcSigner,
    signatureStorage?: GenericStringStorage
  ): Promise<Record<string, string | bigint | boolean>> {
    const instance = this.getInstance();

    if (requests.length === 0) {
      return {};
    }

    // Get unique contract addresses
    const uniqueAddresses = Array.from(
      new Set(requests.map(r => r.contractAddress))
    ) as `0x${string}`[];

    // Use provided storage or create a temporary in-memory one
    const storage = signatureStorage || new GenericStringInMemoryStorage();

    // Load or create EIP-712 signature
    const signature = await FhevmDecryptionSignature.loadOrSign(
      instance,
      uniqueAddresses,
      signer,
      storage
    );

    if (!signature) {
      throw new Error("Failed to create decryption signature");
    }

    // Perform decryption
    const results = await instance.userDecrypt(
      requests.map(r => ({ handle: r.handle, contractAddress: r.contractAddress })),
      signature.privateKey,
      signature.publicKey,
      signature.signature,
      signature.contractAddresses,
      signature.userAddress,
      signature.startTimestamp,
      signature.durationDays
    );

    return results;
  }

  /**
   * Public decryption via HTTP endpoint (no wallet signature required)
   *
   * This performs "public decryption" which:
   * 1. Does NOT require wallet signature
   * 2. Does NOT require FHE permissions
   * 3. Returns decrypted values visible to everyone
   * 4. Uses Relayer HTTP endpoint
   *
   * Use this when you want to decrypt values that should be publicly visible
   * (e.g., auction results, game outcomes, public counters).
   *
   * @param handles - Array of ciphertext handles to decrypt
   * @returns Decrypted values mapped by handle
   *
   * @example
   * ```typescript
   * const results = await client.publicDecrypt([
   *   '0x830a61b343d2f3de67ec59cb18961fd086085c1c73ff0000000000aa36a70000',
   *   '0x98ee526413903d4613feedb9c8fa44fe3f4ed0dd00ff0000000000aa36a70400',
   * ]);
   *
   * console.log(results['0x830a...']); // true
   * console.log(results['0x98ee...']); // 242n
   * ```
   */
  async publicDecrypt(
    handles: string[]
  ): Promise<Record<string, string | bigint | boolean>> {
    const instance = this.getInstance();

    if (handles.length === 0) {
      return {};
    }

    // Call the Relayer SDK's publicDecrypt method
    const results = await instance.publicDecrypt(handles);

    return results;
  }

  /**
   * Create encrypted input builder (advanced usage)
   *
   * For cases where you need more control over the encryption process.
   *
   * @param contractAddress - Contract address to encrypt for
   * @param userAddress - User address performing encryption
   * @returns RelayerEncryptedInput instance
   */
  createEncryptedInput(
    contractAddress: `0x${string}`,
    userAddress: `0x${string}`
  ): RelayerEncryptedInput {
    const instance = this.getInstance();
    return instance.createEncryptedInput(contractAddress, userAddress) as RelayerEncryptedInput;
  }

  /**
   * Generate a new keypair for decryption
   *
   * Useful for advanced scenarios where you want to manage keypairs manually.
   *
   * @returns Object with publicKey and privateKey
   */
  generateKeypair(): { publicKey: string; privateKey: string } {
    const instance = this.getInstance();
    return (instance as any).generateKeypair();
  }

  /**
   * Dispose of the client and clean up resources
   */
  dispose(): void {
    this.abort();
    this.instance = undefined;
    this.statusListeners.clear();
    this.setStatus("idle");
  }
}
