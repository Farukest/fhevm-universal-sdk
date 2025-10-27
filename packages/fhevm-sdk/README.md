# Universal FHEVM SDK

**A framework-agnostic SDK for building confidential dApps with Fully Homomorphic Encryption (FHE)**

Built for the [Zama Bounty Program - October 2024](https://www.zama.ai/post/developer-program-bounty-track-october-2025-build-an-universal-fhevm-sdk)

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-BSD--3--Clause-green)](./LICENSE)

## Overview

The Universal FHEVM SDK is a **framework-agnostic** toolkit that makes building confidential dApps simple, consistent, and developer-friendly. It wraps all required FHEVM packages into a unified, wagmi-like API that works seamlessly across:

- **React** - Wagmi-style hooks
- **Vue 3** - Composition API
- **Vanilla JS/TS** - Pure JavaScript
- **Node.js** - Server-side encryption

## Key Features

### Quick Setup - Less than 10 lines of code to get started

```typescript
// React
const { instance, isReady } = useFHEVM({ provider: window.ethereum });

// Vue
const { instance, isReady } = useFHEVM({ provider: window.ethereum });

// Vanilla
const client = await createFHEVMClient({ provider: window.ethereum });
```

### Wagmi-like API - Familiar and intuitive for web3 developers

```typescript
const { encryptUint32, decrypt } = useFHEEncrypt({ instance, signer, contractAddress });
```

### Single Package - All dependencies wrapped in one SDK

No need to manage `@zama-fhe/relayer-sdk`, `@fhevm/mock-utils`, etc. separately.

### Complete FHE Flow - Encryption, Decryption, and Permissions

- **Encryption**: Encrypt values locally before sending to contracts
- **User Decryption**: Decrypt values with EIP-712 signatures (private to user)
- **Public Decryption**: Decrypt values publicly on-chain
- **Permission Management**: Automatic FHE permission handling

### Modular & Extensible - Use what you need

```typescript
import { FHEVMClient } from 'fhevm-sdk/core';              // Core only
import { useFHEVM } from 'fhevm-sdk/react';                // React adapter
import { useFHEVM } from 'fhevm-sdk/vue';                  // Vue adapter
import { createFHEVMClient } from 'fhevm-sdk/vanilla';     // Vanilla JS
```

---

## Documentation

- [Quick Start Guide](./QUICKSTART.md) - Get started in 5 minutes
- [API Reference](#-api-reference) - Complete API documentation
- [Examples](./examples/) - Working code samples
- [Troubleshooting](./TROUBLESHOOTING.md) - Common issues and solutions

## Installation

```bash
# Using npm
npm install fhevm-sdk ethers

# Using yarn
yarn add fhevm-sdk ethers

# Using pnpm
pnpm add fhevm-sdk ethers
```

**Peer Dependencies**:
- `ethers@^6.13.4` (required)
- `react@^18 || ^19` (optional - only for React)
- `vue@^3` (optional - only for Vue)

---

## Quick Start

### React Example

```tsx
import { useFHEVM, useFHEEncrypt, useFHEDecrypt } from 'fhevm-sdk/react';
import { useAccount, useSigner } from 'wagmi';

function MyApp() {
  const { address } = useAccount();
  const signer = useSigner();

  // Initialize FHEVM
  const { instance, isReady, error } = useFHEVM({
    provider: window.ethereum,
    chainId: 11155111, // Sepolia
  });

  // Encryption
  const { encryptUint32, canEncrypt } = useFHEEncrypt({
    instance,
    signer,
    contractAddress: '0x...',
  });

  // Decryption
  const { decrypt, results, isDecrypting } = useFHEDecrypt({
    instance,
    signer,
    requests: [
      { handle: '0x...', contractAddress: '0x...' }
    ],
  });

  if (!isReady) return <div>Loading FHEVM...</div>;
  if (error) return <div>Error: {error.message}</div>;

  const handleEncrypt = async () => {
    const encrypted = await encryptUint32(42);
    console.log('Encrypted:', encrypted);
  };

  return (
    <div>
      <button onClick={handleEncrypt} disabled={!canEncrypt}>
        Encrypt Value
      </button>
      <button onClick={decrypt} disabled={isDecrypting}>
        Decrypt Values
      </button>
      {results && <pre>{JSON.stringify(results, null, 2)}</pre>}
    </div>
  );
}
```

### Vue 3 Example

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { useFHEVM, useFHEEncrypt, useFHEDecrypt } from 'fhevm-sdk/vue';

// Initialize FHEVM
const { instance, isReady, error } = useFHEVM({
  provider: window.ethereum,
  chainId: 11155111,
});

const signer = ref(/* your ethers signer */);
const contractAddress = ref('0x...');

// Encryption
const { encryptUint32, canEncrypt } = useFHEEncrypt({
  instance,
  signer,
  contractAddress,
});

// Decryption
const requests = ref([
  { handle: '0x...', contractAddress: '0x...' }
]);

const { decrypt, results, isDecrypting } = useFHEDecrypt({
  instance,
  signer,
  requests,
});

const handleEncrypt = async () => {
  const encrypted = await encryptUint32(42);
  console.log('Encrypted:', encrypted);
};
</script>

<template>
  <div v-if="!isReady">Loading FHEVM...</div>
  <div v-else-if="error">Error: {{ error.message }}</div>
  <div v-else>
    <button @click="handleEncrypt" :disabled="!canEncrypt">
      Encrypt Value
    </button>
    <button @click="decrypt" :disabled="isDecrypting">
      Decrypt Values
    </button>
    <pre v-if="results">{{ JSON.stringify(results, null, 2) }}</pre>
  </div>
</template>
```

### Vanilla JavaScript Example

```typescript
import { createFHEVMClient } from 'fhevm-sdk/vanilla';
import { ethers } from 'ethers';

// Initialize client
const client = await createFHEVMClient({
  provider: window.ethereum,
  chainId: 11155111,
});

// Encrypt a value
const encrypted = await client.encrypt(
  (input) => {
    input.add32(42);      // uint32
    input.addBool(true);  // boolean
  },
  {
    contractAddress: '0x...',
    userAddress: '0x...',
  }
);

console.log('Encrypted handles:', encrypted.handles);
console.log('Input proof:', encrypted.inputProof);

// Decrypt values
const signer = new ethers.BrowserProvider(window.ethereum).getSigner();

const decrypted = await client.decrypt(
  [
    { handle: '0x...', contractAddress: '0x...' },
    { handle: '0x...', contractAddress: '0x...' },
  ],
  await signer
);

console.log('Decrypted values:', decrypted);

// Cleanup
client.dispose();
```

---

## API Reference

### Core Client (`FHEVMClient`)

Framework-agnostic core client for advanced usage.

```typescript
import { FHEVMClient } from 'fhevm-sdk/core';

const client = new FHEVMClient({
  provider: window.ethereum,
  chainId: 11155111,
  mockChains: { 31337: 'http://localhost:8545' }, // Optional
});

await client.init();

// Encrypt
const encrypted = await client.encrypt(builder, config);

// Decrypt
const decrypted = await client.decrypt(requests, signer);

// Get instance
const instance = client.getInstance();

// Dispose
client.dispose();
```

### React Hooks

#### `useFHEVM`

Main hook for FHEVM initialization.

```typescript
const {
  instance,      // FHEVM instance
  isReady,       // Ready state
  isLoading,     // Loading state
  error,         // Error object
  init,          // Manual init
  reinit,        // Reinitialize
  abort,         // Abort init
} = useFHEVM(config);
```

#### `useFHEEncrypt`

Hook for encryption operations.

```typescript
const {
  canEncrypt,      // Ready to encrypt
  encrypt,         // Main encrypt function
  encryptValue,    // Encrypt single value
  encryptUint8,    // Convenience methods
  encryptUint16,
  encryptUint32,
  encryptUint64,
  encryptBool,
  encryptAddress,
  createBuilder,   // Create builder instance
} = useFHEEncrypt({ instance, signer, contractAddress });
```

#### `useFHEDecrypt`

Hook for decryption operations.

```typescript
const {
  canDecrypt,       // Ready to decrypt
  isDecrypting,     // Decryption in progress
  results,          // Decrypted results
  message,          // Status message
  error,            // Error string
  decrypt,          // Trigger decryption
  decryptRequests,  // Decrypt custom requests
  decryptSingle,    // Decrypt single value
  clearResults,     // Clear results
} = useFHEDecrypt({
  instance,
  signer,
  requests,
  autoDecrypt: false, // Auto-decrypt on changes
});
```

### Vue Composables

Vue composables have the same API as React hooks, but return reactive `Ref` objects.

```typescript
import { useFHEVM, useFHEEncrypt, useFHEDecrypt } from 'fhevm-sdk/vue';

// All return values are Ref<T>
const { instance, isReady } = useFHEVM(config);
const { encrypt, canEncrypt } = useFHEEncrypt(config);
const { decrypt, results } = useFHEDecrypt(config);
```

### Vanilla API

```typescript
import { createFHEVMClient } from 'fhevm-sdk/vanilla';

const client = await createFHEVMClient(config);

client.encrypt(builder, config);
client.encryptValue(value, type, config);
client.decrypt(requests, signer);
client.decryptSingle(handle, contractAddress, signer);
client.getInstance();
client.dispose();
```

---

## Advanced Usage

### Custom Encryption Builder

```typescript
import { EncryptionBuilder } from 'fhevm-sdk/core/encryption';

const builder = new EncryptionBuilder(input);

builder
  .addUint32(42)
  .addBool(true)
  .addAddress('0x...')
  .addUint64(1000000n);

const result = await builder.encrypt();
```

### Decryption with Custom Configuration

```typescript
const results = await client.decrypt(
  requests,
  signer,
  {
    keypair: { publicKey: '...', privateKey: '...' },  // Custom keypair
    forceRefresh: true,                                 // Bypass cache
    signatureStorage: customStorage,                    // Custom storage
  }
);
```

### Multiple Framework Support

```typescript
// Core (shared logic)
import { FHEVMClient } from 'fhevm-sdk/core';

// React
import { useFHEVM } from 'fhevm-sdk/react';

// Vue
import { useFHEVM } from 'fhevm-sdk/vue';

// Vanilla
import { createFHEVMClient } from 'fhevm-sdk/vanilla';
```

---

## Architecture

### Modular Design

```
fhevm-sdk/
├── core/              # Framework-agnostic
│   ├── client.ts      # Main FHEVM client
│   ├── encryption.ts  # Encryption utilities
│   └── decryption.ts  # Decryption utilities
│
├── adapters/          # Framework-specific
│   ├── react/         # React hooks
│   ├── vue/           # Vue composables
│   └── vanilla/       # Plain JS/TS
│
├── internal/          # Internal utilities
│   ├── fhevm.ts       # Instance creation
│   ├── RelayerSDKLoader.ts
│   └── PublicKeyStorage.ts
│
└── storage/           # Storage abstraction
    └── GenericStringStorage.ts
```

### Key Design Principles

1. **Framework-Agnostic Core**: All FHE logic is in the core, independent of any framework
2. **Adapter Pattern**: Framework-specific code is in adapters that wrap the core
3. **Wagmi-like API**: Familiar, intuitive API for web3 developers
4. **Type Safety**: Full TypeScript support with comprehensive types
5. **Modularity**: Import only what you need

---

## Testing

```bash
# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test -- --coverage
```

---

## Development

```bash
# Install dependencies
pnpm install

# Build the SDK
pnpm build

# Watch mode (auto-rebuild)
pnpm watch

# Clean build artifacts
pnpm clean
```

---

## Examples

Check out the `examples/` directory for complete working examples:

- **React Example**: Full React app with encryption/decryption
- **Vue Example**: Full Vue 3 app with Composition API
- **Vanilla Example**: Plain JavaScript/TypeScript usage
- **Next.js Example**: Server-side rendering compatible

---

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

---

## License

This project is licensed under the **BSD-3-Clause-Clear License**. See [LICENSE](./LICENSE) for details.

---

## Acknowledgments

Built for the [Zama Bounty Program](https://www.zama.ai/post/developer-program-bounty-track-october-2024-build-an-universal-fhevm-sdk).

Powered by:
- [Zama FHEVM](https://docs.zama.ai/protocol/)
- [Relayer SDK](https://docs.zama.ai/protocol/relayer-sdk-guides/)
- [TypeScript](https://www.typescriptlang.org/)

---

## Support

- **Documentation**: [https://docs.zama.ai/protocol/](https://docs.zama.ai/protocol/)
- **Discord**: [https://discord.com/invite/zama](https://discord.com/invite/zama)
- **GitHub Issues**: [Report bugs or request features](https://github.com/zama-ai/fhevm-react-template/issues)

---

**Built for the Zama Community**
