/**
 * @fileoverview Vue composable for FHE encryption
 * @module @fhevm-sdk/vue
 */

import { computed, type Ref } from "vue";
import type { FhevmInstance } from "../../fhevmTypes";
import type { JsonRpcSigner } from "ethers";
import type { EncryptedInputBuilder, EncryptionResult } from "../../core/client";
import { EncryptionBuilder, type FHEDataType, type EncryptableValue } from "../../core/encryption";
import type { RelayerEncryptedInput } from "@zama-fhe/relayer-sdk/web";

/**
 * Configuration for encryption composable
 */
export interface UseFHEEncryptConfig {
  /** FHEVM instance */
  instance: Ref<FhevmInstance | undefined>;

  /** Ethers signer for getting user address */
  signer: Ref<JsonRpcSigner | undefined>;

  /** Target contract address */
  contractAddress: Ref<`0x${string}` | undefined>;
}

/**
 * Return type for useFHEEncrypt composable
 */
export interface UseFHEEncryptComposable {
  /** Whether encryption is ready */
  canEncrypt: Ref<boolean>;

  /** Encrypt values using a builder function */
  encrypt: (builder: EncryptedInputBuilder) => Promise<EncryptionResult | undefined>;

  /** Encrypt a single value with type specification */
  encryptValue: (value: EncryptableValue, type: FHEDataType) => Promise<EncryptionResult | undefined>;

  /** Create a type-safe encryption builder */
  createBuilder: () => EncryptionBuilder | undefined;

  /** Encrypt a single uint8 value (convenience method) */
  encryptUint8: (value: number) => Promise<EncryptionResult | undefined>;

  /** Encrypt a single uint16 value (convenience method) */
  encryptUint16: (value: number) => Promise<EncryptionResult | undefined>;

  /** Encrypt a single uint32 value (convenience method) */
  encryptUint32: (value: number) => Promise<EncryptionResult | undefined>;

  /** Encrypt a single uint64 value (convenience method) */
  encryptUint64: (value: number | bigint) => Promise<EncryptionResult | undefined>;

  /** Encrypt a single boolean value (convenience method) */
  encryptBool: (value: boolean) => Promise<EncryptionResult | undefined>;

  /** Encrypt a single address (convenience method) */
  encryptAddress: (value: string) => Promise<EncryptionResult | undefined>;
}

/**
 * Vue composable for FHE encryption operations
 *
 * Provides encryption functionality with type-safe helpers.
 *
 * @example
 * ```vue
 * <script setup>
 * import { useFHEVM } from '@fhevm-sdk/vue';
 * import { useFHEEncrypt } from '@fhevm-sdk/vue';
 *
 * const { instance } = useFHEVM({ provider: window.ethereum });
 * const signer = ref(mySigner);
 * const contractAddress = ref('0x...');
 *
 * const { encrypt, encryptUint32, canEncrypt } = useFHEEncrypt({
 *   instance,
 *   signer,
 *   contractAddress,
 * });
 *
 * const handleEncrypt = async () => {
 *   const result = await encryptUint32(42);
 *   console.log('Encrypted:', result);
 * };
 * </script>
 * ```
 */
export function useFHEEncrypt(config: UseFHEEncryptConfig): UseFHEEncryptComposable {
  const { instance, signer, contractAddress } = config;

  /**
   * Check if all requirements are met for encryption
   */
  const canEncrypt = computed(
    () => Boolean(instance.value && signer.value && contractAddress.value)
  );

  /**
   * Main encryption function with builder pattern
   */
  const encrypt = async (builder: EncryptedInputBuilder): Promise<EncryptionResult | undefined> => {
    if (!instance.value || !signer.value || !contractAddress.value) {
      console.warn("Cannot encrypt: missing instance, signer, or contractAddress");
      return undefined;
    }

    try {
      const userAddress = (await signer.value.getAddress()) as `0x${string}`;

      const input = instance.value.createEncryptedInput(
        contractAddress.value,
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
  };

  /**
   * Encrypt a single typed value
   */
  const encryptValue = async (
    value: EncryptableValue,
    type: FHEDataType
  ): Promise<EncryptionResult | undefined> => {
    return encrypt((input) => {
      const builder = new EncryptionBuilder(input);
      builder.add(value, type);
    });
  };

  /**
   * Create a type-safe builder instance
   */
  const createBuilder = (): EncryptionBuilder | undefined => {
    if (!instance.value || !signer.value || !contractAddress.value) {
      return undefined;
    }

    const userAddress = signer.value.getAddress();
    const input = instance.value.createEncryptedInput(
      contractAddress.value,
      userAddress as any
    ) as RelayerEncryptedInput;

    return new EncryptionBuilder(input);
  };

  /**
   * Convenience method: Encrypt uint8
   */
  const encryptUint8 = async (value: number): Promise<EncryptionResult | undefined> => {
    return encrypt((input) => (input as RelayerEncryptedInput).add8(value));
  };

  /**
   * Convenience method: Encrypt uint16
   */
  const encryptUint16 = async (value: number): Promise<EncryptionResult | undefined> => {
    return encrypt((input) => (input as RelayerEncryptedInput).add16(value));
  };

  /**
   * Convenience method: Encrypt uint32
   */
  const encryptUint32 = async (value: number): Promise<EncryptionResult | undefined> => {
    return encrypt((input) => (input as RelayerEncryptedInput).add32(value));
  };

  /**
   * Convenience method: Encrypt uint64
   */
  const encryptUint64 = async (value: number | bigint): Promise<EncryptionResult | undefined> => {
    return encrypt((input) => (input as RelayerEncryptedInput).add64(value));
  };

  /**
   * Convenience method: Encrypt boolean
   */
  const encryptBool = async (value: boolean): Promise<EncryptionResult | undefined> => {
    return encrypt((input) => (input as RelayerEncryptedInput).addBool(value));
  };

  /**
   * Convenience method: Encrypt address
   */
  const encryptAddress = async (value: string): Promise<EncryptionResult | undefined> => {
    return encrypt((input) => (input as RelayerEncryptedInput).addAddress(value));
  };

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
