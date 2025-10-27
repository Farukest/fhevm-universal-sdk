/**
 * @fileoverview Core module exports
 * @module @fhevm-sdk/core
 */

export * from "./client";
export type {
  FHEDataType,
  ExternalEncryptedType,
  EncryptableValue,
  EncryptionBuilder,
  EncryptionValidationError
} from "./encryption";
export {
  FHE_TYPE_TO_METHOD,
  getEncryptionMethod,
  toHex,
  buildParamsFromAbi,
  validateEncryptionValue
} from "./encryption";
export type {
  DecryptionResult,
  DecryptionResults,
  DecryptionConfig,
  DecryptionManager,
  DecryptionError
} from "./decryption";
export {
  isDecryptionAuthorized,
  estimateDecryptionGas
} from "./decryption";
