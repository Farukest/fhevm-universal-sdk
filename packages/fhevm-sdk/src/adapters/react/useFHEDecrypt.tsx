/**
 * @fileoverview React hook for FHE decryption operations
 * @module @fhevm-sdk/react
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FhevmInstance } from "../../fhevmTypes";
import type { JsonRpcSigner } from "ethers";
import { DecryptionManager, type DecryptionRequest, type DecryptionResults, type DecryptionConfig } from "../../core/decryption";
import { GenericStringStorage } from "../../storage/GenericStringStorage";

/**
 * Configuration for decryption hook
 */
export interface UseFHEDecryptConfig {
  /** FHEVM instance */
  instance: FhevmInstance | undefined;

  /** Ethers signer for EIP-712 signing */
  signer: JsonRpcSigner | undefined;

  /** Decryption requests */
  requests?: readonly DecryptionRequest[];

  /** Storage for caching signatures */
  signatureStorage?: GenericStringStorage;

  /** Chain ID (used for cache invalidation) */
  chainId?: number;

  /** Auto-decrypt when requests change (default: false) */
  autoDecrypt?: boolean;
}

/**
 * Return type for useFHEDecrypt hook
 */
export interface UseFHEDecryptResult {
  /** Whether decryption is ready */
  canDecrypt: boolean;

  /** Whether currently decrypting */
  isDecrypting: boolean;

  /** Decrypted results */
  results: DecryptionResults;

  /** Current status message */
  message: string;

  /** Error if decryption failed */
  error: string | null;

  /**
   * Trigger decryption
   */
  decrypt: () => Promise<void>;

  /**
   * Decrypt specific requests (overrides config.requests)
   */
  decryptRequests: (requests: DecryptionRequest[], config?: DecryptionConfig) => Promise<DecryptionResults>;

  /**
   * Decrypt a single value
   */
  decryptSingle: (handle: string, contractAddress: `0x${string}`) => Promise<string | bigint | boolean>;

  /**
   * Clear current results
   */
  clearResults: () => void;

  /**
   * Set custom message
   */
  setMessage: (message: string) => void;

  /**
   * Set custom error
   */
  setError: (error: string | null) => void;
}

/**
 * React hook for FHE decryption operations
 *
 * Provides Wagmi-style decryption functionality with automatic caching
 * of EIP-712 signatures for improved UX.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { instance } = useFHEVM({ provider: window.ethereum });
 *   const signer = useSigner();
 *
 *   const {
 *     decrypt,
 *     isDecrypting,
 *     results,
 *     error
 *   } = useFHEDecrypt({
 *     instance,
 *     signer,
 *     requests: [
 *       { handle: '0x...', contractAddress: '0x...' }
 *     ]
 *   });
 *
 *   return (
 *     <div>
 *       <button onClick={decrypt} disabled={isDecrypting}>
 *         {isDecrypting ? 'Decrypting...' : 'Decrypt'}
 *       </button>
 *       {error && <div>Error: {error}</div>}
 *       {results && <div>Result: {JSON.stringify(results)}</div>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useFHEDecrypt(config: UseFHEDecryptConfig): UseFHEDecryptResult {
  const {
    instance,
    signer,
    requests,
    signatureStorage,
    chainId,
    autoDecrypt = false,
  } = config;

  const [isDecrypting, setIsDecrypting] = useState(false);
  const [message, setMessage] = useState("");
  const [results, setResults] = useState<DecryptionResults>({});
  const [error, setError] = useState<string | null>(null);

  // Refs for stable references
  const isDecryptingRef = useRef(isDecrypting);
  const managerRef = useRef<DecryptionManager | undefined>(undefined);
  const chainIdRef = useRef(chainId);
  const signerRef = useRef(signer);

  // Update refs
  isDecryptingRef.current = isDecrypting;
  chainIdRef.current = chainId;
  signerRef.current = signer;

  // Create decryption manager
  useEffect(() => {
    if (instance) {
      managerRef.current = new DecryptionManager(instance);
    } else {
      managerRef.current = undefined;
    }
  }, [instance]);

  /**
   * Compute requests key for change detection
   */
  const requestsKey = useMemo(() => {
    if (!requests || requests.length === 0) return "";

    const sorted = [...requests].sort((a, b) =>
      (a.handle + a.contractAddress).localeCompare(b.handle + b.contractAddress)
    );

    return JSON.stringify(sorted);
  }, [requests]);

  /**
   * Check if decryption is possible
   */
  const canDecrypt = useMemo(() => {
    return Boolean(
      instance &&
        signer &&
        requests &&
        requests.length > 0 &&
        !isDecrypting
    );
  }, [instance, signer, requests, isDecrypting]);

  /**
   * Main decryption function
   */
  const decrypt = useCallback(async () => {
    if (isDecryptingRef.current) {
      console.warn("Already decrypting");
      return;
    }

    if (!managerRef.current || !signerRef.current || !requests || requests.length === 0) {
      console.warn("Cannot decrypt: missing manager, signer, or requests");
      return;
    }

    const thisChainId = chainIdRef.current;
    const thisSigner = signerRef.current;

    setIsDecrypting(true);
    setMessage("Starting decryption...");
    setError(null);

    try {
      // Check if stale (chainId or signer changed)
      const isStale = () =>
        thisChainId !== chainIdRef.current || thisSigner !== signerRef.current;

      if (isStale()) {
        setMessage("Request stale, skipping");
        return;
      }

      setMessage("Creating decryption signature...");

      const decryptionResults = await managerRef.current.decrypt(
        requests.map(r => ({ handle: r.handle, contractAddress: r.contractAddress })),
        thisSigner,
        {
          signatureStorage,
        }
      );

      if (isStale()) {
        setMessage("Request stale, ignoring results");
        return;
      }

      setResults(decryptionResults);
      setMessage("Decryption completed!");
    } catch (err) {
      const error = err as Error;
      setError(error.message || "Decryption failed");
      setMessage("Decryption failed");
      console.error("Decryption error:", error);
    } finally {
      setIsDecrypting(false);
    }
  }, [requests, signatureStorage]);

  /**
   * Decrypt with custom requests
   */
  const decryptRequests = useCallback(
    async (
      customRequests: DecryptionRequest[],
      decryptConfig?: DecryptionConfig
    ): Promise<DecryptionResults> => {
      if (!managerRef.current || !signer) {
        throw new Error("Cannot decrypt: missing manager or signer");
      }

      setIsDecrypting(true);
      setMessage("Decrypting custom requests...");
      setError(null);

      try {
        const results = await managerRef.current.decrypt(
          customRequests,
          signer,
          {
            signatureStorage,
            ...decryptConfig,
          }
        );

        setMessage("Custom decryption completed!");
        return results;
      } catch (err) {
        const error = err as Error;
        setError(error.message || "Custom decryption failed");
        setMessage("Custom decryption failed");
        throw error;
      } finally {
        setIsDecrypting(false);
      }
    },
    [signer, signatureStorage]
  );

  /**
   * Decrypt a single value
   */
  const decryptSingle = useCallback(
    async (
      handle: string,
      contractAddress: `0x${string}`
    ): Promise<string | bigint | boolean> => {
      if (!managerRef.current || !signer) {
        throw new Error("Cannot decrypt: missing manager or signer");
      }

      setIsDecrypting(true);
      setMessage(`Decrypting handle ${handle}...`);
      setError(null);

      try {
        const result = await managerRef.current.decryptSingle(
          handle,
          contractAddress,
          signer,
          { signatureStorage }
        );

        setMessage("Single decryption completed!");
        return result;
      } catch (err) {
        const error = err as Error;
        setError(error.message || "Single decryption failed");
        setMessage("Single decryption failed");
        throw error;
      } finally {
        setIsDecrypting(false);
      }
    },
    [signer, signatureStorage]
  );

  /**
   * Clear results
   */
  const clearResults = useCallback(() => {
    setResults({});
    setMessage("");
    setError(null);
  }, []);

  /**
   * Auto-decrypt when requests change
   */
  useEffect(() => {
    if (autoDecrypt && canDecrypt) {
      decrypt();
    }
  }, [autoDecrypt, canDecrypt, requestsKey, decrypt]);

  return {
    canDecrypt,
    isDecrypting,
    results,
    message,
    error,
    decrypt,
    decryptRequests,
    decryptSingle,
    clearResults,
    setMessage,
    setError,
  };
}
