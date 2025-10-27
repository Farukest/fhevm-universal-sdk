/**
 * @fileoverview Vue composable for FHEVM
 * @module @fhevm-sdk/vue
 */

import { ref, computed, onMounted, onUnmounted, watch, type Ref } from "vue";
import { FHEVMClient, type FHEVMClientConfig, type FHEVMClientStatus } from "../../core/client";
import type { FhevmInstance } from "../../fhevmTypes";

/**
 * Configuration for useFHEVM composable
 */
export interface UseFHEVMConfig extends Omit<FHEVMClientConfig, "autoInit"> {
  /** Enable automatic initialization (default: true) */
  enabled?: boolean;
}

/**
 * Return type of useFHEVM composable
 */
export interface UseFHEVMComposable {
  /** FHEVM client instance */
  client: Ref<FHEVMClient | undefined>;

  /** Underlying FHEVM instance (from Zama SDK) */
  instance: Ref<FhevmInstance | undefined>;

  /** Current status of the client */
  status: Ref<FHEVMClientStatus>;

  /** Whether the client is ready for operations */
  isReady: Ref<boolean>;

  /** Whether the client is currently initializing */
  isLoading: Ref<boolean>;

  /** Last error encountered */
  error: Ref<Error | undefined>;

  /** Manually trigger initialization */
  init: () => Promise<void>;

  /** Reinitialize with new configuration */
  reinit: (config?: Partial<FHEVMClientConfig>) => Promise<void>;

  /** Abort ongoing initialization */
  abort: () => void;
}

/**
 * Vue composable for FHEVM - Vue 3 Composition API
 *
 * This composable manages the FHEVM client lifecycle and provides easy access
 * to encryption/decryption functionality in Vue 3 applications.
 *
 * Features:
 * - Automatic initialization on mount
 * - Automatic cleanup on unmount
 * - Reactive to provider/chainId changes
 * - Loading and error states
 *
 * @example
 * ```vue
 * <script setup>
 * import { useFHEVM } from '@fhevm-sdk/vue';
 *
 * const { instance, isReady, error } = useFHEVM({
 *   provider: window.ethereum,
 *   chainId: 11155111,
 * });
 * </script>
 *
 * <template>
 *   <div v-if="!isReady">Loading FHEVM...</div>
 *   <div v-else-if="error">Error: {{ error.message }}</div>
 *   <div v-else>FHEVM Ready!</div>
 * </template>
 * ```
 */
export function useFHEVM(config: UseFHEVMConfig): UseFHEVMComposable {
  const { enabled = true, ...clientConfig } = config;

  const client: Ref<FHEVMClient | undefined> = ref(undefined);
  const status: Ref<FHEVMClientStatus> = ref("idle");
  const error: Ref<Error | undefined> = ref(undefined);
  const instance: Ref<FhevmInstance | undefined> = ref(undefined);

  const isReady = computed(() => status.value === "ready");
  const isLoading = computed(() => status.value === "initializing");

  /**
   * Initialize the FHEVM client
   */
  const init = async () => {
    if (!enabled) {
      return;
    }

    if (!config.provider) {
      error.value = new Error("No provider configured");
      status.value = "error";
      return;
    }

    try {
      // Create new client
      const newClient = new FHEVMClient({
        ...clientConfig,
        provider: config.provider,
      });

      // Subscribe to status changes
      newClient.onStatusChange((newStatus) => {
        status.value = newStatus;

        // Update instance when ready
        if (newStatus === "ready") {
          instance.value = newClient.getInstance();
        } else {
          instance.value = undefined;
        }
      });

      // Store client
      client.value = newClient;
      error.value = undefined;

      // Initialize
      await newClient.init();
    } catch (err) {
      error.value = err as Error;
      status.value = "error";
    }
  };

  /**
   * Reinitialize with new configuration
   */
  const reinit = async (newConfig?: Partial<FHEVMClientConfig>) => {
    if (client.value) {
      await client.value.reinit(newConfig);
    } else {
      await init();
    }
  };

  /**
   * Abort ongoing initialization
   */
  const abort = () => {
    if (client.value) {
      client.value.abort();
    }
  };

  /**
   * Cleanup function
   */
  const cleanup = () => {
    if (client.value) {
      client.value.dispose();
      client.value = undefined;
      instance.value = undefined;
      status.value = "idle";
      error.value = undefined;
    }
  };

  /**
   * Initialize on mount
   */
  onMounted(() => {
    if (enabled) {
      init();
    }
  });

  /**
   * Cleanup on unmount
   */
  onUnmounted(() => {
    cleanup();
  });

  /**
   * Watch for enabled changes
   */
  watch(
    () => enabled,
    (newEnabled) => {
      if (newEnabled) {
        init();
      } else {
        cleanup();
      }
    }
  );

  /**
   * Watch for provider/chainId changes
   */
  watch(
    () => [config.provider, config.chainId] as const,
    () => {
      if (enabled) {
        cleanup();
        init();
      }
    }
  );

  return {
    client,
    instance,
    status,
    isReady,
    isLoading,
    error,
    init,
    reinit,
    abort,
  };
}
