# Quick Start Guide

## Installation

```bash
npm install fhevm-sdk ethers
```

## React Setup

### 1. Initialize FHEVM

```tsx
import { useFHEVM } from 'fhevm-sdk/react';

function App() {
  const { instance, isReady, error } = useFHEVM({
    provider: window.ethereum,
    chainId: 11155111,
  });

  if (!isReady) return <div>Initializing...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <div>FHEVM Ready</div>;
}
```

### 2. Encrypt Values

```tsx
import { useFHEEncrypt } from 'fhevm-sdk/react';

const { encryptUint32 } = useFHEEncrypt({
  instance,
  signer,
  contractAddress: '0x...',
});

const encrypted = await encryptUint32(42);
// Use encrypted.data and encrypted.inputProof in contract call
```

### 3. Decrypt Values

```tsx
import { useFHEDecrypt } from 'fhevm-sdk/react';

const { decrypt, results } = useFHEDecrypt({
  instance,
  signer,
  requests: [{ handle: '0x...', contractAddress: '0x...' }],
});

await decrypt();
console.log(results); // { '0x...': 42n }
```

## Vue Setup

### 1. Initialize FHEVM

```vue
<script setup>
import { useFHEVM } from 'fhevm-sdk/vue';

const { instance, isReady, error } = useFHEVM({
  provider: window.ethereum,
  chainId: 11155111,
});
</script>

<template>
  <div v-if="!isReady">Initializing...</div>
  <div v-else-if="error">Error: {{ error.message }}</div>
  <div v-else>FHEVM Ready</div>
</template>
```

### 2. Encrypt and Decrypt

```vue
<script setup>
import { useFHEEncrypt, useFHEDecrypt } from 'fhevm-sdk/vue';

const { encryptUint32 } = useFHEEncrypt({
  instance,
  signer,
  contractAddress: '0x...',
});

const { decrypt, results } = useFHEDecrypt({
  instance,
  signer,
  requests,
});
</script>
```

## Vanilla JavaScript

### 1. Initialize Client

```typescript
import { createFHEVMClient } from 'fhevm-sdk/vanilla';

const client = await createFHEVMClient({
  provider: window.ethereum,
  chainId: 11155111,
});
```

### 2. Encrypt

```typescript
const encrypted = await client.encrypt(
  (input) => input.add32(42),
  { contractAddress: '0x...', userAddress: '0x...' }
);
```

### 3. Decrypt

```typescript
const decrypted = await client.decrypt(
  [{ handle: '0x...', contractAddress: '0x...' }],
  signer
);
```

## Contract Integration

### Solidity Contract

```solidity
contract Example {
    euint32 private value;

    function setValue(bytes32 encryptedValue, bytes proof) public {
        euint32 val = TFHE.asEuint32(encryptedValue, proof);
        value = val;
    }

    function getValue() public view returns (bytes32) {
        return TFHE.handle(value);
    }
}
```

### Frontend Integration

```typescript
// Encrypt value
const encrypted = await encryptUint32(42);

// Send to contract
await contract.setValue(encrypted.data, encrypted.inputProof);

// Get encrypted handle
const handle = await contract.getValue();

// Decrypt
const { decrypt, results } = useFHEDecrypt({
  instance,
  signer,
  requests: [{ handle, contractAddress }],
});

await decrypt();
console.log(results[handle]); // 42n
```

## Next Steps

- Check the [API Reference](./README.md#-api-reference) for detailed documentation
- See [examples/](./examples/) for complete working examples
- Read [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) if you encounter issues
