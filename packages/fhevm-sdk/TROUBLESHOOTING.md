# Troubleshooting Guide

Quick solutions to common issues when working with the Universal FHEVM SDK.

## Table of Contents

1. [Installation Issues](#installation-issues)
2. [TypeScript Errors](#typescript-errors)
3. [Initialization Problems](#initialization-problems)
4. [Encryption Issues](#encryption-issues)
5. [Decryption Issues](#decryption-issues)
6. [Framework-Specific Issues](#framework-specific-issues)
7. [Network & Chain Issues](#network--chain-issues)
8. [Build & Development](#build--development)

---

## Installation Issues

### Peer Dependencies Not Installed

**Error:**
```
npm WARN uni-fhevm-sdk@0.2.0 requires a peer of @fhevm/mock-utils@^0.1.0
npm WARN uni-fhevm-sdk@0.2.0 requires a peer of @zama-fhe/relayer-sdk@^0.2.0
```

**Fix:**
```bash
npm install @fhevm/mock-utils @zama-fhe/relayer-sdk
```

With npm 7+, peer dependencies are installed automatically. If you're on an older version, install them manually.

### Module Not Found

**Error:**
```
Cannot find module 'uni-fhevm-sdk/react'
Cannot find module 'uni-fhevm-sdk/vue'
```

**Fix:**

Check your `tsconfig.json` has proper module resolution:

```json
{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "resolveJsonModule": true
  }
}
```

If using older TypeScript, use `"moduleResolution": "node16"`.

---

## TypeScript Errors

### window.ethereum Property Missing

**Error:**
```
TS2339: Property 'ethereum' does not exist on type 'Window & typeof globalThis'
```

**Fix:**

Create a type definition file (e.g., `src/vite-env.d.ts`):

```typescript
/// <reference types="vite/client" />

interface Window {
  ethereum?: {
    isMetaMask?: boolean;
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    on: (event: string, callback: (...args: unknown[]) => void) => void;
    removeListener: (event: string, callback: (...args: unknown[]) => void) => void;
  };
}
```

### Provider Type Mismatch

**Error:**
```
Type '{ ... } | undefined' is not assignable to type 'string | Eip1193Provider'
```

**Fix:**

Add a type assertion:

```typescript
const client = await createFHEVMClient({
  provider: window.ethereum as any,
  chainId: 11155111,
});
```

Or in React:

```typescript
const { instance } = useFHEVM({
  provider: window.ethereum as any,
});
```

### Event Callback Type Mismatch

**Error:**
```
TS2345: Argument of type (accounts: string[]) => void is not assignable to parameter of type (...args: unknown[]) => void
```

**Fix:**

Use `any` for callback parameters:

```typescript
// Before: (accounts: string[])
// After: (accounts: any)

window.ethereum.on('accountsChanged', (accounts: any) => {
  if (accounts.length === 0) {
    disconnectWallet();
  } else {
    window.location.reload();
  }
});
```

---

## Initialization Problems

### Stuck on "Loading..." Forever

**Symptoms:** `isReady` never becomes `true`, UI shows loading state indefinitely.

**Common Causes:**
1. No wallet provider (MetaMask not installed)
2. Wallet not connected
3. Network RPC not responding
4. Wrong chain ID

**Debug:**

```typescript
const { instance, isReady, error, isLoading } = useFHEVM({
  provider: window.ethereum,
  chainId: 11155111,
});

// Add logging
useEffect(() => {
  console.log('FHEVM Status:', { isReady, isLoading, error });
}, [isReady, isLoading, error]);

if (error) {
  console.error('Initialization failed:', error);
}
```

**Solutions:**

1. Check MetaMask is installed:
```typescript
if (!window.ethereum) {
  alert('Please install MetaMask');
}
```

2. Verify network connection:
```typescript
const chainId = await window.ethereum.request({ method: 'eth_chainId' });
console.log('Connected to chain:', parseInt(chainId, 16));
```

3. Manually trigger initialization:
```typescript
const { init, reinit } = useFHEVM({ provider: window.ethereum });

// Try re-initializing
const handleRetry = () => {
  reinit();
};
```

### "FHEVM operation was cancelled"

**This is normal.** The SDK automatically aborts initialization when:
- Component unmounts
- Provider changes
- User switches networks

No action needed - the SDK handles cleanup automatically.

---

## Encryption Issues

### "Cannot encrypt: instance not ready"

**Cause:** Trying to encrypt before FHEVM is initialized.

**Fix:**

Always check `canEncrypt` before encrypting:

```typescript
const { encryptUint32, canEncrypt } = useFHEEncrypt({
  instance,
  signer,
  contractAddress: '0x...',
});

const handleEncrypt = async () => {
  if (!canEncrypt) {
    console.log('FHEVM not ready yet');
    return;
  }

  const encrypted = await encryptUint32(42);
  // Use encrypted.data and encrypted.inputProof
};
```

### "Contract address required"

**Cause:** Missing `contractAddress` in encryption config.

**Fix:**

```typescript
const { encryptUint32 } = useFHEEncrypt({
  instance,
  signer,
  contractAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb', // Required
});
```

### Encryption Fails Silently

**Debug steps:**

1. Check signer exists:
```typescript
console.log('Signer:', signer);
if (!signer) {
  console.error('No signer available');
}
```

2. Verify contract address format:
```typescript
if (!ethers.isAddress(contractAddress)) {
  console.error('Invalid contract address');
}
```

3. Check user address:
```typescript
const userAddress = await signer.getAddress();
console.log('User address:', userAddress);
```

---

## Decryption Issues

### "User rejected signature"

**This is normal.** User cancelled the MetaMask signature popup.

Handle gracefully:

```typescript
const { decrypt, isDecrypting } = useFHEDecrypt({
  instance,
  signer,
  requests: [{ handle: '0x...', contractAddress: '0x...' }],
});

const handleDecrypt = async () => {
  try {
    await decrypt();
  } catch (error) {
    if (error.message.includes('user rejected')) {
      console.log('User cancelled decryption');
    } else {
      console.error('Decryption failed:', error);
    }
  }
};
```

### Decryption Returns undefined

**Common causes:**

1. **Invalid handle** - Handle is `0x000...000`:
```typescript
const handle = await contract.getCounter();
if (handle === ethers.ZeroHash) {
  console.log('No value set yet');
}
```

2. **Missing FHE permissions** - Contract didn't grant permission:
```solidity
// In your contract, make sure to:
TFHE.allowTransient(encryptedValue, msg.sender);
```

3. **Wrong contract address** - Using different address than where value was stored:
```typescript
const { decrypt, results } = useFHEDecrypt({
  instance,
  signer,
  requests: [{
    handle: '0x...',
    contractAddress: CONTRACT_ADDRESS, // Must match where data was stored
  }],
});
```

### Multiple Handles, Some Undefined

Check results individually:

```typescript
const { decrypt, results } = useFHEDecrypt({
  instance,
  signer,
  requests: [
    { handle: handle1, contractAddress: CONTRACT_ADDRESS },
    { handle: handle2, contractAddress: CONTRACT_ADDRESS },
  ],
});

await decrypt();

// Check each result
console.log('Result 1:', results?.[handle1]); // May be undefined
console.log('Result 2:', results?.[handle2]); // May be undefined
```

---

## Framework-Specific Issues

### React: Infinite Re-renders

**Cause:** Creating new objects in hook dependencies.

**Bad:**
```typescript
const { instance } = useFHEVM({
  provider: window.ethereum,
  chainId: chainId, // Changes cause re-init
});
```

**Good:**
```typescript
// Only initialize once
const { instance } = useFHEVM({
  provider: window.ethereum,
  chainId: 11155111, // Static value
});
```

Or use state:

```typescript
const [config] = useState({
  provider: window.ethereum,
  chainId: 11155111,
});

const { instance } = useFHEVM(config);
```

### Vue: "Proxy is not extensible"

**Cause:** Vue wraps objects in Proxy, which conflicts with FHEVM internals.

**Fix:**

Use `markRaw` for non-reactive data:

```typescript
import { markRaw } from 'vue';

const { instance } = useFHEVM({ provider: window.ethereum });

// Mark instance as non-reactive
const rawInstance = markRaw(instance.value);
```

### Vue: Signer Creation Issues

**Don't use:**
```typescript
// ❌ This causes MetaMask caching issues
const signer = await provider.getSigner();
```

**Use instead:**
```typescript
// ✅ Direct constructor
const provider = new ethers.BrowserProvider(window.ethereum);
const accounts = await provider.send('eth_requestAccounts', []);
const signer = new ethers.JsonRpcSigner(provider, accounts[0]);
```

**Full Vue pattern:**

```vue
<script setup lang="ts">
import { ref, watch } from 'vue';
import { ethers } from 'ethers';

const account = ref<string>();
const signer = ref<ethers.JsonRpcSigner>();

watch([account], async ([newAccount]) => {
  if (newAccount && window.ethereum) {
    const ethersProvider = new ethers.BrowserProvider(window.ethereum);
    signer.value = new ethers.JsonRpcSigner(ethersProvider, newAccount);
  }
});

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

### Vanilla: Client Not Cleaning Up

**Issue:** Memory leaks when navigating between pages.

**Fix:**

Always call `dispose()`:

```typescript
const client = await createFHEVMClient({
  provider: window.ethereum,
});

// Use client...

// Cleanup when done
client.dispose();
```

For SPAs:

```typescript
// Store client globally
window.fhevmClient = await createFHEVMClient({ provider: window.ethereum });

// Cleanup on navigation
window.addEventListener('beforeunload', () => {
  window.fhevmClient?.dispose();
});
```

---

## Network & Chain Issues

### Wrong Network Connected

**Symptoms:** Transactions fail, unexpected behavior.

**Fix:**

Add network detection and switching:

```typescript
const EXPECTED_CHAIN_ID = 11155111; // Sepolia

const checkNetwork = async () => {
  const chainId = await window.ethereum.request({ method: 'eth_chainId' });
  const currentChainId = parseInt(chainId, 16);

  if (currentChainId !== EXPECTED_CHAIN_ID) {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${EXPECTED_CHAIN_ID.toString(16)}` }],
      });
    } catch (error) {
      console.error('Failed to switch network:', error);
    }
  }
};
```

### Localhost/Hardhat Not Working

**Issue:** SDK doesn't detect mock mode.

**Fix:**

Ensure you're on a mock chain (31337):

```typescript
// Hardhat
const { instance } = useFHEVM({
  provider: window.ethereum,
  chainId: 31337,
});
```

If still not working, force mock mode:

```typescript
const { instance } = useFHEVM({
  provider: window.ethereum,
  chainId: 31337,
  mockMode: true, // Force mock
});
```

### RPC Errors

**Error:**
```
Error: could not detect network (event="noNetwork", code=NETWORK_ERROR)
```

**Fix:**

1. Check RPC endpoint is accessible
2. Try different RPC (Infura, Alchemy, etc.)
3. Add custom RPC:

```typescript
const provider = new ethers.JsonRpcProvider('https://your-rpc-url');
const { instance } = useFHEVM({ provider });
```

---

## Build & Development

### Changes Not Appearing in Node.js Example

**Issue:** Edited `src/` files but browser shows old version.

**Cause:** Node.js example serves pre-built files from `dist/`, not `src/`.

**Fix:**

Run build after editing source files:

```bash
cd examples/nodejs
npm run build
```

The server serves from `dist/`:
- Edit files in `src/`
- Run `npm run build`
- Refresh browser

### Vite Build Errors

**Error:**
```
Failed to resolve import "@fhevm/mock-utils"
```

**Fix:**

Install peer dependencies:

```bash
npm install @fhevm/mock-utils @zama-fhe/relayer-sdk
```

Clear cache and rebuild:

```bash
rm -rf node_modules/.vite
npm run dev
```

### TypeScript Build Fails

**Error:**
```
error TS6133: 'ethersProvider' is declared but its value is never read
```

**Fix:**

Remove unused variables:

```typescript
// Before:
const [ethersProvider, setEthersProvider] = useState<any>(null);
const [signer, setSigner] = useState<any>(null);

// After (if ethersProvider unused):
const [signer, setSigner] = useState<any>(null);
```

### Hot Reload Not Working

**Fix:**

1. Restart dev server:
```bash
npm run dev
```

2. Clear Vite cache:
```bash
rm -rf node_modules/.vite
npm run dev
```

3. For Node.js example, rebuild:
```bash
npm run build
```

---

## Performance Issues

### Slow Initialization (>10 seconds)

**Causes:**
- First-time Relayer SDK download
- Slow RPC endpoint
- Network latency

**Solutions:**

1. Show loading indicator:
```typescript
const { isLoading, isReady } = useFHEVM({ provider: window.ethereum });

if (isLoading) {
  return <div>Initializing FHEVM... This may take a moment on first load.</div>;
}
```

2. Cache public keys (done automatically by SDK)

3. Use faster RPC endpoint

### Memory Usage Growing

**Cause:** Not cleaning up FHEVM instances.

**Fix:**

React:
```typescript
useEffect(() => {
  const { abort } = useFHEVM({ provider: window.ethereum });

  return () => {
    abort(); // Cleanup on unmount
  };
}, []);
```

Vanilla:
```typescript
client.dispose();
```

---

## Debug Mode

Enable detailed console logging:

```typescript
const { instance } = useFHEVM({
  provider: window.ethereum,
  chainId: 11155111,
  // debug: true, // If supported by SDK
});
```

Manual logging:

```typescript
const { instance, isReady, isLoading, error } = useFHEVM({
  provider: window.ethereum,
});

useEffect(() => {
  console.log('FHEVM State:', { isReady, isLoading, error });
}, [isReady, isLoading, error]);
```

---

## Still Having Issues?

If your problem isn't listed here:

1. **Check Examples** - Working code for all frameworks in [`examples/`](./examples/)
2. **Read API Docs** - Full reference in [README.md](./README.md#api-reference)
3. **Search GitHub** - [Existing issues](https://github.com/Farukest/fhevm-universal-sdk/issues)
4. **Ask Community** - [Zama Discord](https://discord.com/invite/zama)

When reporting bugs, include:
- SDK version (`npm list uni-fhevm-sdk`)
- Framework & version (React 18, Vue 3, etc.)
- Browser & version
- Network (Sepolia, Hardhat, etc.)
- Minimal reproduction code
- Full error message & stack trace

---

**Links:**
- **GitHub:** https://github.com/Farukest/fhevm-universal-sdk
- **npm:** https://www.npmjs.com/package/uni-fhevm-sdk
- **Zama Docs:** https://docs.zama.ai/fhevm
