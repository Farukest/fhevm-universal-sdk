/**
 * @fileoverview React hook for FHE public decryption operations (no wallet signature required)
 * @module @fhevm-sdk/react
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FhevmInstance } from "../../fhevmTypes";

/**
 * Configuration for public decryption hook
 */
export interface UsePublicDecryptConfig {
  /** FHEVM instance */
  instance: FhevmInstance | undefined;

  /** Handles to decrypt */
  handles?: readonly string[];

  /** Auto-decrypt when handles change (default: false) */
  autoDecrypt?: boolean;
}

/**
 * Return type for usePublicDecrypt hook
 */
export interface UsePublicDecryptResult {
  /** Whether decryption is ready */
  canDecrypt: boolean;

  /** Whether currently decrypting */
  isDecrypting: boolean;

  /** Decrypted results mapped by handle */
  results: Record<string, string | bigint | boolean>;

  /** Current status message */
  message: string;

  /** Error if decryption failed */
  error: string | null;

  /**
   * Trigger public decryption
   */
  decrypt: () => Promise<void>;

  /**
   * Decrypt specific handles (overrides config.handles)
   */
  decryptHandles: (handles: string[]) => Promise<Record<string, string | bigint | boolean>>;

  /**
   * Decrypt a single handle
   */
  decryptSingle: (handle: string) => Promise<string | bigint | boolean>;

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
 * React hook for FHE public decryption operations
 *
 * Public decryption does NOT require:
 * - Wallet signature
 * - FHE permissions
 * - EIP-712 signing
 *
 * Results are publicly visible to everyone via the Relayer HTTP endpoint.
 *
 * Use cases:
 * - Auction results (who won?)
 * - Game outcomes (final scores)
 * - Public counters
 * - Any value that should be visible to everyone
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { instance } = useFHEVM({ provider: window.ethereum });
 *
 *   const {
 *     decrypt,
 *     isDecrypting,
 *     results,
 *     error
 *   } = usePublicDecrypt({
 *     instance,
 *     handles: [
 *       '0x830a61b343d2f3de67ec59cb18961fd086085c1c73ff0000000000aa36a70000',
 *       '0x98ee526413903d4613feedb9c8fa44fe3f4ed0dd00ff0000000000aa36a70400',
 *     ]
 *   });
 *
 *   return (
 *     <div>
 *       <button onClick={decrypt} disabled={isDecrypting}>
 *         {isDecrypting ? 'Decrypting...' : 'Decrypt Public Values'}
 *       </button>
 *       {error && <div>Error: {error}</div>}
 *       {results && <div>Results: {JSON.stringify(results)}</div>}
 *     </div>
 *   );
 * }
 * ```
 */
export function usePublicDecrypt(config: UsePublicDecryptConfig): UsePublicDecryptResult {
  const {
    instance,
    handles,
    autoDecrypt = false,
  } = config;

  const [isDecrypting, setIsDecrypting] = useState(false);
  const [message, setMessage] = useState("");
  const [results, setResults] = useState<Record<string, string | bigint | boolean>>({});
  const [error, setError] = useState<string | null>(null);

  // Refs for stable references
  const isDecryptingRef = useRef(isDecrypting);
  const instanceRef = useRef(instance);

  // Update refs
  isDecryptingRef.current = isDecrypting;
  instanceRef.current = instance;

  /**
   * Compute handles key for change detection
   */
  const handlesKey = useMemo(() => {
    if (!handles || handles.length === 0) return "";

    const sorted = [...handles].sort();
    return JSON.stringify(sorted);
  }, [handles]);

  /**
   * Check if decryption is possible
   */
  const canDecrypt = useMemo(() => {
    return Boolean(
      instance &&
        handles &&
        handles.length > 0 &&
        !isDecrypting
    );
  }, [instance, handles, isDecrypting]);

  /**
   * Main public decryption function
   */
  const decrypt = useCallback(async () => {
    if (isDecryptingRef.current) {
      console.warn("Already decrypting");
      return;
    }

    if (!instanceRef.current || !handles || handles.length === 0) {
      console.warn("Cannot decrypt: missing instance or handles");
      return;
    }

    const thisInstance = instanceRef.current;

    setIsDecrypting(true);
    setMessage("Starting public decryption...");
    setError(null);

    try {
      // Check if stale (instance changed)
      const isStale = () => thisInstance !== instanceRef.current;

      if (isStale()) {
        setMessage("Request stale, skipping");
        return;
      }

      setMessage("Calling Relayer HTTP endpoint...");

      // Call the publicDecrypt method from the core client
      const decryptionResults = await thisInstance.publicDecrypt([...handles]);

      if (isStale()) {
        setMessage("Request stale, ignoring results");
        return;
      }

      setResults(decryptionResults);
      setMessage("Public decryption completed!");
    } catch (err) {
      const error = err as Error;
      setError(error.message || "Public decryption failed");
      setMessage("Public decryption failed");
      console.error("Public decryption error:", error);
    } finally {
      setIsDecrypting(false);
    }
  }, [handles]);

  /**
   * Decrypt with custom handles
   */
  const decryptHandles = useCallback(
    async (
      customHandles: string[]
    ): Promise<Record<string, string | bigint | boolean>> => {
      if (!instance) {
        throw new Error("Cannot decrypt: missing instance");
      }

      setIsDecrypting(true);
      setMessage("Decrypting custom handles...");
      setError(null);

      try {
        const results = await instance.publicDecrypt(customHandles);

        setMessage("Custom public decryption completed!");
        return results;
      } catch (err) {
        const error = err as Error;
        setError(error.message || "Custom public decryption failed");
        setMessage("Custom public decryption failed");
        throw error;
      } finally {
        setIsDecrypting(false);
      }
    },
    [instance]
  );

  /**
   * Decrypt a single handle
   */
  const decryptSingle = useCallback(
    async (handle: string): Promise<string | bigint | boolean> => {
      if (!instance) {
        throw new Error("Cannot decrypt: missing instance");
      }

      setIsDecrypting(true);
      setMessage(`Decrypting handle ${handle}...`);
      setError(null);

      try {
        const results = await instance.publicDecrypt([handle]);

        setMessage("Single public decryption completed!");

        const result = results[handle];
        if (result === undefined) {
          throw new Error(`No result found for handle ${handle}`);
        }

        return result;
      } catch (err) {
        const error = err as Error;
        setError(error.message || "Single public decryption failed");
        setMessage("Single public decryption failed");
        throw error;
      } finally {
        setIsDecrypting(false);
      }
    },
    [instance]
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
   * Auto-decrypt when handles change
   */
  useEffect(() => {
    if (autoDecrypt && canDecrypt) {
      decrypt();
    }
  }, [autoDecrypt, canDecrypt, handlesKey, decrypt]);

  return {
    canDecrypt,
    isDecrypting,
    results,
    message,
    error,
    decrypt,
    decryptHandles,
    decryptSingle,
    clearResults,
    setMessage,
    setError,
  };
}
