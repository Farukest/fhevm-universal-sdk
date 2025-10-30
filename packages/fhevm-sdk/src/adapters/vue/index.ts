/**
 * @fileoverview Vue adapter for FHEVM SDK
 * @module @fhevm-sdk/vue
 *
 * @example
 * ```vue
 * <script setup>
 * import { useFHEVM, useFHEEncrypt, useFHEDecrypt } from '@fhevm-sdk/vue';
 *
 * const { instance, isReady } = useFHEVM({
 *   provider: window.ethereum,
 *   chainId: 11155111,
 * });
 *
 * const { encryptUint32 } = useFHEEncrypt({
 *   instance,
 *   signer,
 *   contractAddress: ref('0x...'),
 * });
 * </script>
 *
 * <template>
 *   <div>FHEVM Ready: {{ isReady ? 'Yes' : 'No' }}</div>
 * </template>
 * ```
 */

export * from "./useFHEVM";
export * from "./useFHEEncrypt";
export * from "./useFHEDecrypt";
export * from "./usePublicDecrypt";

// Re-export core types for convenience
export type {
  FHEVMClient,
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
