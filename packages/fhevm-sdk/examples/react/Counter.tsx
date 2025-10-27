import { useState } from 'react';
import { useFHEVM, useFHEEncrypt, useFHEDecrypt } from 'fhevm-sdk/react';
import { useAccount, useSigner } from 'wagmi';
import { ethers } from 'ethers';

const CONTRACT_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
const CONTRACT_ABI = [
  'function getCount() view returns (bytes32)',
  'function increment(bytes32 encryptedValue, bytes proof)',
  'function decrement(bytes32 encryptedValue, bytes proof)',
];

export function Counter() {
  const { address, isConnected } = useAccount();
  const signer = useSigner();
  const [countHandle, setCountHandle] = useState<string>();

  // Initialize FHEVM
  const { instance, isReady, error: fhevmError } = useFHEVM({
    provider: window.ethereum,
    chainId: 11155111,
  });

  // Encryption
  const { encryptUint32, canEncrypt } = useFHEEncrypt({
    instance,
    signer,
    contractAddress: CONTRACT_ADDRESS,
  });

  // Decryption
  const requests = countHandle
    ? [{ handle: countHandle, contractAddress: CONTRACT_ADDRESS }]
    : undefined;

  const {
    decrypt,
    results,
    canDecrypt,
    isDecrypting,
  } = useFHEDecrypt({
    instance,
    signer,
    requests,
  });

  // Contract instance
  const contract = signer
    ? new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer)
    : null;

  // Handlers
  const handleIncrement = async () => {
    if (!contract || !canEncrypt) return;

    try {
      const encrypted = await encryptUint32(1);
      const tx = await contract.increment(encrypted.data, encrypted.inputProof);
      await tx.wait();
      await refreshCount();
    } catch (error) {
      console.error('Increment failed:', error);
    }
  };

  const handleDecrement = async () => {
    if (!contract || !canEncrypt) return;

    try {
      const encrypted = await encryptUint32(1);
      const tx = await contract.decrement(encrypted.data, encrypted.inputProof);
      await tx.wait();
      await refreshCount();
    } catch (error) {
      console.error('Decrement failed:', error);
    }
  };

  const refreshCount = async () => {
    if (!contract) return;

    try {
      const handle = await contract.getCount();
      setCountHandle(handle);
    } catch (error) {
      console.error('Failed to get count:', error);
    }
  };

  const handleDecrypt = async () => {
    if (!canDecrypt) return;

    try {
      await decrypt();
    } catch (error) {
      console.error('Decryption failed:', error);
    }
  };

  if (!isConnected) {
    return <div>Connect wallet to continue</div>;
  }

  if (!isReady) {
    return <div>Initializing FHEVM...</div>;
  }

  if (fhevmError) {
    return <div>Error: {fhevmError.message}</div>;
  }

  const decryptedValue = countHandle && results ? results[countHandle] : null;

  return (
    <div>
      <h2>FHE Counter</h2>

      <div>
        <p>Encrypted Handle: {countHandle || 'N/A'}</p>
        <p>Decrypted Value: {decryptedValue?.toString() || 'Not decrypted'}</p>
      </div>

      <div>
        <button onClick={handleIncrement} disabled={!canEncrypt}>
          Increment
        </button>
        <button onClick={handleDecrement} disabled={!canEncrypt}>
          Decrement
        </button>
        <button onClick={handleDecrypt} disabled={!canDecrypt || isDecrypting}>
          {isDecrypting ? 'Decrypting...' : 'Decrypt'}
        </button>
        <button onClick={refreshCount}>
          Refresh
        </button>
      </div>
    </div>
  );
}
