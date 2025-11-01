<script setup lang="ts">
import { ref, computed, watch, toRaw, onMounted } from 'vue';
import { useFHEVM, useFHEDecrypt } from 'uni-fhevm-sdk/vue';
import { GenericStringInMemoryStorage } from 'uni-fhevm-sdk/storage';
import { ethers } from 'ethers';
import FHECounterABI from './FHECounter.json';

// Contract addresses by network
const CONTRACT_ADDRESSES: Record<number, string> = {
  31337: '0x5FbDB2315678afecb367f032d93F642f64180aa3',      // Hardhat Local
  11155111: '0xA91422DBbfbc125C0A852281a391D89389C4D69C',  // Sepolia Testnet
};

// localStorage key for wallet connection
const WALLET_CONNECTED_KEY = 'fhevm_wallet_connected';

// FHEVM-supported networks
const SUPPORTED_NETWORKS: Record<number, string> = {
  31337: 'Hardhat Local',
  11155111: 'Sepolia Testnet',
};

// Wallet state
const isInitializing = ref<boolean>(true); // Prevents flash of wrong screen on page load
const account = ref<string | null>(null);
const ethersProvider = ref<ethers.BrowserProvider | null>(null);
const readonlyProvider = ref<ethers.JsonRpcProvider | null>(null);
const signer = ref<ethers.Signer | null>(null);
const chainId = ref<number | null>(null);
const isConnected = computed(() => !!account.value);

// Direct provider reference for FHEVM
const windowProvider = ref<any>(null);

// FHEVM instance - SDK will auto-detect mock mode for local chains
const { instance: fhevmInstance, status: fhevmStatus, error: fhevmError } = useFHEVM({
  provider: windowProvider,
  chainId: chainId,
});

// Counter state
const handle = ref<string | null>(null);

// Create signature storage for decryption
const signatureStorage = new GenericStringInMemoryStorage();

// Decryption requests - needed for useFHEDecrypt to create signature
const decryptionRequests = computed(() => {
  if (!handle.value || !contractAddress.value) return undefined;
  return [{ handle: handle.value, contractAddress: contractAddress.value as `0x${string}` }];
});

// FHE Decryption hook - cast signer to JsonRpcSigner
const { decryptSingle, decrypt, canDecrypt: canDecryptHook, publicDecryptSingle } = useFHEDecrypt({
  instance: fhevmInstance,
  signer: signer as any,
  signatureStorage: signatureStorage,
  chainId: chainId,
  requests: decryptionRequests
});


// Counter state (handle already defined above for decryptionRequests)
const clear = ref<number | null>(null);
const isDecrypted = ref(false);
const isRefreshing = ref(false);
const isDecrypting = ref(false);
const isProcessing = ref(false);
const message = ref<string>('');

// Computed states
const canGetCount = computed(() => isConnected.value && !isRefreshing.value && !!readonlyProvider.value);
const canDecrypt = computed(() => !!handle.value && !isDecrypting.value && !isDecrypted.value && !!fhevmInstance.value);
const canPublicDecrypt = computed(() => !!handle.value && !isDecrypting.value && !!fhevmInstance.value);
const canUpdateCounter = computed(() => isConnected.value && !isProcessing.value && !!fhevmInstance.value && !!signer.value);

// Dynamic network support check - based on chainId only (simpler and more reliable)
const isFhevmSupported = computed(() => {
  if (!chainId.value) return false;
  return chainId.value in SUPPORTED_NETWORKS;
});

const networkName = computed(() => {
  if (!chainId.value) return 'Unknown';
  return SUPPORTED_NETWORKS[chainId.value] || `Chain ${chainId.value}`;
});

const supportedNetworksList = computed(() => {
  return Object.entries(SUPPORTED_NETWORKS)
    .map(([id, name]) => `${name} (${id})`)
    .join(', ');
});

// Dynamic contract address based on connected network
const contractAddress = computed(() => {
  if (!chainId.value) return null;
  return CONTRACT_ADDRESSES[chainId.value] || null;
});

// Connect wallet
async function connectWallet() {
  try {
    if (typeof window.ethereum === 'undefined') {
      message.value = 'MetaMask is not installed';
      return;
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await provider.send('eth_requestAccounts', []);
    const network = await provider.getNetwork();

    ethersProvider.value = provider;
    windowProvider.value = window.ethereum;
    account.value = accounts[0];
    signer.value = new ethers.JsonRpcSigner(provider, accounts[0]);
    chainId.value = Number(network.chainId);

    // For Hardhat (31337), use localhost RPC. For Sepolia (11155111), use the connected provider
    if (chainId.value === 31337) {
      readonlyProvider.value = new ethers.JsonRpcProvider('http://localhost:8545');
    } else {
      readonlyProvider.value = provider;  // Use BrowserProvider for Sepolia
    }

    // Save connection to localStorage
    localStorage.setItem(WALLET_CONNECTED_KEY, 'true');

    // Mark initialization as complete
    isInitializing.value = false;

    message.value = `Connected to ${networkName.value}: ${account.value.slice(0, 6)}...${account.value.slice(-4)}`;

    // Listen for account changes
    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    // Auto-refresh count after connection (give FHEVM time to initialize)
    setTimeout(() => {
      if (fhevmInstance.value) {
        refreshCountHandle();
      }
    }, 1000);
  } catch (error: any) {
    message.value = `Error connecting: ${error.message}`;
  }
}

// Switch to Hardhat network
async function switchToHardhat() {
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x7a69' }], // 31337 in hex
    });
  } catch (switchError: any) {
    // This error code indicates that the chain has not been added to MetaMask
    if (switchError.code === 4902) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: '0x7a69',
              chainName: 'Hardhat Local',
              rpcUrls: ['http://127.0.0.1:8545'],
            },
          ],
        });
      } catch (addError: any) {
        message.value = `Failed to add network: ${addError.message}`;
      }
    } else {
      message.value = `Failed to switch network: ${switchError.message}`;
    }
  }
}

// Disconnect wallet
async function disconnectWallet() {
  ethersProvider.value = null;
  readonlyProvider.value = null;
  windowProvider.value = null;
  account.value = null;
  signer.value = null;
  chainId.value = null;
  handle.value = null;
  clear.value = null;
  isDecrypted.value = false;
  message.value = 'Wallet disconnected';

  // Clear localStorage
  localStorage.removeItem(WALLET_CONNECTED_KEY);

  // Remove listeners
  if (window.ethereum) {
    window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
    window.ethereum.removeListener('chainChanged', handleChainChanged);
  }
}

function handleAccountsChanged(accounts: string[]) {
  if (accounts.length === 0) {
    disconnectWallet();
  } else {
    account.value = accounts[0];
    message.value = `Account changed: ${account.value.slice(0, 6)}...${account.value.slice(-4)}`;
    refreshCountHandle();
  }
}

function handleChainChanged() {
  window.location.reload();
}

// Refresh count handle
async function refreshCountHandle() {
  if (!canGetCount.value || !readonlyProvider.value) {
    return;
  }

  try {
    isRefreshing.value = true;
    message.value = 'Fetching encrypted count handle...';

    // Use readonly provider for view functions
    const contract = new ethers.Contract(contractAddress.value, FHECounterABI.abi, toRaw(readonlyProvider.value));
    const countHandle = await contract.getCount();

    handle.value = countHandle.toString();
    isDecrypted.value = false;
    clear.value = null;
    message.value = `Got encrypted handle: ${handle.value.slice(0, 20)}...`;
  } catch (error: any) {
    message.value = `Error fetching count: ${error.message}`;
  } finally {
    isRefreshing.value = false;
  }
}

// Decrypt count handle
async function decryptCountHandle() {
  if (!canDecrypt.value || !handle.value || !fhevmInstance.value || !account.value) return;

  try {
    isDecrypting.value = true;
    message.value = 'Decrypting count handle...';

    // Use the decryptSingle method from useFHEDecrypt hook
    const decryptedValue = await decryptSingle(handle.value, contractAddress.value as `0x${string}`);

    clear.value = Number(decryptedValue);
    isDecrypted.value = true;
    message.value = `Decrypted value: ${clear.value}`;
  } catch (error: any) {
    message.value = `Error decrypting: ${error.message}`;
  } finally {
    isDecrypting.value = false;
  }
}

// Public decrypt count handle (no signature required)
async function publicDecryptCountHandle() {
  if (!canPublicDecrypt.value || !handle.value || !fhevmInstance.value) return;

  try {
    isDecrypting.value = true;
    message.value = 'Public decrypting count handle (no signature)...';

    const decryptedValue = await publicDecryptSingle(handle.value);

    clear.value = Number(decryptedValue);
    isDecrypted.value = true;
    message.value = `Public decrypted value: ${clear.value}`;
  } catch (error: any) {
    message.value = `Error public decrypting: ${error.message}`;
  } finally {
    isDecrypting.value = false;
  }
}

// Update counter (increment or decrement)
async function updateCounter(delta: number) {
  if (!canUpdateCounter.value || !signer.value || !fhevmInstance.value) return;

  try {
    isProcessing.value = true;
    const action = delta > 0 ? 'Incrementing' : 'Decrementing';
    message.value = `${action} counter...`;

    // Encrypt the input
    const input = await toRaw(fhevmInstance.value)!.createEncryptedInput(contractAddress.value, account.value!);
    input.add32(Math.abs(delta));
    const encryptedInput = await input.encrypt();

    // Call contract
    const contract = new ethers.Contract(contractAddress.value, FHECounterABI.abi, toRaw(signer.value));
    const tx = delta > 0
      ? await contract.increment(encryptedInput.handles[0], encryptedInput.inputProof)
      : await contract.decrement(encryptedInput.handles[0], encryptedInput.inputProof);

    message.value = `Transaction sent: ${tx.hash.slice(0, 10)}... Waiting for confirmation...`;
    await tx.wait();

    message.value = `Counter ${delta > 0 ? 'incremented' : 'decremented'} successfully!`;

    // Refresh handle after update
    setTimeout(() => refreshCountHandle(), 1000);
  } catch (error: any) {
    message.value = `Error updating counter: ${error.message}`;
  } finally {
    isProcessing.value = false;
  }
}

// Watch for FHEVM instance changes
watch(fhevmInstance, (newInstance) => {
  if (newInstance && isConnected.value) {
    message.value = `FHEVM initialized on ${networkName.value}!`;
  }
});

// Auto-connect on mount if previously connected
onMounted(async () => {
  const wasConnected = localStorage.getItem(WALLET_CONNECTED_KEY);

  if (wasConnected === 'true' && typeof window.ethereum !== 'undefined') {
    try {
      // Check if MetaMask has connected accounts
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send('eth_accounts', []); // Use eth_accounts instead of eth_requestAccounts

      if (accounts.length > 0) {
        // Silently reconnect
        const network = await provider.getNetwork();

        ethersProvider.value = provider;
        windowProvider.value = window.ethereum;
        account.value = accounts[0];
        signer.value = new ethers.JsonRpcSigner(provider, accounts[0]);
        chainId.value = Number(network.chainId);

        // For Hardhat (31337), use localhost RPC. For Sepolia (11155111), use the connected provider
        if (chainId.value === 31337) {
          readonlyProvider.value = new ethers.JsonRpcProvider('http://localhost:8545');
        } else {
          readonlyProvider.value = provider;  // Use BrowserProvider for Sepolia
        }

        message.value = `Auto-connected to ${networkName.value}: ${account.value.slice(0, 6)}...${account.value.slice(-4)}`;

        // Listen for account changes
        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', handleChainChanged);

        // Auto-refresh count after auto-connection (wait for FHEVM to initialize)
        setTimeout(() => {
          if (fhevmInstance.value) {
            refreshCountHandle();
          }
        }, 1500);

        // Mark initialization as complete after successful auto-connect
        isInitializing.value = false;
      } else {
        // No accounts connected - mark initialization as complete
        isInitializing.value = false;
      }
    } catch (error) {
      // Silent fail - user can manually connect
      localStorage.removeItem(WALLET_CONNECTED_KEY);
      isInitializing.value = false;
    }
  } else {
    // No localStorage flag or no MetaMask - mark initialization as complete immediately
    isInitializing.value = false;
  }
});
</script>

<template>
  <div class="max-w-6xl mx-auto p-6 text-gray-900">
    <!-- Wallet Connect Header -->
    <div class="flex justify-end mb-4 gap-2">
      <!-- Connect/Disconnect -->
      <button
        v-if="!isConnected"
        @click="connectWallet"
        class="inline-flex items-center justify-center px-6 py-3 font-semibold shadow-lg transition-all duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 bg-[#FFD208] text-[#2D2D2D] hover:bg-[#A38025] focus-visible:ring-[#2D2D2D] cursor-pointer"
      >
        Connect Wallet
      </button>
      <div v-else class="flex items-center gap-2">
        <span class="px-4 py-2 bg-white border border-gray-300 text-sm font-medium">
          {{ account?.slice(0, 6) }}...{{ account?.slice(-4) }}
        </span>
        <span v-if="chainId" class="px-3 py-2 text-xs font-mono" :class="isFhevmSupported ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'">
          {{ networkName }}
        </span>
        <span v-if="fhevmStatus && isConnected" class="px-3 py-2 text-xs font-mono bg-blue-100 text-blue-800">
          {{ fhevmStatus }}
        </span>
        <button
          @click="disconnectWallet"
          class="inline-flex items-center justify-center px-4 py-2 font-semibold shadow-lg transition-all duration-200 hover:scale-105 bg-black text-[#F4F4F4] hover:bg-[#1F1F1F] cursor-pointer"
        >
          Disconnect
        </button>
      </div>
    </div>

    <!-- Initializing State (checking for auto-connect) -->
    <div v-if="isInitializing" class="flex items-center justify-center">
      <div class="bg-white shadow-xl p-8 text-center">
        <div class="mb-4">
          <div class="inline-flex items-center justify-center w-16 h-16">
            <div class="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
          </div>
        </div>
        <h2 class="text-2xl font-extrabold text-gray-900 mb-2">Loading...</h2>
        <p class="text-gray-700">Initializing application</p>
      </div>
    </div>

    <!-- Not Connected State -->
    <div v-else-if="!isConnected" class="flex items-center justify-center">
      <div class="bg-white shadow-xl p-8 text-center">
        <div class="mb-4">
          <span class="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-900/30 text-amber-400 text-3xl">
            ⚠️
          </span>
        </div>
        <h2 class="text-2xl font-extrabold text-gray-900 mb-2">Wallet not connected</h2>
        <p class="text-gray-700 mb-6">Connect your wallet to use the FHE Counter demo.</p>
        <button
          @click="connectWallet"
          class="inline-flex items-center justify-center px-6 py-3 font-semibold shadow-lg transition-all duration-200 hover:scale-105 bg-[#FFD208] text-[#2D2D2D] hover:bg-[#A38025] cursor-pointer"
        >
          Connect Wallet
        </button>
      </div>
    </div>

    <!-- FHEVM Loading State -->
    <div v-else-if="isConnected && fhevmStatus !== 'ready' && (!chainId || isFhevmSupported)" class="flex items-center justify-center">
      <div class="bg-white shadow-xl p-8 text-center">
        <div class="mb-4">
          <div class="inline-flex items-center justify-center w-16 h-16">
            <div class="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
          </div>
        </div>
        <h2 class="text-2xl font-extrabold text-gray-900 mb-2">Initializing FHEVM...</h2>
        <p class="text-gray-700 mb-2">Network: <strong>{{ networkName }}</strong></p>
        <p class="text-gray-700 mb-2">Loading encryption libraries and connecting to the network.</p>
        <p class="text-sm text-gray-500">This may take a few seconds on first load.</p>
      </div>
    </div>

    <!-- FHEVM Not Supported - Only show after chainId is loaded -->
    <div v-else-if="isConnected && chainId && !isFhevmSupported" class="flex items-center justify-center">
      <div class="bg-white shadow-xl p-8 text-center border-2 border-orange-500">
        <div class="mb-4">
          <span class="inline-flex items-center justify-center w-14 h-14 rounded-full bg-orange-100 text-orange-500 text-3xl">
            ⚠️
          </span>
        </div>
        <h2 class="text-2xl font-extrabold text-gray-900 mb-2">FHEVM Not Supported</h2>
        <p class="text-gray-700 mb-2">Current network: <strong>{{ networkName }} ({{ chainId }})</strong></p>
        <p class="text-gray-700 mb-4">FHEVM is not available on this network.</p>
        <div class="bg-blue-50 border border-blue-200 p-4 mb-6 text-left">
          <p class="text-sm text-gray-800 font-semibold mb-2">Supported Networks:</p>
          <p class="text-sm text-gray-700">{{ supportedNetworksList }}</p>
        </div>
        <button
          @click="disconnectWallet"
          class="inline-flex items-center justify-center px-6 py-3 font-semibold shadow-lg transition-all duration-200 hover:scale-105 bg-orange-500 text-white hover:bg-orange-600 cursor-pointer"
        >
          Disconnect & Switch Network
        </button>
      </div>
    </div>

    <!-- FHEVM Ready - Main Application -->
    <div v-else class="space-y-6">
      <!-- Header -->
      <div class="text-center mb-8 text-black">
        <h1 class="text-3xl font-bold mb-2 flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 261.76 226.69" xmlns="http://www.w3.org/2000/svg" style="margin-right: 8px;">
            <path d="M161.096.001l-30.224 52.35L100.647.002H-.005L130.872 226.69 261.749 0z" fill="#41b883"/>
            <path d="M161.096.001l-30.224 52.35L100.647.002H52.346l78.526 136.01L209.398.001z" fill="#34495e"/>
          </svg>
          FHE Counter SDK Test (Vue)
        </h1>
        <p class="text-gray-600">Interact with the Fully Homomorphic Encryption Counter contract</p>
      </div>

      <!-- Count Handle Display -->
      <div class="bg-[#f4f4f4] shadow-lg p-6 mb-6">
        <h3 class="font-bold text-gray-900 text-xl mb-4 border-b-1 border-gray-700 pb-2">🔢 Count Handle</h3>
        <div class="space-y-3">
          <div class="flex justify-between items-center py-2 px-3 bg-white border border-gray-200 w-full">
            <span class="text-gray-800 font-medium">Encrypted Handle</span>
            <span class="ml-2 font-mono text-sm font-semibold text-gray-900 bg-gray-100 px-2 py-1 border border-gray-300 break-all">
              {{ handle || 'No handle available' }}
            </span>
          </div>
          <div class="flex justify-between items-center py-2 px-3 bg-white border border-gray-200 w-full">
            <span class="text-gray-800 font-medium">Decrypted Value</span>
            <span class="ml-2 font-mono text-sm font-semibold text-gray-900 bg-gray-100 px-2 py-1 border border-gray-300">
              {{ isDecrypted ? clear : 'Not decrypted yet' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 text-black">
        <button
          :class="isDecrypted
            ? 'inline-flex items-center justify-center px-6 py-3 font-semibold shadow-lg transition-all duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed bg-[#A38025] text-[#2D2D2D] hover:bg-[#8F6E1E] focus-visible:ring-[#2D2D2D]'
            : 'inline-flex items-center justify-center px-6 py-3 font-semibold shadow-lg transition-all duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed bg-[#FFD208] text-[#2D2D2D] hover:bg-[#A38025] focus-visible:ring-[#2D2D2D] cursor-pointer'"
          :disabled="!canDecrypt"
          @click="decryptCountHandle"
        >
          {{ canDecrypt
            ? '🔓 Decrypt Counter'
            : isDecrypted
              ? `✅ Decrypted: ${clear}`
              : isDecrypting
                ? '⏳ Decrypting...'
                : '❌ Nothing to decrypt'
          }}
        </button>

        <button
          class="inline-flex items-center justify-center px-6 py-3 font-semibold shadow-lg transition-all duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed bg-[#2D2D2D] text-[#FFD208] hover:bg-[#1F1F1F] focus-visible:ring-[#FFD208] cursor-pointer"
          :disabled="!canPublicDecrypt"
          @click="publicDecryptCountHandle"
        >
          {{ canPublicDecrypt
            ? '🌐 Public Decrypt'
            : isDecrypting
              ? '⏳ Decrypting...'
              : '❌ Nothing to decrypt'
          }}
        </button>

        <button
          class="inline-flex items-center justify-center px-6 py-3 font-semibold shadow-lg transition-all duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed bg-black text-[#F4F4F4] hover:bg-[#1F1F1F] focus-visible:ring-[#FFD208] cursor-pointer"
          :disabled="!canUpdateCounter"
          @click="updateCounter(1)"
        >
          {{ canUpdateCounter
            ? '➕ Increment +1'
            : isProcessing
              ? '⏳ Processing...'
              : '❌ Cannot increment'
          }}
        </button>

        <button
          class="inline-flex items-center justify-center px-6 py-3 font-semibold shadow-lg transition-all duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed bg-black text-[#F4F4F4] hover:bg-[#1F1F1F] focus-visible:ring-[#FFD208] cursor-pointer"
          :disabled="!canUpdateCounter"
          @click="updateCounter(-1)"
        >
          {{ canUpdateCounter
            ? '➖ Decrement -1'
            : isProcessing
              ? '⏳ Processing...'
              : '❌ Cannot decrement'
          }}
        </button>
      </div>

      <!-- Messages -->
      <div v-if="message" class="bg-[#f4f4f4] shadow-lg p-6 mb-6">
        <h3 class="font-bold text-gray-900 text-xl mb-4 border-b-1 border-gray-700 pb-2">💬 Messages</h3>
        <div class="border bg-white border-gray-200 p-4">
          <p class="text-gray-800">{{ message }}</p>
        </div>
      </div>

      <!-- Status Cards -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-[#f4f4f4] shadow-lg p-6">
          <h3 class="font-bold text-gray-900 text-xl mb-4 border-b-1 border-gray-700 pb-2">🔧 FHEVM Instance</h3>
          <div class="space-y-3">
            <div class="flex justify-between items-center py-2 px-3 bg-white border border-gray-200 w-full">
              <span class="text-gray-800 font-medium">Instance Status</span>
              <span class="ml-2 font-mono text-sm font-semibold text-gray-900 bg-gray-100 px-2 py-1 border border-gray-300">
                {{ fhevmInstance ? '✅ Connected' : '❌ Disconnected' }}
              </span>
            </div>
            <div class="flex justify-between items-center py-2 px-3 bg-white border border-gray-200 w-full">
              <span class="text-gray-800 font-medium">Status</span>
              <span class="ml-2 font-mono text-sm font-semibold text-gray-900 bg-gray-100 px-2 py-1 border border-gray-300">
                {{ fhevmStatus }}
              </span>
            </div>
            <div class="flex justify-between items-center py-2 px-3 bg-white border border-gray-200 w-full">
              <span class="text-gray-800 font-medium">Error</span>
              <span class="ml-2 font-mono text-sm font-semibold text-gray-900 bg-gray-100 px-2 py-1 border border-gray-300">
                {{ fhevmError ?? 'No errors' }}
              </span>
            </div>
          </div>
        </div>

        <div class="bg-[#f4f4f4] shadow-lg p-6">
          <h3 class="font-bold text-gray-900 text-xl mb-4 border-b-1 border-gray-700 pb-2">📊 Counter Status</h3>
          <div class="space-y-3">
            <div class="flex justify-between items-center py-2 px-3 bg-white border border-gray-200 w-full">
              <span class="text-gray-700 font-medium">Refreshing</span>
              <span :class="isRefreshing
                ? 'font-mono text-sm font-semibold px-2 py-1 border text-green-800 bg-green-100 border-green-300'
                : 'font-mono text-sm font-semibold px-2 py-1 border text-red-800 bg-red-100 border-red-300'">
                {{ isRefreshing ? '✓ true' : '✗ false' }}
              </span>
            </div>
            <div class="flex justify-between items-center py-2 px-3 bg-white border border-gray-200 w-full">
              <span class="text-gray-700 font-medium">Decrypting</span>
              <span :class="isDecrypting
                ? 'font-mono text-sm font-semibold px-2 py-1 border text-green-800 bg-green-100 border-green-300'
                : 'font-mono text-sm font-semibold px-2 py-1 border text-red-800 bg-red-100 border-red-300'">
                {{ isDecrypting ? '✓ true' : '✗ false' }}
              </span>
            </div>
            <div class="flex justify-between items-center py-2 px-3 bg-white border border-gray-200 w-full">
              <span class="text-gray-700 font-medium">Processing</span>
              <span :class="isProcessing
                ? 'font-mono text-sm font-semibold px-2 py-1 border text-green-800 bg-green-100 border-green-300'
                : 'font-mono text-sm font-semibold px-2 py-1 border text-red-800 bg-red-100 border-red-300'">
                {{ isProcessing ? '✓ true' : '✗ false' }}
              </span>
            </div>
            <div class="flex justify-between items-center py-2 px-3 bg-white border border-gray-200 w-full">
              <span class="text-gray-700 font-medium">Can Get Count</span>
              <span :class="canGetCount
                ? 'font-mono text-sm font-semibold px-2 py-1 border text-green-800 bg-green-100 border-green-300'
                : 'font-mono text-sm font-semibold px-2 py-1 border text-red-800 bg-red-100 border-red-300'">
                {{ canGetCount ? '✓ true' : '✗ false' }}
              </span>
            </div>
            <div class="flex justify-between items-center py-2 px-3 bg-white border border-gray-200 w-full">
              <span class="text-gray-700 font-medium">Can Decrypt</span>
              <span :class="canDecrypt
                ? 'font-mono text-sm font-semibold px-2 py-1 border text-green-800 bg-green-100 border-green-300'
                : 'font-mono text-sm font-semibold px-2 py-1 border text-red-800 bg-red-100 border-red-300'">
                {{ canDecrypt ? '✓ true' : '✗ false' }}
              </span>
            </div>
            <div class="flex justify-between items-center py-2 px-3 bg-white border border-gray-200 w-full">
              <span class="text-gray-700 font-medium">Can Modify</span>
              <span :class="canUpdateCounter
                ? 'font-mono text-sm font-semibold px-2 py-1 border text-green-800 bg-green-100 border-green-300'
                : 'font-mono text-sm font-semibold px-2 py-1 border text-red-800 bg-red-100 border-red-300'">
                {{ canUpdateCounter ? '✓ true' : '✗ false' }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
