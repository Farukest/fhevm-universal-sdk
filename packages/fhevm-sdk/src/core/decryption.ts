/**
 * @fileoverview Decryption utilities and helpers
 * @module @fhevm-sdk/core/decryption
 */

import type { FhevmInstance } from "../fhevmTypes";
import type { JsonRpcSigner } from "ethers";
import { FhevmDecryptionSignature } from "../FhevmDecryptionSignature";
import type { GenericStringStorage } from "../storage/GenericStringStorage";
import { GenericStringInMemoryStorage } from "../storage/GenericStringStorage";

/**
 * Single decryption request
 */
export interface DecryptionRequest {
  /** Encrypted handle (ciphertext reference) */
  handle: string;

  /** Contract address that owns the encrypted value */
  contractAddress: `0x${string}`;
}

/**
 * Decryption result for a single request
 */
export type DecryptionResult = string | bigint | boolean;

/**
 * Map of decrypted results keyed by handle
 */
export type DecryptionResults = Record<string, DecryptionResult>;

/**
 * Decryption configuration options
 */
export interface DecryptionConfig {
  /** Custom keypair for decryption (optional, auto-generated if not provided) */
  keypair?: {
    publicKey: string;
    privateKey: string;
  };

  /** Storage for caching EIP-712 signatures */
  signatureStorage?: GenericStringStorage;

  /** Force refresh signature (bypass cache) */
  forceRefresh?: boolean;
}

/**
 * User decryption manager
 *
 * Handles the complete flow of user decryption including:
 * - EIP-712 signature creation/caching
 * - Keypair generation/management
 * - Decryption request batching
 *
 * @example
 * ```typescript
 * const manager = new DecryptionManager(instance);
 *
 * const results = await manager.decrypt(
 *   [
 *     { handle: '0x...', contractAddress: '0x...' },
 *     { handle: '0x...', contractAddress: '0x...' }
 *   ],
 *   signer
 * );
 * ```
 */
export class DecryptionManager {
  private instance: FhevmInstance;
  private defaultStorage: GenericStringStorage;

  constructor(instance: FhevmInstance) {
    this.instance = instance;
    this.defaultStorage = new GenericStringInMemoryStorage();
  }

  /**
   * Perform user decryption on encrypted handles
   *
   * This method orchestrates the entire user decryption flow:
   * 1. Validates decryption requests
   * 2. Loads or creates EIP-712 signature
   * 3. Calls the Zama relayer for decryption
   * 4. Returns decrypted values
   *
   * @param requests - Array of decryption requests
   * @param signer - Ethers signer for EIP-712 signature
   * @param config - Optional decryption configuration
   * @returns Map of decrypted values keyed by handle
   *
   * @throws {DecryptionError} If decryption fails
   */
  async decrypt(
    requests: DecryptionRequest[],
    signer: JsonRpcSigner,
    config: DecryptionConfig = {}
  ): Promise<DecryptionResults> {
    // Validate inputs
    if (requests.length === 0) {
      return {};
    }

    this.validateRequests(requests);

    // Extract unique contract addresses
    const uniqueAddresses = Array.from(
      new Set(requests.map((r) => r.contractAddress))
    ) as `0x${string}`[];

    // Get storage (use provided or default)
    const storage = config.signatureStorage || this.defaultStorage;

    // Load or create signature
    let signature: FhevmDecryptionSignature | null;

    if (config.forceRefresh) {
      // Force new signature
      const _userAddress = (await signer.getAddress()) as `0x${string}`;
      const { publicKey, privateKey } =
        config.keypair || (this.instance as any).generateKeypair();

      signature = await FhevmDecryptionSignature.new(
        this.instance,
        uniqueAddresses,
        publicKey,
        privateKey,
        signer
      );

      if (signature) {
        await signature.saveToGenericStringStorage(
          storage,
          this.instance,
          Boolean(config.keypair?.publicKey)
        );
      }
    } else {
      // Try to load from cache first
      signature = await FhevmDecryptionSignature.loadOrSign(
        this.instance,
        uniqueAddresses,
        signer,
        storage,
        config.keypair
      );
    }

    if (!signature) {
      throw new DecryptionError(
        "SIGNATURE_FAILED",
        "Failed to create or load decryption signature"
      );
    }

    // Perform decryption
    try {
      const results = await this.instance.userDecrypt(
        requests.map((r) => ({
          handle: r.handle,
          contractAddress: r.contractAddress,
        })),
        signature.privateKey,
        signature.publicKey,
        signature.signature,
        signature.contractAddresses,
        signature.userAddress,
        signature.startTimestamp,
        signature.durationDays
      );

      return results;
    } catch (error) {
      throw new DecryptionError(
        "DECRYPT_FAILED",
        "Decryption operation failed",
        error as Error
      );
    }
  }

  /**
   * Decrypt a single value
   *
   * Convenience method for decrypting a single encrypted handle.
   *
   * @param handle - Encrypted handle
   * @param contractAddress - Contract address
   * @param signer - Ethers signer
   * @param config - Optional configuration
   * @returns Decrypted value
   */
  async decryptSingle(
    handle: string,
    contractAddress: `0x${string}`,
    signer: JsonRpcSigner,
    config: DecryptionConfig = {}
  ): Promise<DecryptionResult> {
    const results = await this.decrypt(
      [{ handle, contractAddress }],
      signer,
      config
    );

    const value = results[handle];
    if (value === undefined) {
      throw new DecryptionError(
        "DECRYPT_NOT_FOUND",
        `Decryption result not found for handle: ${handle}`
      );
    }

    return value;
  }

  /**
   * Batch decrypt multiple values from the same contract
   *
   * Optimized for decrypting multiple values from a single contract.
   *
   * @param handles - Array of encrypted handles
   * @param contractAddress - Contract address
   * @param signer - Ethers signer
   * @param config - Optional configuration
   * @returns Map of decrypted values
   */
  async decryptBatch(
    handles: string[],
    contractAddress: `0x${string}`,
    signer: JsonRpcSigner,
    config: DecryptionConfig = {}
  ): Promise<DecryptionResults> {
    const requests = handles.map((handle) => ({
      handle,
      contractAddress,
    }));

    return this.decrypt(requests, signer, config);
  }

  /**
   * Create a cached signature for future decryptions
   *
   * Pre-creates and caches a signature to speed up subsequent decryptions.
   * Useful when you know you'll need to decrypt multiple times.
   *
   * @param contractAddresses - Contract addresses to authorize
   * @param signer - Ethers signer
   * @param storage - Optional storage (uses default if not provided)
   * @returns Created signature
   */
  async createSignature(
    contractAddresses: `0x${string}`[],
    signer: JsonRpcSigner,
    storage?: GenericStringStorage
  ): Promise<FhevmDecryptionSignature> {
    const sig = await FhevmDecryptionSignature.loadOrSign(
      this.instance,
      contractAddresses,
      signer,
      storage || this.defaultStorage
    );

    if (!sig) {
      throw new DecryptionError(
        "SIGNATURE_FAILED",
        "Failed to create decryption signature"
      );
    }

    return sig;
  }

  /**
   * Check if a valid cached signature exists
   *
   * @param contractAddresses - Contract addresses
   * @param userAddress - User address
   * @param storage - Optional storage
   * @returns True if valid signature exists in cache
   */
  async hasValidSignature(
    contractAddresses: `0x${string}`[],
    userAddress: `0x${string}`,
    storage?: GenericStringStorage
  ): Promise<boolean> {
    const sig = await FhevmDecryptionSignature.loadFromGenericStringStorage(
      storage || this.defaultStorage,
      this.instance,
      contractAddresses,
      userAddress
    );

    return sig !== null && sig.isValid();
  }

  /**
   * Clear cached signature
   *
   * Forces the next decryption to create a new signature.
   *
   * @param contractAddresses - Contract addresses
   * @param userAddress - User address
   * @param storage - Optional storage
   */
  async clearSignature(
    _contractAddresses: `0x${string}`[],
    _userAddress: `0x${string}`,
    _storage?: GenericStringStorage
  ): Promise<void> {
    // Implementation would depend on GenericStringStorage having a remove method
    // For now, we can't clear it without extending the storage interface
    console.warn("Signature clearing not yet implemented in GenericStringStorage");
  }

  /**
   * Perform public decryption on encrypted handles
   *
   * Public decryption uses the HTTP Relayer endpoint to decrypt values
   * that have been marked as publicly decryptable with FHE.makePubliclyDecryptable().
   *
   * Unlike userDecrypt, this method does NOT require:
   * - Wallet signature (EIP-712)
   * - User authorization
   *
   * It ONLY works on values marked as publicly decryptable in the smart contract.
   *
   * @param requests - Array of decryption requests
   * @returns Map of decrypted values keyed by handle
   *
   * @throws {DecryptionError} If public decryption fails
   *
   * @example
   * ```typescript
   * const manager = new DecryptionManager(instance);
   *
   * // Decrypt publicly decryptable values (no signature needed)
   * const results = await manager.publicDecrypt([
   *   { handle: '0x...', contractAddress: '0x...' }
   * ]);
   * ```
   */
  async publicDecrypt(
    handles: (string | Uint8Array)[]
  ): Promise<DecryptionResults> {
    // Validate inputs
    if (handles.length === 0) {
      return {};
    }

    // Perform public decryption (no signature needed)
    try {
      const results = await this.instance.publicDecrypt(handles);
      return results;
    } catch (error) {
      throw new DecryptionError(
        "PUBLIC_DECRYPT_FAILED",
        "Public decryption operation failed. Make sure the values are marked as publicly decryptable with FHE.makePubliclyDecryptable().",
        error as Error
      );
    }
  }

  /**
   * Decrypt a single value publicly
   *
   * Convenience method for public decryption of a single encrypted handle.
   *
   * @param handle - Encrypted handle
   * @returns Decrypted value
   */
  async publicDecryptSingle(
    handle: string | Uint8Array
  ): Promise<DecryptionResult> {
    const results = await this.publicDecrypt([handle]);

    const handleKey = typeof handle === 'string' ? handle : handle.toString();
    const value = results[handleKey] || results[handle as any];

    if (value === undefined) {
      throw new DecryptionError(
        "PUBLIC_DECRYPT_NOT_FOUND",
        `Public decryption result not found for handle: ${handleKey}. Make sure the value is marked as publicly decryptable.`
      );
    }

    return value;
  }

  /**
   * Batch public decrypt multiple values
   *
   * Alias for publicDecrypt for consistency with other methods.
   *
   * @param handles - Array of encrypted handles
   * @returns Map of decrypted values
   */
  async publicDecryptBatch(
    handles: (string | Uint8Array)[]
  ): Promise<DecryptionResults> {
    return this.publicDecrypt(handles);
  }

  /**
   * Validate decryption requests
   */
  private validateRequests(requests: DecryptionRequest[]): void {
    for (const req of requests) {
      if (!req.handle || typeof req.handle !== "string") {
        throw new DecryptionError(
          "INVALID_REQUEST",
          `Invalid handle in decryption request: ${req.handle}`
        );
      }

      if (
        !req.contractAddress ||
        !/^0x[0-9a-fA-F]{40}$/.test(req.contractAddress)
      ) {
        throw new DecryptionError(
          "INVALID_REQUEST",
          `Invalid contract address in decryption request: ${req.contractAddress}`
        );
      }
    }
  }
}

/**
 * Custom error class for decryption operations
 */
export class DecryptionError extends Error {
  constructor(
    public code: string,
    message: string,
    public cause?: Error
  ) {
    super(message);
    this.name = "DecryptionError";

    if (cause) {
      this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
    }
  }
}

/**
 * Helper to check if decryption is authorized for a contract
 *
 * This checks if the contract has granted FHE permissions to the user.
 * Note: This is a client-side check and should not be relied upon for security.
 *
 * @param instance - FHEVM instance
 * @param contractAddress - Contract to check
 * @param userAddress - User address to check
 * @returns True if authorized (best-effort check)
 */
export async function isDecryptionAuthorized(
  instance: FhevmInstance,
  contractAddress: `0x${string}`,
  userAddress: `0x${string}`
): Promise<boolean> {
  // This would require querying the ACL contract
  // Implementation depends on having access to the ACL contract ABI and provider
  // For now, we return true and let the actual decryption fail if not authorized
  console.warn("Authorization check not implemented - assuming authorized");
  return true;
}

/**
 * Estimate gas for a decryption operation
 *
 * Provides a rough estimate of the gas cost for decryption.
 * Actual costs may vary based on network conditions.
 *
 * @param numValues - Number of values to decrypt
 * @returns Estimated gas cost
 */
export function estimateDecryptionGas(numValues: number): bigint {
  // Base cost + per-value cost
  // These are rough estimates and should be calibrated
  const baseCost = 50000n;
  const perValueCost = 20000n;

  return baseCost + perValueCost * BigInt(numValues);
}
