# Quick Start Guide

Get your confidential dApp running in under 5 minutes.

## Table of Contents

1. [Installation](#installation)
2. [React Setup](#react-setup)
3. [Vue Setup](#vue-setup)
4. [Vanilla JavaScript Setup](#vanilla-javascript-setup)
5. [Contract Integration](#contract-integration)
6. [What's Next](#whats-next)

---

## Installation

### Step 1: Install the SDK

```bash
npm install uni-fhevm-sdk ethers
```

###Step 2: Install Peer Dependencies

```bash
npm install @fhevm/mock-utils @zama-fhe/relayer-sdk
```

**Why?**
- `@fhevm/mock-utils` - For local development (Hardhat)
- `@zama-fhe/relayer-sdk` - For testnet/mainnet deployment

That's it! You're ready to build.

---

## React Setup

### Step 1: Initialize FHEVM

```tsx
import { useFHEVM } from 'uni-fhevm-sdk/react';

function App() {
  const { instance, isReady, error } = useFHEVM({
    provider: window.ethereum,
    chainId: 11155111, // Sepolia (optional, auto-detected)
  });

  if (!isReady) return <div>Initializing FHEVM...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <div>FHEVM Ready!</div>;
}
```

**What happened?**
- SDK detected your network
- Loaded the appropriate FHEVM library (mock for localhost, real for testnet)
- Initialized the FHEVM instance

### Step 2: Encrypt Values

```tsx
import { useFHEEncrypt } from 'uni-fhevm-sdk/react';
import { useAccount, useSigner } from 'wagmi'; // Or your wallet hook

function EncryptExample() {
  const { instance } = useFHEVM({ provider: window.ethereum });
  const { address } = useAccount();
  const signer = useSigner();

  const { encryptUint32, canEncrypt } = useFHEEncrypt({
    instance,
    signer,
    contractAddress: '0xYourContractAddress',
  });

  const handleEncrypt = async () => {
    if (!canEncrypt) return;

    const encrypted = await encryptUint32(42);
    console.log('Encrypted data:', encrypted.data); // bytes32
    console.log('Proof:', encrypted.inputProof); // bytes

    // Use these in your contract call
  };

  return (
    <button onClick={handleEncrypt} disabled={!canEncrypt}>
      Encrypt Value
    </button>
  );
}
```

**What's `encrypted`?**
- `encrypted.data` - The encrypted handle (bytes32) to send to your contract
- `encrypted.inputProof` - The proof (bytes) to verify encryption

### Step 3: Decrypt Values

```tsx
import { useFHEDecrypt } from 'uni-fhevm-sdk/react';

function DecryptExample() {
  const { instance } = useFHEVM({ provider: window.ethereum });
  const signer = useSigner();

  const { decrypt, results, isDecrypting } = useFHEDecrypt({
    instance,
    signer,
    requests: [
      { handle: '0x...', contractAddress: '0x...' },
    ],
  });

  const handleDecrypt = async () => {
    await decrypt();
    // Results will be populated after decryption
  };

  return (
    <div>
      <button onClick={handleDecrypt} disabled={isDecrypting}>
        {isDecrypting ? 'Decrypting...' : 'Decrypt'}
      </button>
      {results && <pre>{JSON.stringify(results, null, 2)}</pre>}
    </div>
  );
}
```

**What happened?**
- User approved EIP-712 signature in MetaMask
- SDK fetched encrypted value from contract
- Decrypted locally with user's private key
- Returned plaintext value

---

## Vue Setup

### Step 1: Initialize FHEVM

```vue
<script setup lang="ts">
import { useFHEVM } from 'uni-fhevm-sdk/vue';

const { instance, isReady, error } = useFHEVM({
  provider: window.ethereum,
  chainId: 11155111,
});
</script>

<template>
  <div v-if="!isReady">Initializing FHEVM...</div>
  <div v-else-if="error">Error: {{ error.message }}</div>
  <div v-else>FHEVM Ready!</div>
</template>
```

### Step 2: Create Signer

**Important:** Vue doesn't have Wagmi, so you need to create the signer manually:

```vue
<script setup lang="ts">
import { ref, watch } from 'vue';
import { ethers } from 'ethers';
import { useFHEVM } from 'uni-fhevm-sdk/vue';

const provider = ref(window.ethereum);
const account = ref<string>();
const signer = ref<ethers.JsonRpcSigner>();

// Create signer when account changes
watch([provider, account], async ([newProvider, newAccount]) => {
  if (newProvider && newAccount) {
    const ethersProvider = new ethers.BrowserProvider(newProvider);
    // Use constructor - NOT await provider.getSigner()
    signer.value = new ethers.JsonRpcSigner(ethersProvider, newAccount);
  }
}, { immediate: true });

// Connect wallet
const connectWallet = async () => {
  if (window.ethereum) {
    const accounts = await window.ethereum.request({
      method: 'eth_requestAccounts'
    });
    account.value = accounts[0];
  }
};
</script>
```

**Why not `await provider.getSigner()`?**
MetaMask caches signers per chain, causing issues when switching networks. Using the constructor avoids this.

### Step 3: Encrypt and Decrypt

```vue
<script setup lang="ts">
import { useFHEEncrypt, useFHEDecrypt } from 'uni-fhevm-sdk/vue';

const { instance } = useFHEVM({ provider: window.ethereum });

// Encryption
const { encryptUint32, canEncrypt } = useFHEEncrypt({
  instance,
  signer,
  contractAddress: '0x...',
});

const handleEncrypt = async () => {
  if (canEncrypt.value) {
    const encrypted = await encryptUint32(42);
    console.log('Encrypted:', encrypted);
  }
};

// Decryption
const requests = ref([
  { handle: '0x...', contractAddress: '0x...' }
]);

const { decrypt, results, isDecrypting } = useFHEDecrypt({
  instance,
  signer,
  requests,
});
</script>

<template>
  <button @click="handleEncrypt" :disabled="!canEncrypt">
    Encrypt
  </button>
  <button @click="decrypt" :disabled="isDecrypting">
    Decrypt
  </button>
  <pre v-if="results">{{ results }}</pre>
</template>
```

---

## Vanilla JavaScript Setup

### Step 1: Initialize Client

```typescript
import { createFHEVMClient } from 'uni-fhevm-sdk/vanilla';
import { ethers } from 'ethers';

// Initialize
const client = await createFHEVMClient({
  provider: window.ethereum,
  chainId: 11155111,
});

console.log('FHEVM initialized!');
```

### Step 2: Encrypt

```typescript
const encrypted = await client.encryptValue(42, 'uint32', {
  contractAddress: '0x...',
  userAddress: '0x...',
});

console.log('Encrypted data:', encrypted.data);
console.log('Proof:', encrypted.inputProof);
```

### Step 3: Decrypt

```typescript
// Create signer
const provider = new ethers.BrowserProvider(window.ethereum);
const signer = await provider.getSigner();

// Decrypt
const results = await client.decrypt(
  [
    { handle: '0x...', contractAddress: '0x...' },
  ],
  signer
);

console.log('Decrypted values:', results);
```

### Step 4: Cleanup

```typescript
// When done
client.dispose();
```

---

## Contract Integration

### Solidity Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@zama-ai/fhevm/contracts/TFHE.sol";

contract Counter {
    euint32 private counter;

    // Set encrypted counter
    function setCounter(bytes32 encryptedValue, bytes calldata inputProof) public {
        euint32 value = TFHE.asEuint32(encryptedValue, inputProof);
        counter = value;

        // Grant permission for user to decrypt
        TFHE.allowTransient(counter, msg.sender);
    }

    // Get encrypted counter handle
    function getCounter() public view returns (bytes32) {
        return TFHE.handle(counter);
    }

    // Increment counter
    function increment() public {
        counter = TFHE.add(counter, TFHE.asEuint32(1));
        TFHE.allowTransient(counter, msg.sender);
    }
}
```

### Frontend Integration

```typescript
import { useFHEVM, useFHEEncrypt, useFHEDecrypt } from 'uni-fhevm-sdk/react';
import { ethers } from 'ethers';

function CounterApp() {
  const { instance } = useFHEVM({ provider: window.ethereum });
  const signer = useSigner();

  // Contract setup
  const contractAddress = '0x...';
  const contract = new ethers.Contract(
    contractAddress,
    ['function setCounter(bytes32,bytes)', 'function getCounter() view returns (bytes32)'],
    signer
  );

  // Encryption
  const { encryptUint32 } = useFHEEncrypt({ instance, signer, contractAddress });

  // Set counter
  const setCounter = async (value: number) => {
    const encrypted = await encryptUint32(value);
    const tx = await contract.setCounter(encrypted.data, encrypted.inputProof);
    await tx.wait();
  };

  // Get and decrypt counter
  const [handle, setHandle] = useState<string>();
  const { decrypt, results } = useFHEDecrypt({
    instance,
    signer,
    requests: handle ? [{ handle, contractAddress }] : [],
  });

  const getCounter = async () => {
    const handle = await contract.getCounter();
    setHandle(handle);
    await decrypt();
  };

  return (
    <div>
      <button onClick={() => setCounter(42)}>Set Counter to 42</button>
      <button onClick={getCounter}>Get Counter</button>
      {results && <div>Counter: {results[handle!]?.toString()}</div>}
    </div>
  );
}
```

---

## What's Next?

### Learn More

- **[API Reference](./README.md#api-reference)** - Complete API documentation
- **[Examples](./examples/)** - Working demos for all frameworks
- **[Troubleshooting](./TROUBLESHOOTING.md)** - Common issues and solutions

### Advanced Topics

1. **Custom Encryption Builders**
   ```typescript
   const { encrypt } = useFHEEncrypt({ instance, signer, contractAddress });

   const encrypted = await encrypt((input) => {
     input.add32(42);
     input.addBool(true);
     input.addAddress('0x...');
   });
   ```

2. **Batch Decryption**
   ```typescript
   const { decrypt, results } = useFHEDecrypt({
     instance,
     signer,
     requests: [
       { handle: '0x...', contractAddress: '0x...' },
       { handle: '0x...', contractAddress: '0x...' },
       { handle: '0x...', contractAddress: '0x...' },
     ],
   });
   ```

3. **Mock Mode for Local Development**
   ```typescript
   const { instance } = useFHEVM({
     provider: window.ethereum,
     chainId: 31337, // Hardhat
     mockMode: true, // Force mock (optional, auto-detected)
   });
   ```

### Deploy Your dApp

1. **Local (Hardhat):** Auto-uses mock mode (instant, no KMS)
2. **Sepolia Testnet:** Auto-switches to real mode with KMS
3. **Production:** Same code works, no changes needed

---

## Need Help?

- **Issues?** See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- **Questions?** Join [Zama Discord](https://discord.com/invite/zama)
- **Bugs?** Report on [GitHub Issues](https://github.com/Farukest/fhevm-universal-sdk/issues)

---

**Happy building! 🚀**
