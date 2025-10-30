/**
 * @fileoverview Vue composable for FHEVM - Wagmi-style API
 * @module @fhevm-sdk/vue
 */

import { ref, computed, watch, onUnmounted, toValue, type Ref, type MaybeRefOrGetter } from "vue";
import { FHEVMClient, type FHEVMClientConfig, type FHEVMClientStatus } from "../../core/client";
import type { FhevmInstance } from "../../fhevmTypes";

export interface UseFHEVMConfig extends Omit<FHEVMClientConfig, "autoInit"> {
  enabled?: MaybeRefOrGetter<boolean>;
}

export interface UseFHEVMComposable {
  client: Ref<FHEVMClient | undefined>;
  instance: Ref<FhevmInstance | undefined>;
  status: Ref<FHEVMClientStatus>;
  isReady: Ref<boolean>;
  isLoading: Ref<boolean>;
  error: Ref<Error | undefined>;
  init: () => Promise<void>;
  reinit: (config?: Partial<FHEVMClientConfig>) => Promise<void>;
  abort: () => void;
}

export function useFHEVM(config: UseFHEVMConfig): UseFHEVMComposable {
  const { enabled = true, ...clientConfig } = config;

  const client = ref<FHEVMClient | undefined>();
  const status = ref<FHEVMClientStatus>("idle");
  const error = ref<Error | undefined>();
  const instance = ref<FhevmInstance | undefined>();

  const isReady = computed(() => status.value === "ready");
  const isLoading = computed(() => status.value === "initializing");

  const init = async () => {
    const enabledValue = toValue(enabled);

    if (!enabledValue) {
      return;
    }

    const providerValue = toValue(config.provider);

    if (!providerValue) {
      error.value = new Error("No provider configured");
      status.value = "error";
      return;
    }

    try {
      const newClient = new FHEVMClient({
        ...clientConfig,
        provider: providerValue,
        chainId: toValue(config.chainId),
      });

      newClient.onStatusChange((newStatus) => {
        status.value = newStatus;
        instance.value = newStatus === "ready" ? newClient.getInstance() : undefined;
      });

      client.value = newClient;
      error.value = undefined;

      await newClient.init();
    } catch (err) {
      console.error('[SDK] Init error:', err);
      error.value = err as Error;
      status.value = "error";
    }
  };

  const reinit = async (newConfig?: Partial<FHEVMClientConfig>) => {
    if (client.value) {
      await client.value.reinit(newConfig);
    } else {
      await init();
    }
  };

  const abort = () => {
    client.value?.abort();
  };

  const cleanup = () => {
    if (client.value) {
      client.value.dispose();
      client.value = undefined;
      instance.value = undefined;
      status.value = "idle";
      error.value = undefined;
    }
  };

  // Watch enabled - initialize when it becomes true
  watch(
    () => toValue(enabled),
    (newEnabled) => {
      if (newEnabled) {
        init();
      } else {
        cleanup();
      }
    },
    { immediate: true }  // IMMEDIATE: Bu sayede ilk render'da da çalışır
  );

  // Watch provider/chainId changes - reinitialize
  watch(
    () => [toValue(config.provider), toValue(config.chainId)] as const,
    ([newProvider, newChainId]) => {
      if (toValue(enabled)) {
        cleanup();
        init();
      }
    }
  );

  // Cleanup on unmount
  onUnmounted(() => {
    cleanup();
  });

  return { client, instance, status, isReady, isLoading, error, init, reinit, abort };
}
