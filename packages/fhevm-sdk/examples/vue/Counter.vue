<script setup lang="ts">
import { ref, computed } from 'vue';
import { useFHEVM, useFHEEncrypt, useFHEDecrypt } from 'fhevm-sdk/vue';
import { ethers } from 'ethers';

const CONTRACT_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
const CONTRACT_ABI = [
  'function getCount() view returns (bytes32)',
  'function increment(bytes32 encryptedValue, bytes proof)',
  'function decrement(bytes32 encryptedValue, bytes proof)',
];

const provider = ref(window.ethereum);
const signer = ref();
const countHandle = ref<string>();

// Initialize signer
if (provider.value) {
  new ethers.BrowserProvider(provider.value).getSigner().then(s => {
    signer.value = s;
  });
}

// Initialize FHEVM
const { instance, isReady, error: fhevmError } = useFHEVM({
  provider,
  chainId: ref(11155111),
});

// Encryption
const { encryptUint32, canEncrypt } = useFHEEncrypt({
  instance,
  signer,
  contractAddress: ref(CONTRACT_ADDRESS),
});

// Decryption
const requests = computed(() =>
  countHandle.value
    ? [{ handle: countHandle.value, contractAddress: CONTRACT_ADDRESS }]
    : undefined
);

const { decrypt, results, canDecrypt, isDecrypting } = useFHEDecrypt({
  instance,
  signer,
  requests,
});

// Contract instance
const contract = computed(() =>
  signer.value
    ? new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer.value)
    : null
);

// Handlers
const handleIncrement = async () => {
  if (!contract.value || !canEncrypt.value) return;

  try {
    const encrypted = await encryptUint32(1);
    const tx = await contract.value.increment(encrypted.data, encrypted.inputProof);
    await tx.wait();
    await refreshCount();
  } catch (error) {
    console.error('Increment failed:', error);
  }
};

const handleDecrement = async () => {
  if (!contract.value || !canEncrypt.value) return;

  try {
    const encrypted = await encryptUint32(1);
    const tx = await contract.value.decrement(encrypted.data, encrypted.inputProof);
    await tx.wait();
    await refreshCount();
  } catch (error) {
    console.error('Decrement failed:', error);
  }
};

const refreshCount = async () => {
  if (!contract.value) return;

  try {
    const handle = await contract.value.getCount();
    countHandle.value = handle;
  } catch (error) {
    console.error('Failed to get count:', error);
  }
};

const handleDecrypt = async () => {
  if (!canDecrypt.value) return;

  try {
    await decrypt();
  } catch (error) {
    console.error('Decryption failed:', error);
  }
};

const decryptedValue = computed(() =>
  countHandle.value && results.value ? results.value[countHandle.value] : null
);
</script>

<template>
  <div>
    <h2>FHE Counter</h2>

    <div v-if="!isReady">Initializing FHEVM...</div>
    <div v-else-if="fhevmError">Error: {{ fhevmError.message }}</div>
    <div v-else>
      <div>
        <p>Encrypted Handle: {{ countHandle || 'N/A' }}</p>
        <p>Decrypted Value: {{ decryptedValue?.toString() || 'Not decrypted' }}</p>
      </div>

      <div>
        <button @click="handleIncrement" :disabled="!canEncrypt">
          Increment
        </button>
        <button @click="handleDecrement" :disabled="!canEncrypt">
          Decrement
        </button>
        <button @click="handleDecrypt" :disabled="!canDecrypt || isDecrypting">
          {{ isDecrypting ? 'Decrypting...' : 'Decrypt' }}
        </button>
        <button @click="refreshCount">
          Refresh
        </button>
      </div>
    </div>
  </div>
</template>
