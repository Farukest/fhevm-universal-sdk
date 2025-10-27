# Examples

This directory contains working examples for different frameworks and use cases.

## React

See [react/Counter.tsx](./react/Counter.tsx) for a complete React component using:
- `useFHEVM` for initialization
- `useFHEEncrypt` for encryption
- `useFHEDecrypt` for decryption
- Contract interaction with ethers

## Vue

See [vue/Counter.vue](./vue/Counter.vue) for a complete Vue 3 component using:
- Composition API
- Reactive refs
- Same SDK API as React

## Vanilla JavaScript

See [vanilla/counter.ts](./vanilla/counter.ts) for pure JavaScript/TypeScript usage:
- No framework dependencies
- Direct client API
- Async/await flow

## Running Examples

### React

```bash
# Install dependencies
npm install fhevm-sdk ethers react wagmi

# Copy Counter.tsx to your project
cp examples/react/Counter.tsx src/components/

# Import and use
import { Counter } from './components/Counter';
```

### Vue

```bash
# Install dependencies
npm install fhevm-sdk ethers vue

# Copy Counter.vue to your project
cp examples/vue/Counter.vue src/components/

# Import and use
import Counter from './components/Counter.vue';
```

### Vanilla

```bash
# Install dependencies
npm install fhevm-sdk ethers

# Copy counter.ts to your project
cp examples/vanilla/counter.ts src/

# Bundle with your preferred bundler (Vite, Webpack, etc.)
```

## Contract

All examples use this simplified contract:

```solidity
contract Counter {
    euint32 private count;

    function increment(bytes32 encryptedValue, bytes proof) external {
        euint32 value = TFHE.asEuint32(encryptedValue, proof);
        count = TFHE.add(count, value);
    }

    function decrement(bytes32 encryptedValue, bytes proof) external {
        euint32 value = TFHE.asEuint32(encryptedValue, proof);
        count = TFHE.sub(count, value);
    }

    function getCount() external view returns (bytes32) {
        return TFHE.handle(count);
    }
}
```

## Notes

- Replace `CONTRACT_ADDRESS` with your deployed contract address
- Ensure wallet is connected before using
- Handle errors appropriately in production
- See [TROUBLESHOOTING.md](../TROUBLESHOOTING.md) for common issues
