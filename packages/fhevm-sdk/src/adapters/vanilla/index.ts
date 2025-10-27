/**
 * @fileoverview Vanilla JavaScript/TypeScript adapter for FHEVM SDK
 * @module @fhevm-sdk/vanilla
 *
 * This adapter provides a simple, framework-agnostic interface for using
 * FHEVM in plain JavaScript/TypeScript projects (Node.js, browser, etc.)
 *
 * @example
 * ```typescript
 * import { createFHEVMClient } from '@fhevm-sdk/vanilla';
 *
 * // Create and initialize client
 * const fhevm = await createFHEVMClient({
 *   provider: window.ethereum,
 *   chainId: 11155111,
 * });
 *
 * // Encrypt a value
 * const encrypted = await fhevm.encrypt(
 *   (input) => input.add32(42),
 *   {
 *     contractAddress: '0x...',
 *     userAddress: '0x...',
 *   }
 * );
 *
 * // Decrypt a value
 * const decrypted = await fhevm.decrypt(
 *   [{ handle: '0x...', contractAddress: '0x...' }],
 *   signer
 * );
 * ```
 */

import { FHEVMClient, type FHEVMClientConfig } from "../../core/client";
import type { FhevmInstance } from "../../fhevmTypes";
import type { JsonRpcSigner } from "ethers";
import type { EncryptedInputBuilder, EncryptionResult, EncryptionConfig, DecryptionRequest } from "../../core/client";
import { DecryptionManager, type DecryptionResults, type DecryptionConfig } from "../../core/decryption";
import { EncryptionBuilder, type FHEDataType, type EncryptableValue } from "../../core/encryption";
import { GenericStringStorage } from "../../storage/GenericStringStorage";
import type { RelayerEncryptedInput } from "@zama-fhe/relayer-sdk/web";

/**
 * Vanilla FHEVM client wrapper
 *
 * Provides a simple, promise-based API for FHEVM operations.
 */
export interface VanillaFHEVMClient {
  /** Get the underlying FHEVM client */
  getClient(): FHEVMClient;

  /** Get the FHEVM instance */
  getInstance(): FhevmInstance;

  /** Check if client is ready */
  isReady(): boolean;

  /**
   * Encrypt values for a smart contract
   */
  encrypt(
    builder: EncryptedInputBuilder,
    config: EncryptionConfig
  ): Promise<EncryptionResult>;

  /**
   * Encrypt a single typed value
   */
  encryptValue(
    value: EncryptableValue,
    type: FHEDataType,
    config: EncryptionConfig
  ): Promise<EncryptionResult>;

  /**
   * Create a type-safe encryption builder
   */
  createEncryptionBuilder(
    contractAddress: `0x${string}`,
    userAddress: `0x${string}`
  ): EncryptionBuilder;

  /**
   * Decrypt encrypted values (user decryption with EIP-712)
   */
  decrypt(
    requests: DecryptionRequest[],
    signer: JsonRpcSigner,
    config?: DecryptionConfig
  ): Promise<DecryptionResults>;

  /**
   * Decrypt a single value
   */
  decryptSingle(
    handle: string,
    contractAddress: `0x${string}`,
    signer: JsonRpcSigner,
    config?: DecryptionConfig
  ): Promise<string | bigint | boolean>;

  /**
   * Dispose of the client and clean up resources
   */
  dispose(): void;
}

/**
 * Create and initialize an FHEVM client
 *
 * This is the main entry point for using FHEVM in vanilla JavaScript/TypeScript.
 *
 * @param config - Client configuration
 * @returns Initialized FHEVM client
 *
 * @example
 * ```typescript
 * // Browser usage
 * const fhevm = await createFHEVMClient({
 *   provider: window.ethereum,
 *   chainId: 11155111,
 * });
 *
 * // Node.js usage
 * const fhevm = await createFHEVMClient({
 *   provider: 'https://rpc.sepolia.org',
 *   chainId: 11155111,
 * });
 * ```
 */
export async function createFHEVMClient(
  config: FHEVMClientConfig
): Promise<VanillaFHEVMClient> {
  // Create core client
  const client = new FHEVMClient(config);

  // Initialize
  await client.init();

  // Create decryption manager
  const decryptionManager = new DecryptionManager(client.getInstance());

  // Return wrapped API
  return {
    getClient(): FHEVMClient {
      return client;
    },

    getInstance(): FhevmInstance {
      return client.getInstance();
    },

    isReady(): boolean {
      return client.isReady;
    },

    async encrypt(
      builder: EncryptedInputBuilder,
      encryptConfig: EncryptionConfig
    ): Promise<EncryptionResult> {
      return client.encrypt(builder, encryptConfig);
    },

    async encryptValue(
      value: EncryptableValue,
      type: FHEDataType,
      encryptConfig: EncryptionConfig
    ): Promise<EncryptionResult> {
      return client.encrypt((input) => {
        const builder = new EncryptionBuilder(input);
        builder.add(value, type);
      }, encryptConfig);
    },

    createEncryptionBuilder(
      contractAddress: `0x${string}`,
      userAddress: `0x${string}`
    ): EncryptionBuilder {
      const input = client
        .getInstance()
        .createEncryptedInput(
          contractAddress,
          userAddress
        ) as RelayerEncryptedInput;

      return new EncryptionBuilder(input);
    },

    async decrypt(
      requests: DecryptionRequest[],
      signer: JsonRpcSigner,
      decryptConfig?: DecryptionConfig
    ): Promise<DecryptionResults> {
      return decryptionManager.decrypt(requests, signer, decryptConfig);
    },

    async decryptSingle(
      handle: string,
      contractAddress: `0x${string}`,
      signer: JsonRpcSigner,
      decryptConfig?: DecryptionConfig
    ): Promise<string | bigint | boolean> {
      return decryptionManager.decryptSingle(
        handle,
        contractAddress,
        signer,
        decryptConfig
      );
    },

    dispose(): void {
      client.dispose();
    },
  };
}

/**
 * Convenience function to create FHEVM client with auto-initialization
 *
 * @param config - Client configuration
 * @returns Promise that resolves to initialized client
 */
export const initFHEVM = createFHEVMClient;

// Re-export core components for advanced usage
export { FHEVMClient } from "../../core/client";
export { DecryptionManager } from "../../core/decryption";
export { EncryptionBuilder } from "../../core/encryption";

// Re-export types
export type {
  FHEVMClientConfig,
  FHEVMClientStatus,
  EncryptionConfig,
  EncryptionResult,
  DecryptionRequest,
} from "../../core/client";

export type {
  FHEDataType,
  ExternalEncryptedType,
  EncryptableValue,
} from "../../core/encryption";

export type {
  DecryptionResults,
  DecryptionConfig,
  DecryptionResult,
} from "../../core/decryption";

export type { FhevmInstance } from "../../fhevmTypes";
