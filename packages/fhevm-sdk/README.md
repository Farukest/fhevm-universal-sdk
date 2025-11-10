# Universal FHEVM SDK

**Framework-agnostic toolkit for building confidential dApps with Fully Homomorphic Encryption**

[![npm version](https://img.shields.io/npm/v/uni-fhevm-sdk)](https://www.npmjs.com/package/uni-fhevm-sdk)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-BSD--3--Clause-green)](./LICENSE)

## Why This SDK?

Traditional FHEVM development requires juggling multiple packages, dealing with complex initialization flows, and writing boilerplate code for each framework. This SDK solves that:

```typescript
// ❌ Before: Scattered dependencies and complex setup
import { createFHEVMInstance } from 'fhevmjs';
import { RelayerClient } from '@zama-fhe/relayer-sdk';
import { createMockFHEVM } from '@fhevm/mock-utils';
// ... dozens of lines of boilerplate

// ✅ After: One import, plug and play
import { useFHEVM } from 'uni-fhevm-sdk/react';
const { instance, isReady } = useFHEVM({ provider: window.ethereum });
```

## Features

### ⚡ Get Started in Seconds

```bash
npm install uni-fhevm-sdk ethers
```

```typescript
// React
import { useFHEVM } from 'uni-fhevm-sdk/react';
const { instance, isReady } = useFHEVM({ provider: window.ethereum });

// Vue
import { useFHEVM } from 'uni-fhevm-sdk/vue';
const { instance, isReady } = useFHEVM({ provider: window.ethereum });

// Vanilla JS
import { createFHEVMClient } from 'uni-fhevm-sdk/vanilla';
const client = await createFHEVMClient({ provider: window.ethereum });
```

### 📦 Single Package, Zero Config

No need to manage `@zama-fhe/relayer-sdk`, `@fhevm/mock-utils`, or other scattered dependencies. Everything is bundled.

### 🧩 Wagmi-Like API

Familiar patterns for web3 developers:

```typescript
// Initialization
const { instance, isReady, error } = useFHEVM({ provider, chainId });

// Encryption
const { encrypt, encryptUint32, canEncrypt } = useFHEEncrypt({ instance, signer, contractAddress });

// Decryption
const { decrypt, results, isDecrypting } = useFHEDecrypt({ instance, signer, requests });
```

### 🌐 Framework Agnostic

Works everywhere:
- **React** - Wagmi-style hooks
- **Vue 3** - Composition API composables
- **Vanilla JS/TS** - Pure JavaScript API
- **Node.js** - Server-side encryption
- **Next.js** - SSR-compatible

### 🔑 Complete FHE Flow

- **Local Encryption** - Encrypt values client-side before sending to contracts
- **User Decryption** - Decrypt with EIP-712 signatures (private to the user)
- **Public Decryption** - Decrypt values publicly on-chain
- **Permission Management** - Automatic FHE permission handling

---

## Quick Start

> **Note:** This section shows how to use the SDK in your own projects. If you want to run the integrated examples from this repository, see [Running Examples](#running-examples) below.

### Installation

**Required:**
```bash
npm install uni-fhevm-sdk ethers
```

**Peer Dependencies:**

The SDK requires these dependencies, which are automatically installed with npm 7+:
- `@fhevm/mock-utils` - For local development (Hardhat)
- `@zama-fhe/relayer-sdk` - For testnet/mainnet

If using npm 6 or encountering peer dependency warnings, install them manually:
```bash
npm install @fhevm/mock-utils @zama-fhe/relayer-sdk
```

### Core Methods

Learn the essential SDK methods in 30 seconds:

**Initialize**
```typescript
// React/Vue
const { instance, isReady } = useFHEVM({ provider: window.ethereum, chainId: 31337 });

// Vanilla/Node.js/Next.js
const client = await createFHEVMClient({ provider: window.ethereum, chainId: 31337 });
```

**Encrypt**
```typescript
// React/Vue - Hook
const { encryptUint32 } = useFHEEncrypt({ instance, signer, contractAddress });
const encrypted = await encryptUint32(42);

// Vanilla/Node.js/Next.js - Client
const encrypted = await client.encryptValue(42, 'uint32', { contractAddress, userAddress });
```

**Decrypt (User - with signature)**
```typescript
// React/Vue - Hook
const { decrypt, results } = useFHEDecrypt({ instance, signer, requests: [{ handle, contractAddress }] });
await decrypt();
console.log('Value:', results[handle]);

// Vanilla/Node.js/Next.js - Client
const results = await client.decrypt([{ handle, contractAddress }], signer);
console.log('Value:', results[handle]);
```

**Decrypt (Public - no signature)**
```typescript
// React/Vue - Hook
const { publicDecrypt, publicDecryptSingle } = useFHEDecrypt({ instance, signer });
const results = await publicDecrypt(['0x...', '0x...']);
const singleValue = await publicDecryptSingle('0x...');

// Vanilla/Node.js/Next.js - Client
const results = await client.publicDecrypt(['0x...', '0x...']);
const singleValue = await client.publicDecryptSingle('0x...');
```

**Send to Contract**
```typescript
const contract = new ethers.Contract(address, ABI, signer);
await contract.increment(encrypted.handles[0], encrypted.inputProof);
```

---

### Complete Examples

The examples below show the full FHEVM flow: **initialization → encryption → contract interaction → decryption**. Deploy the example contract first (see [Contract Setup](#contract-setup)), then use these patterns:

**React** ([Full example](./examples/react/))

```tsx
import { useState } from 'react';
import { useFHEVM, useFHEEncrypt, useFHEDecrypt } from 'uni-fhevm-sdk/react';
import { ethers } from 'ethers';

const CONTRACT_ADDRESS = '0x...'; // Your deployed FHECounter contract

function Counter() {
  const [signer, setSigner] = useState(null);
  const [handle, setHandle] = useState(null);

  // 1. Initialize FHEVM
  const { instance, isReady } = useFHEVM({
    provider: window.ethereum,
    chainId: 31337 // or 11155111 for Sepolia
  });

  // 2. Setup encryption
  const { encryptUint32 } = useFHEEncrypt({
    instance,
    signer,
    contractAddress: CONTRACT_ADDRESS
  });

  // 3. Setup decryption
  const { decrypt, results } = useFHEDecrypt({
    instance,
    signer,
    requests: handle ? [{ handle, contractAddress: CONTRACT_ADDRESS }] : []
  });

  // 4. Increment counter (encrypt + send)
  const increment = async () => {
    const encrypted = await encryptUint32(1);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
    await contract.increment(encrypted.handles[0], encrypted.inputProof);
  };

  // 5. Get and decrypt counter (user decrypt - with signature)
  const getCounter = async () => {
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
    const encryptedHandle = await contract.getCount();
    setHandle(encryptedHandle);
    await decrypt();
    console.log('Counter value:', results[encryptedHandle]);
  };

  // 6. Public decrypt (no signature needed)
  const { publicDecrypt, publicDecryptSingle } = useFHEDecrypt({ instance, signer });

  const getPublicValue = async () => {
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
    const handle = await contract.getPublicHandle();
    const value = await publicDecryptSingle(handle);
    console.log('Public value:', value);
  };

  if (!isReady) return <div>Initializing FHEVM...</div>;
  return (
    <div>
      <button onClick={increment}>Increment</button>
      <button onClick={getCounter}>Get Counter (User Decrypt)</button>
      <button onClick={getPublicValue}>Get Public Value</button>
    </div>
  );
}
```

**Vue** ([Full example](./examples/vue/))

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { useFHEVM, useFHEEncrypt, useFHEDecrypt } from 'uni-fhevm-sdk/vue';
import { ethers } from 'ethers';

const CONTRACT_ADDRESS = '0x...'; // Your deployed FHECounter contract
const signer = ref(null);
const handle = ref(null);

// 1. Initialize FHEVM
const { instance, isReady } = useFHEVM({
  provider: window.ethereum,
  chainId: 31337
});

// 2. Setup encryption
const { encryptUint32 } = useFHEEncrypt({
  instance,
  signer,
  contractAddress: CONTRACT_ADDRESS
});

// 3. Setup decryption
const requests = computed(() =>
  handle.value ? [{ handle: handle.value, contractAddress: CONTRACT_ADDRESS }] : []
);
const { decrypt, results } = useFHEDecrypt({ instance, signer, requests });

// 4. Increment counter
const increment = async () => {
  const encrypted = await encryptUint32(1);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer.value);
  await contract.increment(encrypted.handles[0], encrypted.inputProof);
};

// 5. Get and decrypt counter (user decrypt - with signature)
const getCounter = async () => {
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer.value);
  handle.value = await contract.getCount();
  await decrypt();
};

// 6. Public decrypt (no signature needed)
const { publicDecryptSingle } = useFHEDecrypt({ instance, signer });
const publicValue = ref(null);

const getPublicValue = async () => {
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer.value);
  const handle = await contract.getPublicHandle();
  publicValue.value = await publicDecryptSingle(handle);
};
</script>

<template>
  <div v-if="!isReady">Initializing FHEVM...</div>
  <div v-else>
    <button @click="increment">Increment</button>
    <button @click="getCounter">Get Counter (User Decrypt)</button>
    <button @click="getPublicValue">Get Public Value</button>
    <p v-if="results">Counter: {{ results[handle] }}</p>
    <p v-if="publicValue">Public Value: {{ publicValue }}</p>
  </div>
</template>
```

**Vanilla JS** ([Full example](./examples/vanilla/))

```javascript
import { createFHEVMClient } from 'uni-fhevm-sdk/vanilla';
import { ethers } from 'ethers';

const CONTRACT_ADDRESS = '0x...'; // Your deployed FHECounter contract

// 1. Initialize FHEVM
const client = await createFHEVMClient({
  provider: window.ethereum,
  chainId: 31337
});

// 2. Setup contract
const provider = new ethers.BrowserProvider(window.ethereum);
const signer = await provider.getSigner();
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

// 3. Increment counter (encrypt + send)
async function increment() {
  const userAddress = await signer.getAddress();
  const encrypted = await client.encryptValue(1, 'uint32', {
    contractAddress: CONTRACT_ADDRESS,
    userAddress
  });
  await contract.increment(encrypted.handles[0], encrypted.inputProof);
}

// 4. Get and decrypt counter (user decrypt - with signature)
async function getCounter() {
  const handle = await contract.getCount();
  const results = await client.decrypt(
    [{ handle, contractAddress: CONTRACT_ADDRESS }],
    signer
  );
  console.log('Counter:', results[handle]);
}

// 5. Public decrypt (no signature needed)
async function getPublicValue() {
  const handle = await contract.getPublicHandle();
  const value = await client.publicDecryptSingle(handle);
  console.log('Public value:', value);
}

// 6. Cleanup
window.addEventListener('beforeunload', () => client.dispose());
```

**Node.js** ([Full example](./examples/nodejs/))

```javascript
import { createFHEVMClient } from 'uni-fhevm-sdk/vanilla';
import { ethers } from 'ethers';

const CONTRACT_ADDRESS = '0x...';
const PRIVATE_KEY = '0x...';

// 1. Initialize FHEVM (server-side)
const client = await createFHEVMClient({
  provider: 'http://localhost:8545',
  chainId: 31337
});

// 2. Setup contract
const provider = new ethers.JsonRpcProvider('http://localhost:8545');
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);

// 3. Encrypt and send
const encrypted = await client.encryptValue(1, 'uint32', {
  contractAddress: CONTRACT_ADDRESS,
  userAddress: wallet.address
});
await contract.increment(encrypted.handles[0], encrypted.inputProof);

// 4. Decrypt result (user decrypt - with signature)
const handle = await contract.getCount();
const results = await client.decrypt([{ handle, contractAddress: CONTRACT_ADDRESS }], wallet);
console.log('Counter:', results[handle]);

// 5. Public decrypt (no signature needed)
const publicHandle = await contract.getPublicHandle();
const publicValue = await client.publicDecryptSingle(publicHandle);
console.log('Public value:', publicValue);
```

**Next.js** ([Full example](./examples/nextjs/))

```tsx
'use client';
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

const CONTRACT_ADDRESS = '0x...'; // Your deployed FHECounter contract

function Counter() {
  const [signer, setSigner] = useState(null);
  const [client, setClient] = useState(null);
  const [handle, setHandle] = useState(null);

  // 1. Initialize FHEVM (client component with dynamic import)
  useEffect(() => {
    const initFHEVM = async () => {
      const { createFHEVMClient } = await import('uni-fhevm-sdk/vanilla');
      const fhevmClient = await createFHEVMClient({
        provider: window.ethereum,
        chainId: 31337 // or 11155111 for Sepolia
      });
      setClient(fhevmClient);
    };
    initFHEVM();
  }, []);

  // 2. Setup wallet
  const connectWallet = async () => {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await provider.send('eth_requestAccounts', []);
    setSigner(new ethers.JsonRpcSigner(provider, accounts[0]));
  };

  // 3. Increment counter (encrypt + send)
  const increment = async () => {
    const userAddress = await signer.getAddress();
    const encrypted = await client.encryptValue(1, 'uint32', {
      contractAddress: CONTRACT_ADDRESS,
      userAddress
    });
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
    await contract.increment(encrypted.handles[0], encrypted.inputProof);
  };

  // 4. Get and decrypt counter (user decrypt - with signature)
  const getCounter = async () => {
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
    const encryptedHandle = await contract.getCount();
    setHandle(encryptedHandle);

    // 5. Decrypt
    const results = await client.decrypt(
      [{ handle: encryptedHandle, contractAddress: CONTRACT_ADDRESS }],
      signer
    );
    console.log('Counter:', results[encryptedHandle]);
  };

  // 6. Public decrypt (no signature needed)
  const getPublicValue = async () => {
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
    const handle = await contract.getPublicHandle();
    const value = await client.publicDecryptSingle(handle);
    console.log('Public value:', value);
  };

  if (!client) return <div>Initializing FHEVM...</div>;
  return (
    <div>
      <button onClick={connectWallet}>Connect Wallet</button>
      <button onClick={increment}>Increment</button>
      <button onClick={getCounter}>Get Counter (User Decrypt)</button>
      <button onClick={getPublicValue}>Get Public Value</button>
    </div>
  );
}
```

---

## Contract Setup

The examples above use the FHECounter contract included in this repository at `packages/hardhat/contracts/FHECounter.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

contract FHECounter is SepoliaConfig {
    euint32 private _count;

    constructor() {
        _count = FHE.asEuint32(0);
        FHE.allowThis(_count);
        FHE.makePubliclyDecryptable(_count);  // Enables public decrypt
    }

    function getCount() external view returns (euint32) {
        return _count;
    }

    function increment(externalEuint32 inputEuint32, bytes calldata inputProof) external {
        euint32 encryptedEuint32 = FHE.fromExternal(inputEuint32, inputProof);
        _count = FHE.add(_count, encryptedEuint32);

        FHE.allowThis(_count);
        FHE.allow(_count, msg.sender);  // Allows user decrypt
        FHE.makePubliclyDecryptable(_count);  // Allows public decrypt
    }
}
```

**Deploy from this repository:**

```bash
# Local (from repository root)
pnpm chain              # Terminal 1 - Start Hardhat node
pnpm deploy:localhost   # Terminal 2 - Deploy contracts

# Sepolia Testnet (from repository root)
pnpm deploy:sepolia
```

**For your own projects:**

```bash
# Install Hardhat FHEVM template
npx fhevm-hardhat-template my-fhevm-project
cd my-fhevm-project

# Copy the FHECounter.sol contract to contracts/
# Deploy
npx hardhat node  # Terminal 1
npx hardhat deploy --network localhost  # Terminal 2
```

---

## Documentation

- **[Quick Start Guide →](./QUICKSTART.md)** - Complete 0-to-production guide
- **[API Reference →](#api-reference)** - Detailed API documentation
- **[Examples →](./examples/)** - Working demos for React, Vue, Vanilla, Next.js, Node.js
- **[Troubleshooting →](./TROUBLESHOOTING.md)** - Common issues and solutions

---

## API Reference

### React Hooks

#### `useFHEVM(config)`

Initialize FHEVM instance.

**Parameters:**
- `provider` - Ethereum provider (e.g., `window.ethereum`)
- `chainId` - Network chain ID (optional, auto-detected)
- `mockMode` - Force mock mode (optional, auto-detected for localhost)

**Returns:**
- `instance` - FHEVM instance
- `isReady` - Ready state
- `isLoading` - Loading state
- `error` - Error object
- `init()` - Manual initialization
- `reinit()` - Re-initialize
- `abort()` - Abort initialization

```typescript
const { instance, isReady, error } = useFHEVM({
  provider: window.ethereum,
  chainId: 11155111, // Sepolia
});
```

#### `useFHEEncrypt(config)`

Encrypt values for contracts.

**Parameters:**
- `instance` - FHEVM instance from `useFHEVM`
- `signer` - Ethers signer
- `contractAddress` - Target contract address

**Returns:**
- `canEncrypt` - Ready to encrypt
- `encrypt(builder, config)` - Custom encryption
- `encryptValue(value, type, config)` - Encrypt single value
- `encryptUint8/16/32/64(value)` - Type-specific helpers
- `encryptBool(value)` - Encrypt boolean
- `encryptAddress(value)` - Encrypt address

```typescript
const { encryptUint32, canEncrypt } = useFHEEncrypt({
  instance,
  signer,
  contractAddress: '0x...',
});

if (canEncrypt) {
  const encrypted = await encryptUint32(42);
  // encrypted.data - encrypted handle (bytes32)
  // encrypted.inputProof - proof for contract (bytes)
}
```

#### `useFHEDecrypt(config)`

Decrypt encrypted values.

**Parameters:**
- `instance` - FHEVM instance
- `signer` - Ethers signer
- `requests` - Array of `{ handle, contractAddress }`
- `autoDecrypt` - Auto-decrypt when requests change (default: false)

**Returns:**
- `canDecrypt` - Ready to decrypt
- `isDecrypting` - Decryption in progress
- `results` - Decrypted values (object mapping handle → value)
- `message` - Status message
- `error` - Error message
- `decrypt()` - Trigger decryption (requires EIP-712 signature)
- `publicDecrypt(handles)` - Decrypt publicly without signature
- `publicDecryptSingle(handle)` - Decrypt single value publicly without signature
- `clearResults()` - Clear results

```typescript
const { decrypt, publicDecrypt, publicDecryptSingle, results, isDecrypting } = useFHEDecrypt({
  instance,
  signer,
  requests: [
    { handle: '0x...', contractAddress: '0x...' },
  ],
});

// User decrypt (requires EIP-712 signature)
await decrypt();
console.log(results); // { '0x...': 42n }

// Public decrypt (no signature needed)
const publicResults = await publicDecrypt(['0x...', '0x...']);
console.log(publicResults); // { '0x...': 42n, '0x...': 100n }

// Public decrypt single value
const singleValue = await publicDecryptSingle('0x...');
console.log(singleValue); // 42n
```

### Vue Composables

Vue composables have the same API as React hooks. All return values are reactive `Ref` objects.

```typescript
import { useFHEVM, useFHEEncrypt, useFHEDecrypt } from 'uni-fhevm-sdk/vue';

const { instance, isReady } = useFHEVM({ provider: window.ethereum });
const { encrypt } = useFHEEncrypt({ instance, signer, contractAddress });
const { decrypt, results } = useFHEDecrypt({ instance, signer, requests });
```

**Important for Vue:**
- Create signer manually: `new ethers.JsonRpcSigner(provider, address)`
- Don't use `await provider.getSigner()` (causes MetaMask caching issues)

### Vanilla API

```typescript
import { createFHEVMClient } from 'uni-fhevm-sdk/vanilla';

// Initialize
const client = await createFHEVMClient({
  provider: window.ethereum,
  chainId: 11155111,
});

// Encrypt
const encrypted = await client.encryptValue(42, 'uint32', {
  contractAddress: '0x...',
  userAddress: '0x...',
});

// Decrypt
const results = await client.decrypt(
  [{ handle: '0x...', contractAddress: '0x...' }],
  signer
);

// Cleanup
client.dispose();
```

### Core Client (Advanced)

For advanced use cases, use the framework-agnostic core:

```typescript
import { FHEVMClient } from 'uni-fhevm-sdk/core';

const client = new FHEVMClient({
  provider: window.ethereum,
  chainId: 11155111,
  mockMode: undefined, // auto-detect (31337 = mock, others = real)
});

await client.init();

// Use client methods
const encrypted = await client.encrypt(builder, config);
const decrypted = await client.decrypt(requests, signer);

client.dispose();
```

---

## Examples

Working examples are in `examples/`:

- **[React](./examples/react/)** - Full React app with hooks
- **[Vue](./examples/vue/)** - Vue 3 with Composition API
- **[Vanilla](./examples/vanilla/)** - Pure JavaScript
- **[Next.js](./examples/nextjs/)** - SSR-compatible Next.js
- **[Node.js](./examples/nodejs/)** - Server-side Node.js

Each example includes:
- Complete source code
- Contract integration
- Encryption/decryption flow
- Error handling
- TypeScript support

### Running Examples

This repository includes a complete integrated monorepo setup for running all examples with contracts:

```bash
# 1. Clone and install (from repository root)
git clone <repo-url>
cd fhevm-universal-sdk
pnpm install  # Installs all packages + builds SDK automatically

# 2. Start local blockchain (Terminal 1)
pnpm chain

# 3. Deploy contracts and generate ABIs (Terminal 2)
pnpm deploy:localhost

# 4. Start your preferred frontend (Terminal 3)
pnpm start:react     # React example
pnpm start:vue       # Vue example
pnpm start:vanilla   # Vanilla JS example
pnpm start:nextjs    # Next.js example
pnpm start:nodejs    # Node.js example
```

**Available root commands:**
- `pnpm chain` - Start Hardhat local node
- `pnpm compile` - Compile contracts
- `pnpm deploy:localhost` - Deploy contracts + generate TypeScript ABIs
- `pnpm deploy:sepolia` - Deploy to Sepolia testnet
- `pnpm start:react/vue/vanilla/nextjs/nodejs` - Start framework examples

---

## How It Works

### 1. Initialization

```typescript
const { instance } = useFHEVM({ provider: window.ethereum });
```

SDK automatically:
- Detects network (mock for localhost, real for testnet/mainnet)
- Loads appropriate FHEVM library (mock-utils or relayer-sdk)
- Initializes instance with correct configuration
- Handles provider changes and cleanup

### 2. Encryption

```typescript
const { encryptUint32 } = useFHEEncrypt({ instance, signer, contractAddress });
const encrypted = await encryptUint32(42);
```

SDK:
- Creates encryption input builder
- Generates encryption proof
- Returns `{ data, inputProof }` ready for contract call

### 3. Decryption

```typescript
const { decrypt, results } = useFHEDecrypt({ instance, signer, requests });
await decrypt();
```

SDK:
- Requests EIP-712 signature from user
- Fetches encrypted values from contract
- Decrypts locally using user's keypair
- Returns plaintext values

---

## Mock vs Real Mode

The SDK automatically switches between mock (local) and real (testnet/mainnet) modes:

| Chain ID | Network | Mode |
|----------|---------|------|
| 31337 | Hardhat | Mock (instant, no KMS) |
| 11155111 | Sepolia | Real (with KMS) |
| Others | Production | Real (with KMS) |

**Override:** Set `mockMode: true` or `mockMode: false` to force a specific mode.

---

## TypeScript Support

Full TypeScript support with comprehensive types:

```typescript
import type {
  FHEVMConfig,
  EncryptResult,
  DecryptRequest,
  DecryptResult,
} from 'uni-fhevm-sdk/types';
```

---

## Troubleshooting

### Common Issues

**1. "Cannot find module 'uni-fhevm-sdk/react'"**

Ensure TypeScript `moduleResolution` is set to `"bundler"` or `"node16"`:

```json
{
  "compilerOptions": {
    "moduleResolution": "bundler"
  }
}
```

**2. Stuck on "Loading..." forever**

Check:
- MetaMask is installed and connected
- Correct network is selected
- RPC endpoint is responsive

**3. Decryption returns undefined**

Verify:
- Handle exists (not `0x000...`)
- Contract has granted FHE permissions
- User's wallet has permissions

**4. "Peer dependency not found"**

Install peer dependencies:
```bash
npm install @fhevm/mock-utils @zama-fhe/relayer-sdk
```

**More:** See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for complete guide.

---

## Development

This project uses **pnpm workspaces** for monorepo management. All commands must be run from the repository root.

```bash
# Install dependencies (from root)
pnpm install

# Build SDK
pnpm build

# Watch mode
pnpm watch

# Run tests
pnpm test

# Clean build
pnpm clean
```

**Note:** If you cloned this repository, use `pnpm` instead of `npm` for all commands. The SDK automatically rebuilds during `pnpm install` via the preinstall hook.

---

## Architecture

### Project Structure

```
uni-fhevm-sdk/
├── core/               # Framework-agnostic core
│   ├── client.ts       # Main FHEVM client
│   ├── encryption.ts   # Encryption utilities
│   └── decryption.ts   # Decryption utilities
├── adapters/           # Framework adapters
│   ├── react/          # React hooks
│   ├── vue/            # Vue composables
│   └── vanilla/        # Pure JS API
├── internal/           # Internal utilities
└── storage/            # Storage abstraction
```

### Design Philosophy

This SDK uses the **Adapter Pattern** to provide a universal interface across all JavaScript frameworks. Here's why:

#### 1. Framework-Agnostic Core

The core FHEVM logic (initialization, encryption, decryption) is written once in `core/client.ts` and shared across all frameworks. This eliminates code duplication and ensures consistent behavior.

```typescript
// core/client.ts - Works everywhere
class FHEVMClient {
  async init() { /* FHEVM initialization */ }
  async encrypt() { /* Encryption logic */ }
  async decrypt() { /* Decryption logic */ }
}
```

#### 2. Framework-Specific Adapters

Each framework has its own adapter that wraps the core with framework-specific APIs:

- **React:** Uses `useState`, `useEffect` for component lifecycle
- **Vue:** Uses `ref`, `watch` for reactive state management
- **Vanilla:** Uses Promises for simple async operations

This means:
- React developers get familiar hooks (`useFHEVM`, `useFHEEncrypt`)
- Vue developers get familiar composables (same API, but reactive)
- Vanilla JS developers get simple promise-based functions

#### 3. Tree Shaking & Bundle Size

Thanks to package.json "exports", only the code you import is included:

```typescript
// React app: Only React adapter is bundled
import { useFHEVM } from 'uni-fhevm-sdk/react';

// Vue app: Only Vue adapter is bundled
import { useFHEVM } from 'uni-fhevm-sdk/vue';
```

Result: Smaller bundle sizes, faster load times.

#### 4. Easy to Extend

Want to add Svelte support? Just create `adapters/svelte/` that wraps the core. The core logic stays unchanged.

### Package Exports

The SDK uses [package.json "exports"](https://nodejs.org/api/packages.html#package-entry-points) for subpath imports:

| Import Path | Points To | Purpose |
|-------------|-----------|---------|
| `uni-fhevm-sdk` | `src/index.ts` | Core types and utilities |
| `uni-fhevm-sdk/react` | `src/adapters/react/` | React hooks |
| `uni-fhevm-sdk/vue` | `src/adapters/vue/` | Vue composables |
| `uni-fhevm-sdk/vanilla` | `src/adapters/vanilla/` | Promise-based API |
| `uni-fhevm-sdk/core` | `src/core/client.ts` | Core client (advanced) |
| `uni-fhevm-sdk/storage` | `src/storage/` | Storage utilities |

This allows precise imports and better tree shaking.

### Design Principles

1. **Framework-agnostic core** - Write FHEVM logic once, use everywhere
2. **Adapter pattern** - Wrap core with framework-specific APIs
3. **Wagmi-like API** - Familiar patterns for web3 developers
4. **Full TypeScript support** - Comprehensive types for autocomplete
5. **Modular imports** - Only import what you need
6. **Zero dependencies in core** - Core has no framework dependencies

---

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

---

## License

BSD-3-Clause-Clear License - see [LICENSE](./LICENSE)

---

## Acknowledgments

Built for the **[Zama Bounty Program - October 2025](https://www.zama.ai/post/developer-program-bounty-track-october-2025-build-an-universal-fhevm-sdk)**

Powered by:
- [Zama FHEVM](https://docs.zama.ai/fhevm)
- [fhevmjs](https://docs.zama.ai/fhevm/fundamentals/write_contract/getting_started)
- [Relayer SDK](https://github.com/zama-ai/relayer-sdk)

---

## Links

- **GitHub:** [https://github.com/Farukest/fhevm-universal-sdk](https://github.com/Farukest/fhevm-universal-sdk)
- **Zama Docs:** [https://docs.zama.ai/fhevm](https://docs.zama.ai/fhevm)
- **Discord:** [https://discord.com/invite/zama](https://discord.com/invite/zama)
- **npm:** [https://www.npmjs.com/package/uni-fhevm-sdk](https://www.npmjs.com/package/uni-fhevm-sdk)

---

**Made with ❤️ for the Zama Community**
