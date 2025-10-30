# Universal FHEVM SDK

A **framework-agnostic SDK** for building confidential dApps with Fully Homomorphic Encryption (FHE). Works with React, Vue, Vanilla JS, Node.js, and Next.js.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-BSD--3--Clause-green)](./LICENSE)

---

## 📚 Documentation

**[📖 Complete SDK Documentation →](./packages/fhevm-sdk/README.md)**

For detailed API reference, examples, and advanced usage, see the SDK documentation.

---

## 📦 Project Structure

```
fhevm-react-template/
├── packages/
│   ├── fhevm-sdk/              # Universal FHEVM SDK
│   │   ├── src/
│   │   │   ├── core/           # Framework-agnostic core
│   │   │   ├── adapters/       # React, Vue, Vanilla adapters
│   │   │   ├── internal/       # Internal utilities
│   │   │   └── storage/        # Storage abstraction
│   │   └── README.md           # Complete SDK documentation
│   │
│   ├── hardhat/                # Smart contracts & deployment
│   ├── react/                  # React example
│   ├── vue/                    # Vue example
│   ├── vanilla/                # Vanilla JS example
│   ├── nodejs/                 # Node.js example
│   └── nextjs/                 # Next.js example
│
└── README.md                   # This file
```

---

## 🎯 Wagmi-Like API

Inspired by wagmi, this SDK provides familiar patterns for web3 developers:

```typescript
// Wagmi (Ethereum)
const { data } = useContractRead({ ... });

// Our SDK (FHEVM)
const { instance, isReady } = useFHEVM({ provider, chainId });
const { encrypt, encryptUint32 } = useFHEEncrypt({ instance, signer, contractAddress });
const { decrypt, results, isDecrypting } = useFHEDecrypt({ instance, signer, requests });
```

Single package with zero config - no need to manage `@zama-fhe/relayer-sdk`, `@fhevm/mock-utils`, or other dependencies. Everything is bundled and ready to use.

---

## 📘 Quick Start

### Option 1: Use the SDK in Your Project

```bash
npm install fhevm-sdk ethers
```

**React (Hooks):**
```tsx
import { useFHEVM, useFHEEncrypt, useFHEDecrypt } from 'fhevm-sdk/react';

// Initialize
const { instance, isReady } = useFHEVM({ provider: window.ethereum });

// Encrypt
const { encryptUint32 } = useFHEEncrypt({ instance, signer, contractAddress });
const encrypted = await encryptUint32(42);

// Decrypt (with EIP-712 signature)
const { decrypt, results } = useFHEDecrypt({ instance, signer, requests: [{ handle, contractAddress }] });
await decrypt();

// Public Decrypt (no signature)
const { publicDecryptSingle } = useFHEDecrypt({ instance, signer });
const value = await publicDecryptSingle(handle);
```

**Vue (Composables):**
```vue
<script setup>
import { useFHEVM, useFHEEncrypt, useFHEDecrypt } from 'fhevm-sdk/vue';

// Initialize
const { instance, isReady } = useFHEVM({ provider: window.ethereum });

// Encrypt
const { encryptUint32 } = useFHEEncrypt({ instance, signer, contractAddress });
const encrypted = await encryptUint32(42);

// Decrypt (with EIP-712 signature)
const { decrypt, results } = useFHEDecrypt({ instance, signer, requests: [{ handle, contractAddress }] });
await decrypt();

// Public Decrypt (no signature)
const { publicDecryptSingle } = useFHEDecrypt({ instance, signer });
const value = await publicDecryptSingle(handle);
</script>
```

**Vanilla JS / Node.js / Next.js:**
```typescript
import { createFHEVMClient } from 'fhevm-sdk/vanilla';

// Initialize
const client = await createFHEVMClient({ provider: window.ethereum });

// Encrypt
const encrypted = await client.encryptValue(42, 'uint32', { contractAddress, userAddress });

// Decrypt (with EIP-712 signature)
const results = await client.decrypt([{ handle, contractAddress }], signer);

// Public Decrypt (no signature)
const value = await client.publicDecryptSingle(handle);
```

### Option 2: Run the Full Example

This repository includes 5 complete framework examples:

```bash
# Clone the repository
git clone <repository-url>
cd fhevm-react-template

# Install all packages from root
pnpm install

# Terminal 1: Start local Hardhat node
pnpm chain

# Terminal 2: Deploy contracts & generate ABI
pnpm deploy:localhost

# Terminal 3: Start your desired frontend
pnpm start:react      # React (Vite) - http://localhost:5173
pnpm start:vue        # Vue 3 - http://localhost:5174
pnpm start:vanilla    # Vanilla JS - http://localhost:5175
pnpm start:nodejs     # Node.js server - http://localhost:3000
pnpm start:nextjs     # Next.js - http://localhost:3000
```

---

## 💎 Key Features

### Framework-Agnostic Core

The SDK is built with a 100% framework-independent core:
- No React/Vue/framework dependencies in core logic
- Easy to add new framework adapters
- Works in Node.js, browser, any environment

### Framework Support

| Framework | Implementation |
|-----------|----------------|
| **React** | Hooks: `useFHEVM`, `useFHEEncrypt`, `useFHEDecrypt` |
| **Vue 3** | Composables: Same API, reactive `Ref` returns |
| **Vanilla JS** | Promise-based: `createFHEVMClient` |
| **Node.js** | Server-side encryption/decryption |
| **Next.js** | SSR-compatible with client components |

### Complete FHE Flow

- **Encryption**: Encrypt values locally before sending to contracts
- **User Decryption**: Decrypt values with EIP-712 signatures (private to user)
- **Public Decryption**: Decrypt values publicly on-chain
- **Automatic Signature Caching**: No repeated wallet prompts

---

## 🏛️ Architecture

### Core Design

```
Application Layer (React, Vue, Vanilla JS, Node.js, Next.js)
         ↓
Framework Adapters (Hooks, Composables, Promises)
         ↓
Core SDK (Framework-Agnostic)
 • FHEVMClient Manager
 • Encryption Builder
 • Decryption Manager
 • Storage Abstraction
         ↓
Zama FHEVM Infrastructure (Relayer SDK, Mock Utils)
```

### Design Principles

1. **Separation of Concerns**: Core logic is 100% framework-agnostic
2. **Adapter Pattern**: Framework-specific code in thin adapters
3. **Wagmi-like DX**: Familiar API for web3 developers
4. **Type Safety**: Full TypeScript coverage
5. **Modularity**: Import only what you need

---

## 🔨 Development

### Build the SDK

```bash
cd packages/fhevm-sdk
pnpm build
```

### Watch mode (auto-rebuild)

```bash
pnpm sdk:watch
```

### Project Scripts

```bash
# Blockchain
pnpm chain              # Start local Hardhat node
pnpm deploy:localhost   # Deploy contracts to localhost
pnpm deploy:sepolia     # Deploy to Sepolia testnet

# Frontend Examples
pnpm start:react        # Start React frontend
pnpm start:vue          # Start Vue frontend
pnpm start:vanilla      # Start Vanilla JS frontend
pnpm start:nodejs       # Start Node.js server
pnpm start:nextjs       # Start Next.js frontend

# SDK Development
pnpm sdk:build          # Build SDK
pnpm sdk:watch          # Watch mode (auto-rebuild)
pnpm sdk:test           # Run SDK tests
```

---

## ⚖️ License

This project is licensed under the **BSD-3-Clause-Clear License**. See [LICENSE](./LICENSE) for details.

---

## 🔗 Resources

- **📖 SDK Documentation**: [packages/fhevm-sdk/README.md](./packages/fhevm-sdk/README.md)
- **🌐 Zama Docs**: [https://docs.zama.ai/protocol/](https://docs.zama.ai/protocol/)
- **💬 Discord**: [https://discord.com/invite/zama](https://discord.com/invite/zama)

---

**Powered by Zama FHEVM**
