import { createFHEVMClient } from 'fhevm-sdk/vanilla';
import { ethers } from 'ethers';

const CONTRACT_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
const CONTRACT_ABI = [
  'function getCount() view returns (bytes32)',
  'function increment(bytes32 encryptedValue, bytes proof)',
  'function decrement(bytes32 encryptedValue, bytes proof)',
];

async function main() {
  // Initialize provider and signer
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const userAddress = await signer.getAddress();

  // Initialize FHEVM client
  console.log('Initializing FHEVM client...');
  const client = await createFHEVMClient({
    provider: window.ethereum,
    chainId: 11155111,
  });
  console.log('FHEVM client ready');

  // Create contract instance
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

  // Increment counter
  console.log('Encrypting value...');
  const encrypted = await client.encrypt(
    (input) => input.add32(1),
    {
      contractAddress: CONTRACT_ADDRESS,
      userAddress,
    }
  );

  console.log('Sending increment transaction...');
  const tx = await contract.increment(encrypted.data, encrypted.inputProof);
  await tx.wait();
  console.log('Counter incremented');

  // Get encrypted handle
  console.log('Getting encrypted handle...');
  const handle = await contract.getCount();
  console.log('Handle:', handle);

  // Decrypt value
  console.log('Decrypting value...');
  const decrypted = await client.decrypt(
    [{ handle, contractAddress: CONTRACT_ADDRESS }],
    signer
  );
  console.log('Decrypted value:', decrypted[handle]);

  // Cleanup
  client.dispose();
}

// Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
