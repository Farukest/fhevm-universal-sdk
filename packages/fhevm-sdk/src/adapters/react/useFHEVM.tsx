/**
 * @fileoverview Main React hook for FHEVM - Wagmi-style API
 * @module @fhevm-sdk/react
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FHEVMClient, type FHEVMClientConfig, type FHEVMClientStatus } from "../../core/client";
import type { FhevmInstance } from "../../fhevmTypes";

/**
 * Configuration for useFHEVM hook
 */
export interface UseFHEVMConfig extends Omit<FHEVMClientConfig, "autoInit"> {
  /** Enable automatic initialization (default: true) */
  enabled?: boolean;
}

/**
 * Return type of useFHEVM hook
 */
export interface UseFHEVMResult {
  /** FHEVM client instance */
  client: FHEVMClient | undefined;

  /** Underlying FHEVM instance (from Zama SDK) */
  instance: FhevmInstance | undefined;

  /** Current status of the client */
  status: FHEVMClientStatus;

  /** Whether the client is ready for operations */
  isReady: boolean;

  /** Whether the client is currently initializing */
  isLoading: boolean;

  /** Last error encountered */
  error: Error | undefined;

  /** Manually trigger initialization */
  init: () => Promise<void>;

  /** Reinitialize with new configuration */
  reinit: (config?: Partial<FHEVMClientConfig>) => Promise<void>;

  /** Abort ongoing initialization */
  abort: () => void;
}

/**
 * Main React hook for FHEVM - Wagmi-style API
 *
 * This hook manages the FHEVM client lifecycle and provides easy access
 * to encryption/decryption functionality in React applications.
 *
 * Features:
 * - Automatic initialization on mount
 * - Automatic cleanup on unmount
 * - React to provider/chainId changes
 * - Loading and error states
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { instance, isReady, error } = useFHEVM({
 *     provider: window.ethereum,
 *     chainId: 11155111,
 *   });
 *
 *   if (!isReady) return <div>Loading FHEVM...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *
 *   return <div>FHEVM Ready!</div>;
 * }
 * ```
 */
export function useFHEVM(config: {
  provider: any;
  chainId: number | undefined;
  mockChains: { 31337: string };
  enabled: boolean
}): UseFHEVMResult {
  const { enabled = true } = config;

  const [client, setClient] = useState<FHEVMClient | undefined>(undefined);
  const [status, setStatus] = useState<FHEVMClientStatus>("idle");
  const [error, setError] = useState<Error | undefined>(undefined);

  // Refs to track current state
  const clientRef = useRef<FHEVMClient | undefined>(undefined);
  const providerRef = useRef(config.provider);
  const chainIdRef = useRef(config.chainId);
  const enabledRef = useRef(enabled);

  // Update refs
  providerRef.current = config.provider;
  chainIdRef.current = config.chainId;
  enabledRef.current = enabled;

  /**
   * Initialize the FHEVM client
   */
  const init = useCallback(async () => {
    if (!enabledRef.current) {
      return;
    }

    if (!providerRef.current) {
      setError(new Error("No provider configured"));
      setStatus("error");
      return;
    }

    try {
      // Create new client
      const newClient = new FHEVMClient({
        provider: providerRef.current,
        chainId: chainIdRef.current,
        mockChains: config.mockChains,
      });

      // Subscribe to status changes
      newClient.onStatusChange((newStatus) => {
        setStatus(newStatus);
      });

      // Store client
      clientRef.current = newClient;
      setClient(newClient);
      setError(undefined);

      // Initialize
      await newClient.init();
    } catch (err) {
      setError(err as Error);
      setStatus("error");
    }
  }, []); // Empty deps - use refs instead

  /**
   * Reinitialize with new configuration
   */
  const reinit = useCallback(
    async (newConfig?: Partial<FHEVMClientConfig>) => {
      if (clientRef.current) {
        await clientRef.current.reinit(newConfig);
      } else {
        await init();
      }
    },
    [init]
  );

  /**
   * Abort ongoing initialization
   */
  const abort = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.abort();
    }
  }, []);

  /**
   * Effect: Initialize on mount or when provider/chainId changes
   */
  useEffect(() => {
    if (!enabled) {
      // Clean up if disabled
      if (clientRef.current) {
        clientRef.current.dispose();
        clientRef.current = undefined;
        setClient(undefined);
        setStatus("idle");
        setError(undefined);
      }
      return;
    }

    // Initialize
    init();

    // Cleanup on unmount
    return () => {
      if (clientRef.current) {
        clientRef.current.dispose();
        clientRef.current = undefined;
      }
    };
  }, [enabled, config.provider, config.chainId]); // Don't include init - it's stable now

  /**
   * Get the underlying FHEVM instance
   */
  const instance = client?.isReady ? client.getInstance() : undefined;

  return {
    client,
    instance,
    status,
    isReady: status === "ready",
    isLoading: status === "initializing",
    error,
    init,
    reinit,
    abort,
  };
}
