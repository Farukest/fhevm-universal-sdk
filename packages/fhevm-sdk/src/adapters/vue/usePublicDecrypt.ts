/**
 * @fileoverview Vue composable for FHE public decryption (no wallet signature required)
 * @module @fhevm-sdk/vue
 */

import { ref, computed, watch, toRaw, type Ref } from "vue";
import type { FhevmInstance } from "../../fhevmTypes";

/**
 * Configuration for public decryption composable
 */
export interface UsePublicDecryptConfig {
  /** FHEVM instance */
  instance: Ref<FhevmInstance | undefined>;

  /** Handles to decrypt */
  handles?: Ref<readonly string[] | undefined>;

  /** Auto-decrypt when handles change (default: false) */
  autoDecrypt?: boolean;
}

/**
 * Return type for usePublicDecrypt composable
 */
export interface UsePublicDecryptComposable {
  /** Whether decryption is ready */
  canDecrypt: Ref<boolean>;

  /** Whether currently decrypting */
  isDecrypting: Ref<boolean>;

  /** Decrypted results mapped by handle */
  results: Ref<Record<string, string | bigint | boolean>>;

  /** Current status message */
  message: Ref<string>;

  /** Error if decryption failed */
  error: Ref<string | null>;

  /** Trigger public decryption */
  decrypt: () => Promise<void>;

  /** Decrypt specific handles (overrides config.handles) */
  decryptHandles: (handles: string[]) => Promise<Record<string, string | bigint | boolean>>;

  /** Decrypt a single handle */
  decryptSingle: (handle: string) => Promise<string | bigint | boolean>;

  /** Clear current results */
  clearResults: () => void;
}

/**
 * Vue composable for FHE public decryption operations
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
 * ```vue
 * <script setup>
 * import { ref } from 'vue';
 * import { useFHEVM, usePublicDecrypt } from '@fhevm-sdk/vue';
 *
 * const { instance } = useFHEVM({ provider: window.ethereum });
 * const handles = ref([
 *   '0x830a61b343d2f3de67ec59cb18961fd086085c1c73ff0000000000aa36a70000',
 *   '0x98ee526413903d4613feedb9c8fa44fe3f4ed0dd00ff0000000000aa36a70400',
 * ]);
 *
 * const {
 *   decrypt,
 *   isDecrypting,
 *   results,
 *   error
 * } = usePublicDecrypt({
 *   instance,
 *   handles
 * });
 * </script>
 *
 * <template>
 *   <button @click="decrypt" :disabled="isDecrypting">
 *     {{ isDecrypting ? 'Decrypting...' : 'Decrypt Public Values' }}
 *   </button>
 *   <div v-if="error">Error: {{ error }}</div>
 *   <div v-if="results">Results: {{ JSON.stringify(results) }}</div>
 * </template>
 * ```
 */
export function usePublicDecrypt(config: UsePublicDecryptConfig): UsePublicDecryptComposable {
  const {
    instance,
    handles,
    autoDecrypt = false,
  } = config;

  const isDecrypting = ref(false);
  const message = ref("");
  const results = ref<Record<string, string | bigint | boolean>>({});
  const error = ref<string | null>(null);

  /**
   * Check if decryption is possible
   */
  const canDecrypt = computed(() => {
    return Boolean(
      instance.value &&
        handles?.value &&
        handles.value.length > 0 &&
        !isDecrypting.value
    );
  });

  /**
   * Main public decryption function
   */
  const decrypt = async () => {
    if (isDecrypting.value) {
      console.warn("Already decrypting");
      return;
    }

    if (!instance.value || !handles?.value || handles.value.length === 0) {
      console.warn("Cannot decrypt: missing instance or handles");
      return;
    }

    // Unwrap Vue Proxy to avoid issues with private class members
    const rawInstance = toRaw(instance.value);
    const handlesToDecrypt = [...handles.value];

    isDecrypting.value = true;
    message.value = "Starting public decryption...";
    error.value = null;

    try {
      message.value = "Calling Relayer HTTP endpoint...";

      // Call the publicDecrypt method from the core client
      const decryptionResults = await rawInstance.publicDecrypt(handlesToDecrypt);

      results.value = decryptionResults;
      message.value = "Public decryption completed!";
    } catch (err) {
      const errorObj = err as Error;
      error.value = errorObj.message || "Public decryption failed";
      message.value = "Public decryption failed";
      console.error("Public decryption error:", errorObj);
    } finally {
      isDecrypting.value = false;
    }
  };

  /**
   * Decrypt with custom handles
   */
  const decryptHandles = async (
    customHandles: string[]
  ): Promise<Record<string, string | bigint | boolean>> => {
    if (!instance.value) {
      throw new Error("Cannot decrypt: missing instance");
    }

    // Unwrap Vue Proxy
    const rawInstance = toRaw(instance.value);

    isDecrypting.value = true;
    message.value = "Decrypting custom handles...";
    error.value = null;

    try {
      const result = await rawInstance.publicDecrypt(customHandles);

      message.value = "Custom public decryption completed!";
      return result;
    } catch (err) {
      const errorObj = err as Error;
      error.value = errorObj.message || "Custom public decryption failed";
      message.value = "Custom public decryption failed";
      throw errorObj;
    } finally {
      isDecrypting.value = false;
    }
  };

  /**
   * Decrypt a single handle
   */
  const decryptSingle = async (handle: string): Promise<string | bigint | boolean> => {
    if (!instance.value) {
      throw new Error("Cannot decrypt: missing instance");
    }

    // Unwrap Vue Proxy
    const rawInstance = toRaw(instance.value);

    isDecrypting.value = true;
    message.value = `Decrypting handle ${handle}...`;
    error.value = null;

    try {
      const result = await rawInstance.publicDecrypt([handle]);

      message.value = "Single public decryption completed!";

      const decryptedValue = result[handle];
      if (decryptedValue === undefined) {
        throw new Error(`No result found for handle ${handle}`);
      }

      return decryptedValue;
    } catch (err) {
      const errorObj = err as Error;
      error.value = errorObj.message || "Single public decryption failed";
      message.value = "Single public decryption failed";
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
   * Auto-decrypt when handles change
   */
  watch(
    () => [handles?.value, canDecrypt.value],
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
    decryptHandles,
    decryptSingle,
    clearResults,
  };
}
