<script setup lang="ts">
import { ref, computed } from 'vue';
import { useFHEVM } from 'uni-fhevm-sdk/vue';

console.log('[STEP 2] Testing useFHEVM composable');

const testResult = ref('Testing useFHEVM...');
const logs = ref<string[]>([]);

function addLog(message: string) {
  console.log(message);
  logs.value.push(message);
}

// Step 2a: Test with enabled = false (no provider)
addLog('[TEST] Creating useFHEVM with enabled=false');

const enabled = ref(false);

const { instance, status, error, isReady } = useFHEVM({
  provider: null as any,
  chainId: 31337,
  mockChains: { 31337: 'http://localhost:8545' },
  gatewayUrl: 'http://localhost:8545',
  enabled: enabled
});

addLog('[TEST] useFHEVM created. Initial status: ' + status.value);

// Watch status changes
import { watch } from 'vue';
watch([status, error, isReady], ([s, e, r]) => {
  addLog(`[WATCH] Status: ${s}, Error: ${e?.message || 'none'}, Ready: ${r}`);
});

// Step 2b: Enable after 2 seconds to see if it tries to init
setTimeout(() => {
  addLog('[TEST] Enabling useFHEVM (enabled=true)...');
  enabled.value = true;
  addLog('[TEST] After enable, status: ' + status.value);
}, 2000);

testResult.value = 'useFHEVM composable test running...';
</script>

<template>
  <div class="p-8">
    <h1 class="text-2xl font-bold mb-4">Step 2: useFHEVM Composable Test</h1>

    <div class="mb-4 p-4 bg-blue-100 border border-blue-300">
      <strong>Status:</strong> {{ testResult }}
    </div>

    <div class="mb-4 p-4 bg-gray-100 border">
      <strong>FHEVM Status:</strong> {{ status }}<br>
      <strong>Is Ready:</strong> {{ isReady }}<br>
      <strong>Error:</strong> {{ error?.message || 'none' }}<br>
      <strong>Has Instance:</strong> {{ !!instance }}
    </div>

    <div class="p-4 bg-white border">
      <h3 class="font-bold mb-2">Console Logs:</h3>
      <div v-for="(log, i) in logs" :key="i" class="text-sm font-mono">
        {{ log }}
      </div>
    </div>
  </div>
</template>
