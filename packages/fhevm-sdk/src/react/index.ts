/**
 * @fileoverview Legacy React exports (backward compatibility)
 * @module fhevm-sdk/react
 *
 * @deprecated Use adapters/react instead
 * This module is kept for backward compatibility.
 * All exports are re-exported from the new adapters/react module.
 */

// Re-export everything from new React adapter for backward compatibility
export * from "../adapters/react/index";

// Legacy hook names (for backward compatibility)
export { useFHEVM as useFhevm } from "../adapters/react/useFHEVM";
// Note: useFHEEncryption is exported from the old implementation below, not the new adapter

// Export old useFHEEncryption hook (different implementation)
// This is needed for backward compatibility with legacy code that uses encryptWith
export * from "./useFHEEncryption";

