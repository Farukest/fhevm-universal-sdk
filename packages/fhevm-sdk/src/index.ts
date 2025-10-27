/**
 * @fileoverview Universal FHEVM SDK - Framework-agnostic encryption toolkit
 * @module @fhevm-sdk
 *
 * A comprehensive SDK for building confidential dApps with Fully Homomorphic Encryption (FHE).
 * Supports React, Vue, Vanilla JS, and more.
 *
 * @example
 * ```typescript
 * // React
 * import { useFHEVM, useFHEEncrypt, useFHEDecrypt } from '@fhevm-sdk/react';
 *
 * // Vue
 * import { useFHEVM, useFHEEncrypt, useFHEDecrypt } from '@fhevm-sdk/vue';
 *
 * // Vanilla JS/TS
 * import { createFHEVMClient } from '@fhevm-sdk/vanilla';
 *
 * // Core (framework-agnostic)
 * import { FHEVMClient } from '@fhevm-sdk/core';
 * ```
 */

// ============================================================================
// Core exports - Framework-agnostic
// ============================================================================

export * from "./core/index";

// ============================================================================
// Storage exports
// ============================================================================

export * from "./storage/index";

// ============================================================================
// Type exports
// ============================================================================

export * from "./fhevmTypes";
export * from "./FhevmDecryptionSignature";

// ============================================================================
// Legacy exports (for backward compatibility)
// ============================================================================

// Keep old React exports at root level for backward compatibility
// Export specific items to avoid conflicts
export {
  useFHEVM,
  useFHEEncrypt,
  useFHEDecrypt,
  useFhevm,
  useFHEEncryption,
} from "./react/index";
export type {
  UseFHEVMConfig,
  UseFHEVMResult,
  UseFHEEncryptConfig,
  UseFHEEncryptResult,
  UseFHEDecryptConfig,
  UseFHEDecryptResult,
} from "./react/index";

// Export storage utilities for backward compatibility
export {
  useInMemoryStorage,
  InMemoryStorageProvider,
} from "./react/useInMemoryStorage";

// ============================================================================
// Constants and utilities
// ============================================================================

export * from "./internal/constants";

// Export encryption utilities
export { buildParamsFromAbi, getEncryptionMethod } from "./core/encryption";

// ============================================================================
// Note on adapter imports:
// ============================================================================
//
// For framework-specific adapters, use the subpath imports:
//
// React:
//   import { useFHEVM } from '@fhevm-sdk/react'
//
// Vue:
//   import { useFHEVM } from '@fhevm-sdk/vue'
//
// Vanilla:
//   import { createFHEVMClient } from '@fhevm-sdk/vanilla'
//
// Core (advanced usage):
//   import { FHEVMClient } from '@fhevm-sdk/core'
//
// These are configured in package.json exports field.
// ============================================================================
