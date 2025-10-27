/**
 * @fileoverview React hook for FHE encryption operations
 * @module @fhevm-sdk/react
 */

"use client";

import { useCallback, useMemo } from "react";
import type { FhevmInstance } from "../../fhevmTypes";
import type { JsonRpcSigner } from "ethers";
import type { EncryptionResult } from "../../core/client";
import { EncryptionBuilder, type FHEDataType, type EncryptableValue } from "../../core/encryption";
import type { RelayerEncryptedInput } from "@zama-fhe/relayer-sdk/web";

/**
 * Builder function type for encrypted input
 */
export type EncryptedInputBuilder = (input: RelayerEncryptedInput) => void;

/**
 * Configuration for encryption hook
 */
export interface UseFHEEncryptConfig {
  /** FHEVM instance */
  instance: FhevmInstance | undefined;

  /** Ethers signer for getting user address */
  signer: JsonRpcSigner | undefined;

  /** Target contract address */
  contractAddress: `0x${string}` | undefined;
}

/**
 * Return type for useFHEEncrypt hook
 */
export interface UseFHEEncryptResult {
  /** Whether encryption is ready */
  canEncrypt: boolean;

  /**
   * Encrypt values using a builder function
   */
  encrypt: (builder: EncryptedInputBuilder) => Promise<EncryptionResult | undefined>;

  /**
   * Encrypt a single value with type specification
   */
  encryptValue: (value: EncryptableValue, type: FHEDataType) => Promise<EncryptionResult | undefined>;

  /**
   * Create a type-safe encryption builder
   */
  createBuilder: () => EncryptionBuilder | undefined;

  /**
   * Encrypt a single uint8 value (convenience method)
   */
  encryptUint8: (value: number) => Promise<EncryptionResult | undefined>;

  /**
   * Encrypt a single uint16 value (convenience method)
   */
  encryptUint16: (value: number) => Promise<EncryptionResult | undefined>;

  /**
   * Encrypt a single uint32 value (convenience method)
   */
  encryptUint32: (value: number) => Promise<EncryptionResult | undefined>;

  /**
   * Encrypt a single uint64 value (convenience method)
   */
  encryptUint64: (value: number | bigint) => Promise<EncryptionResult | undefined>;

  /**
   * Encrypt a single boolean value (convenience method)
   */
  encryptBool: (value: boolean) => Promise<EncryptionResult | undefined>;

  /**
   * Encrypt a single address (convenience method)
   */
  encryptAddress: (value: string) => Promise<EncryptionResult | undefined>;
}

/**
 * React hook for FHE encryption operations
 */
export function useFHEEncrypt(config: UseFHEEncryptConfig): UseFHEEncryptResult {
  const { instance, signer, contractAddress } = config;

  /**
   * Check if all requirements are met for encryption
   */
  const canEncrypt = useMemo(
    () => Boolean(instance && signer && contractAddress),
    [instance, signer, contractAddress]
  );

  /**
   * Main encryption function with builder pattern
   */
  const encrypt = useCallback(
    async (builder: EncryptedInputBuilder) => {
      if (!instance || !signer || !contractAddress) {
        console.warn("Cannot encrypt: missing instance, signer, or contractAddress");
        return undefined;
      }

      try {
        const userAddress = (await signer.getAddress()) as `0x${string}`;

        const input = instance.createEncryptedInput(
          contractAddress,
          userAddress
        ) as RelayerEncryptedInput;

        builder(input);

        const result = await input.encrypt();

        return {
          handles: result.handles,
          inputProof: result.inputProof,
        };
      } catch (error) {
        console.error("Encryption failed:", error);
        throw error;
      }
    },
    [instance, signer, contractAddress]
  );

  /**
   * Encrypt a single typed value
   */
  const encryptValue = useCallback(
    async (value: EncryptableValue, type: FHEDataType) => {
      return encrypt((input) => {
        const builder = new EncryptionBuilder(input);
        builder.add(value, type);
      });
    },
    [encrypt]
  );

  /**
   * Create a type-safe builder instance
   */
  const createBuilder = useCallback(
    () => {
      if (!instance || !signer || !contractAddress) {
        return undefined;
      }

      const userAddress = signer.getAddress();
      const input = instance.createEncryptedInput(
        contractAddress,
        userAddress as any
      ) as RelayerEncryptedInput;

      return new EncryptionBuilder(input);
    },
    [instance, signer, contractAddress]
  );

  /**
   * Convenience method: Encrypt uint8
   */
  const encryptUint8 = useCallback(
    async (value: number) => {
      return encrypt((input) => (input as RelayerEncryptedInput).add8(value));
    },
    [encrypt]
  );

  /**
   * Convenience method: Encrypt uint16
   */
  const encryptUint16 = useCallback(
    async (value: number) => {
      return encrypt((input) => (input as RelayerEncryptedInput).add16(value));
    },
    [encrypt]
  );

  /**
   * Convenience method: Encrypt uint32
   */
  const encryptUint32 = useCallback(
    async (value: number) => {
      return encrypt((input) => (input as RelayerEncryptedInput).add32(value));
    },
    [encrypt]
  );

  /**
   * Convenience method: Encrypt uint64
   */
  const encryptUint64 = useCallback(
    async (value: number | bigint) => {
      return encrypt((input) => (input as RelayerEncryptedInput).add64(value));
    },
    [encrypt]
  );

  /**
   * Convenience method: Encrypt boolean
   */
  const encryptBool = useCallback(
    async (value: boolean) => {
      return encrypt((input) => (input as RelayerEncryptedInput).addBool(value));
    },
    [encrypt]
  );

  /**
   * Convenience method: Encrypt address
   */
  const encryptAddress = useCallback(
    async (value: string) => {
      return encrypt((input) => (input as RelayerEncryptedInput).addAddress(value));
    },
    [encrypt]
  );

  return {
    canEncrypt,
    encrypt,
    encryptValue,
    createBuilder,
    encryptUint8,
    encryptUint16,
    encryptUint32,
    encryptUint64,
    encryptBool,
    encryptAddress,
  };
}
