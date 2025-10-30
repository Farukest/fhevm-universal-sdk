/**
 * @fileoverview Vue composable for FHE decryption
 * @module @fhevm-sdk/vue
 */

import { ref, computed, watch, toRaw, type Ref } from "vue";
import type { FhevmInstance } from "../../fhevmTypes";
import type { JsonRpcSigner } from "ethers";
import { DecryptionManager, type DecryptionRequest, type DecryptionResults, type DecryptionConfig } from "../../core/decryption";
import { GenericStringStorage } from "../../storage/GenericStringStorage";

/**
 * Configuration for decryption composable
 */
export interface UseFHEDecryptConfig {
  /** FHEVM instance */
  instance: Ref<FhevmInstance | undefined>;

  /** Ethers signer for EIP-712 signing */
  signer: Ref<JsonRpcSigner | undefined>;

  /** Decryption requests */
  requests?: Ref<readonly DecryptionRequest[] | undefined>;

  /** Storage for caching signatures */
  signatureStorage?: GenericStringStorage;

  /** Chain ID (used for cache invalidation) */
  chainId?: Ref<number | undefined>;

  /** Auto-decrypt when requests change (default: false) */
  autoDecrypt?: boolean;
}

/**
 * Return type for useFHEDecrypt composable
 */
export interface UseFHEDecryptComposable {
  /** Whether decryption is ready */
  canDecrypt: Ref<boolean>;

  /** Whether currently decrypting */
  isDecrypting: Ref<boolean>;

  /** Decrypted results */
  results: Ref<DecryptionResults>;

  /** Current status message */
  message: Ref<string>;

  /** Error if decryption failed */
  error: Ref<string | null>;

  /** Trigger decryption */
  decrypt: () => Promise<void>;

  /** Decrypt specific requests (overrides config.requests) */
  decryptRequests: (requests: DecryptionRequest[], config?: DecryptionConfig) => Promise<DecryptionResults>;

  /** Decrypt a single value */
  decryptSingle: (handle: string, contractAddress: `0x${string}`) => Promise<string | bigint | boolean>;

  /** Public decrypt handles (no signature needed) */
  publicDecrypt: (handles: (string | Uint8Array)[]) => Promise<DecryptionResults>;

  /** Public decrypt a single handle */
  publicDecryptSingle: (handle: string | Uint8Array) => Promise<string | bigint | boolean>;

  /** Clear current results */
  clearResults: () => void;
}

/**
 * Vue composable for FHE decryption operations
 *
 * Provides decryption functionality with automatic caching
 * of EIP-712 signatures for improved UX.
 *
 * @example
 * ```vue
 * <script setup>
 * import { ref } from 'vue';
 * import { useFHEVM, useFHEDecrypt } from '@fhevm-sdk/vue';
 *
 * const { instance } = useFHEVM({ provider: window.ethereum });
 * const signer = ref(mySigner);
 * const requests = ref([
 *   { handle: '0x...', contractAddress: '0x...' }
 * ]);
 *
 * const {
 *   decrypt,
 *   isDecrypting,
 *   results,
 *   error
 * } = useFHEDecrypt({
 *   instance,
 *   signer,
 *   requests
 * });
 * </script>
 *
 * <template>
 *   <button @click="decrypt" :disabled="isDecrypting">
 *     {{ isDecrypting ? 'Decrypting...' : 'Decrypt' }}
 *   </button>
 *   <div v-if="error">Error: {{ error }}</div>
 *   <div v-if="results">Result: {{ JSON.stringify(results) }}</div>
 * </template>
 * ```
 */
export function useFHEDecrypt(config: UseFHEDecryptConfig): UseFHEDecryptComposable {
  const {
    instance,
    signer,
    requests,
    signatureStorage,
    chainId,
    autoDecrypt = false,
  } = config;

  const isDecrypting = ref(false);
  const message = ref("");
  const results = ref<DecryptionResults>({});
  const error = ref<string | null>(null);

  const manager = ref<DecryptionManager | undefined>(undefined);

  /**
   * Create decryption manager when instance changes
   */
  watch(
    () => instance.value,
    (newInstance) => {
      if (newInstance) {
        // Unwrap Vue Proxy for instance to avoid issues with private class members
        const rawInstance = toRaw(newInstance);
        manager.value = new DecryptionManager(rawInstance);
      } else {
        manager.value = undefined;
      }
    },
    { immediate: true }
  );

  /**
   * Check if decryption is possible
   */
  const canDecrypt = computed(() => {
    return Boolean(
      instance.value &&
        signer.value &&
        requests?.value &&
        requests.value.length > 0 &&
        !isDecrypting.value
    );
  });

  /**
   * Main decryption function
   */
  const decrypt = async () => {
    if (isDecrypting.value) {
      console.warn("Already decrypting");
      return;
    }

    if (!instance.value || !signer.value || !requests?.value || requests.value.length === 0) {
      console.warn("Cannot decrypt: missing instance, signer, or requests");
      return;
    }

    // ALWAYS create fresh manager with unwrapped instance and signer
    const rawInstance = toRaw(instance.value);
    const rawSigner = toRaw(signer.value);
    const thisChainId = chainId?.value;

    isDecrypting.value = true;
    message.value = "Starting decryption...";
    error.value = null;

    try {
      // Check if stale
      const isStale = () =>
        rawSigner !== toRaw(signer.value) || thisChainId !== chainId?.value;

      if (isStale()) {
        message.value = "Request stale, skipping";
        return;
      }

      message.value = "Creating decryption signature...";

      const freshManager = new DecryptionManager(rawInstance);
      const decryptionResults = await freshManager.decrypt(
        requests.value.map(r => ({ handle: r.handle, contractAddress: r.contractAddress })),
        rawSigner,
        { signatureStorage }
      );

      if (isStale()) {
        message.value = "Request stale, ignoring results";
        return;
      }

      results.value = decryptionResults;
      message.value = "Decryption completed!";
    } catch (err) {
      const errorObj = err as Error;
      error.value = errorObj.message || "Decryption failed";
      message.value = "Decryption failed";
      console.error("Decryption error:", errorObj);
    } finally {
      isDecrypting.value = false;
    }
  };

  /**
   * Decrypt with custom requests
   */
  const decryptRequests = async (
    customRequests: DecryptionRequest[],
    decryptConfig?: DecryptionConfig
  ): Promise<DecryptionResults> => {
    if (!instance.value || !signer.value) {
      throw new Error("Cannot decrypt: missing instance or signer");
    }

    isDecrypting.value = true;
    message.value = "Decrypting custom requests...";
    error.value = null;

    try {
      // ALWAYS create fresh manager with unwrapped instance and signer
      const rawInstance = toRaw(instance.value);
      const rawSigner = toRaw(signer.value);
      const freshManager = new DecryptionManager(rawInstance);

      const decryptResults = await freshManager.decrypt(
        customRequests,
        rawSigner,
        {
          signatureStorage,
          ...decryptConfig,
        }
      );

      message.value = "Custom decryption completed!";
      return decryptResults;
    } catch (err) {
      const errorObj = err as Error;
      error.value = errorObj.message || "Custom decryption failed";
      message.value = "Custom decryption failed";
      throw errorObj;
    } finally {
      isDecrypting.value = false;
    }
  };

  /**
   * Decrypt a single value
   */
  const decryptSingle = async (
    handle: string,
    contractAddress: `0x${string}`
  ): Promise<string | bigint | boolean> => {
    if (!instance.value || !signer.value) {
      throw new Error("Cannot decrypt: missing instance or signer");
    }

    isDecrypting.value = true;
    message.value = `Decrypting handle ${handle}...`;
    error.value = null;

    try {
      // ALWAYS create fresh manager with unwrapped instance and signer
      const rawInstance = toRaw(instance.value);
      const rawSigner = toRaw(signer.value);
      const freshManager = new DecryptionManager(rawInstance);

      const result = await freshManager.decryptSingle(
        handle,
        contractAddress,
        rawSigner,
        { signatureStorage }
      );

      message.value = "Single decryption completed!";
      return result;
    } catch (err) {
      const errorObj = err as Error;
      error.value = errorObj.message || "Single decryption failed";
      message.value = "Single decryption failed";
      throw errorObj;
    } finally {
      isDecrypting.value = false;
    }
  };

  /**
   * Public decrypt (no signature needed)
   */
  const publicDecrypt = async (handles: (string | Uint8Array)[]): Promise<DecryptionResults> => {
    if (!instance.value) {
      throw new Error("Cannot decrypt: missing instance");
    }

    // Unwrap Vue Proxy
    const rawInstance = toRaw(instance.value);

    isDecrypting.value = true;
    message.value = "Public decrypting...";
    error.value = null;

    try {
      const freshManager = new DecryptionManager(rawInstance);
      const result = await freshManager.publicDecrypt(handles);
      message.value = "Public decryption completed!";
      return result;
    } catch (err) {
      const errorObj = err as Error;
      error.value = errorObj.message || "Public decryption failed";
      message.value = "Public decryption failed";
      throw errorObj;
    } finally {
      isDecrypting.value = false;
    }
  };

  /**
   * Public decrypt a single handle
   */
  const publicDecryptSingle = async (handle: string | Uint8Array): Promise<string | bigint | boolean> => {
    if (!instance.value) {
      throw new Error("Cannot decrypt: missing instance");
    }

    // Unwrap Vue Proxy
    const rawInstance = toRaw(instance.value);

    isDecrypting.value = true;
    message.value = `Public decrypting handle...`;
    error.value = null;

    try {
      const freshManager = new DecryptionManager(rawInstance);
      const result = await freshManager.publicDecryptSingle(handle);
      message.value = "Public decryption completed!";
      return result;
    } catch (err) {
      const errorObj = err as Error;
      error.value = errorObj.message || "Public decryption failed";
      message.value = "Public decryption failed";
      throw errorObj;
    } finally {
      isDecrypting.value = false;
    }
  };

  /**
   * Clear results
   */
  const clearResults = () => {
    results.value = {};
    message.value = "";
    error.value = null;
  };

  /**
   * Auto-decrypt when requests change
   */
  watch(
    () => requests?.value,
    () => {
      if (autoDecrypt && canDecrypt.value) {
        decrypt();
      }
    },
    { deep: true }
  );

  return {
    canDecrypt,
    isDecrypting,
    results,
    message,
    error,
    decrypt,
    decryptRequests,
    decryptSingle,
    publicDecrypt,
    publicDecryptSingle,
    clearResults,
  };
}
