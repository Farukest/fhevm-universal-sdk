# Troubleshooting Guide

## Common Issues

### Installation Errors

#### Peer dependency warnings

```bash
npm WARN fhevm-sdk@0.1.0 requires a peer of ethers@^6.13.4
```

**Solution**: Install ethers as a peer dependency.

```bash
npm install ethers@^6.13.4
```

#### Module not found

```
Cannot find module 'fhevm-sdk/react'
```

**Solution**: Ensure your package.json has the correct import path.

```json
{
  "dependencies": {
    "fhevm-sdk": "^0.1.0"
  }
}
```

### Initialization Issues

#### Instance stuck in "initializing" state

**Symptoms**: `isReady` never becomes `true`, `status` remains "initializing".

**Causes**:
- Network connectivity issues
- Incorrect RPC endpoint
- Provider not available

**Solution**:

```typescript
// Check provider is available
if (!window.ethereum) {
  console.error('No wallet provider found');
}

// Verify network
const chainId = await window.ethereum.request({ method: 'eth_chainId' });
console.log('Connected to chain:', parseInt(chainId, 16));

// Use explicit error handling
const { instance, error } = useFHEVM({
  provider: window.ethereum,
  chainId: 11155111,
});

if (error) {
  console.error('Initialization failed:', error);
}
```

#### "FHEVM operation was cancelled" error

**Cause**: Component unmounted during initialization or network switch.

**Solution**: This is expected behavior. The SDK automatically cleans up when the component unmounts or provider changes.

### Encryption Errors

#### "Cannot encrypt: instance not ready"

**Cause**: Attempting to encrypt before FHEVM initialization completes.

**Solution**: Check `canEncrypt` before encrypting.

```typescript
const { encryptUint32, canEncrypt } = useFHEEncrypt({
  instance,
  signer,
  contractAddress,
});

if (canEncrypt) {
  const encrypted = await encryptUint32(42);
}
```

#### "Contract address required"

**Cause**: Missing `contractAddress` in encryption config.

**Solution**: Provide the contract address.

```typescript
const { encryptUint32 } = useFHEEncrypt({
  instance,
  signer,
  contractAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
});
```

### Decryption Errors

#### "User rejected signature"

**Cause**: User cancelled the MetaMask signature popup.

**Solution**: This is expected. Inform the user to approve the signature.

```typescript
try {
  await decrypt();
} catch (error) {
  if (error.message.includes('user rejected')) {
    console.log('User cancelled decryption');
  }
}
```

#### Decryption returns undefined

**Cause**: Handle not found or invalid.

**Solution**: Verify the handle exists and is correct.

```typescript
const handle = await contract.getValue();
console.log('Handle:', handle);

if (handle === ethers.ZeroHash) {
  console.log('No value set yet');
}
```

### Network Issues

#### Wrong network

**Symptoms**: Transactions fail, unexpected behavior.

**Solution**: Check connected network matches configuration.

```typescript
const { chainId } = useAccount(); // wagmi

const { instance } = useFHEVM({
  provider: window.ethereum,
  chainId, // Use current network
});
```

#### Localhost/Hardhat not working

**Symptoms**: Cannot connect to local node.

**Solution**: Configure mock chains.

```typescript
const { instance } = useFHEVM({
  provider: window.ethereum,
  chainId: 31337,
  mockChains: {
    31337: 'http://localhost:8545',
  },
});
```

### TypeScript Errors

#### Type mismatch on signer

```
Type 'JsonRpcSigner | null' is not assignable to type 'JsonRpcSigner'
```

**Solution**: Handle null case.

```typescript
const signer = useSigner();

const { encryptUint32 } = useFHEEncrypt({
  instance,
  signer: signer || undefined,
  contractAddress,
});
```

#### Module resolution errors

```
Cannot find module 'fhevm-sdk/react'
```

**Solution**: Check tsconfig.json module resolution.

```json
{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "resolveJsonModule": true
  }
}
```

### Performance Issues

#### Slow initialization

**Symptoms**: Takes >10 seconds to initialize.

**Causes**:
- Network latency
- First-time Relayer SDK download

**Solution**: Show loading indicator and cache public keys.

```typescript
const { status } = useFHEVM({ provider, chainId });

if (status === 'initializing') {
  return <div>Loading FHEVM SDK...</div>;
}
```

#### Memory leaks

**Symptoms**: Increasing memory usage over time.

**Solution**: Ensure proper cleanup.

```typescript
useEffect(() => {
  const { abort } = useFHEVM({ provider, chainId });

  return () => {
    abort(); // Cleanup on unmount
  };
}, []);
```

## Debug Mode

Enable detailed logging:

```typescript
const { instance } = useFHEVM({
  provider: window.ethereum,
  chainId: 11155111,
  debug: true, // Enable console logs
});
```

## Getting Help

If your issue is not listed here:

1. Check the [API Reference](./README.md#-api-reference)
2. Review [examples/](./examples/) for working code
3. Search existing [GitHub Issues](https://github.com/zama-ai/fhevm-react-template/issues)
4. Ask on [Zama Discord](https://discord.com/invite/zama)

## Reporting Bugs

When reporting issues, include:

- SDK version
- Framework and version (React 18, Vue 3, etc.)
- Browser and version
- Network (Sepolia, Hardhat, etc.)
- Minimal code to reproduce
- Error messages and stack traces
