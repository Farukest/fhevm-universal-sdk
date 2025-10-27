/**
 * @fileoverview React adapter for FHEVM SDK
 * @module @fhevm-sdk/react
 *
 * @example
 * ```tsx
 * import { useFHEVM, useFHEEncrypt, useFHEDecrypt } from '@fhevm-sdk/react';
 *
 * function MyApp() {
 *   const { instance, isReady } = useFHEVM({
 *     provider: window.ethereum,
 *     chainId: 11155111,
 *   });
 *
 *   const { encryptUint32 } = useFHEEncrypt({
 *     instance,
 *     signer,
 *     contractAddress: '0x...',
 *   });
 *
 *   return <div>FHEVM Ready: {isReady ? 'Yes' : 'No'}</div>;
 * }
 * ```
 */

export * from "./useFHEVM";
export * from "./useFHEEncrypt";
export * from "./useFHEDecrypt";

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
