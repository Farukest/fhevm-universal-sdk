'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './globals.css';

// Contract ABI
const CONTRACT_ABI = [
  {
    inputs: [
      { internalType: "externalEuint32", name: "inputEuint32", type: "bytes32" },
      { internalType: "bytes", name: "inputProof", type: "bytes" }
    ],
    name: "decrement",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [],
    name: "getCount",
    outputs: [{ internalType: "euint32", name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { internalType: "externalEuint32", name: "inputEuint32", type: "bytes32" },
      { internalType: "bytes", name: "inputProof", type: "bytes" }
    ],
    name: "increment",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  }
];

// Contract addresses by network
const CONTRACT_ADDRESSES: Record<number, string> = {
  31337: '0x5FbDB2315678afecb367f032d93F642f64180aa3',      // Hardhat Local
  11155111: '0xaAE2668bdDCD244F62cCF1383b92bC7bfcEBB87C',  // Sepolia Testnet
};

// FHEVM-supported networks
const SUPPORTED_NETWORKS: Record<number, string> = {
  31337: 'Hardhat Local',
  11155111: 'Sepolia Testnet',
};

function App() {
  // State
  const [isInitializing, setIsInitializing] = useState(true);
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [ethersProvider, setEthersProvider] = useState<any>(null);
  const [readonlyProvider, setReadonlyProvider] = useState<any>(null);
  const [signer, setSigner] = useState<any>(null);
  const [fhevmClient, setFhevmClient] = useState<any>(null);
  const [fhevmInstance, setFhevmInstance] = useState<any>(null);
  const [fhevmStatus, setFhevmStatus] = useState<string>('idle');
  const [fhevmError, setFhevmError] = useState<string | null>(null);
  const [handle, setHandle] = useState<string | null>(null);
  const [clear, setClear] = useState<number | null>(null);
  const [isDecrypted, setIsDecrypted] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState('');

  // Helper functions
  const getContractAddress = () => {
    if (!chainId) return null;
    return CONTRACT_ADDRESSES[chainId] || null;
  };

  const getNetworkName = () => {
    if (!chainId) return 'Unknown';
    return SUPPORTED_NETWORKS[chainId] || `Chain ${chainId}`;
  };

  const isNetworkSupported = () => {
    if (!chainId) return false;
    return chainId in SUPPORTED_NETWORKS;
  };

  // Connect wallet
  const connectWallet = async () => {
    try {
      if (typeof window.ethereum === 'undefined') {
        setMessage('MetaMask is not installed');
        return;
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      const network = await provider.getNetwork();

      setEthersProvider(provider);
      setAccount(accounts[0]);
      setSigner(new ethers.JsonRpcSigner(provider, accounts[0]));
      setChainId(Number(network.chainId));

      // For Hardhat (31337), use localhost RPC. For Sepolia (11155111), use the connected provider
      if (Number(network.chainId) === 31337) {
        setReadonlyProvider(new ethers.JsonRpcProvider('http://localhost:8545'));
      } else {
        setReadonlyProvider(provider);
      }

      setMessage(`Connected to ${SUPPORTED_NETWORKS[Number(network.chainId)] || `Chain ${network.chainId}`}: ${accounts[0].slice(0, 6)}...${accounts[0].slice(-4)}`);

      // Initialize FHEVM after wallet connection
      if (Number(network.chainId) in SUPPORTED_NETWORKS) {
        setTimeout(() => initializeFHEVM(Number(network.chainId)), 500);
      }
    } catch (error: any) {
      setMessage(`Error connecting: ${error.message}`);
    }
  };

  // Disconnect wallet
  const disconnectWallet = () => {
    setEthersProvider(null);
    setReadonlyProvider(null);
    setAccount(null);
    setSigner(null);
    setChainId(null);
    setHandle(null);
    setClear(null);
    setIsDecrypted(false);
    setFhevmInstance(null);
    setFhevmStatus('idle');
    setMessage('Wallet disconnected');
  };

  // Initialize FHEVM
  const initializeFHEVM = async (currentChainId: number) => {
    try {
      setFhevmStatus('initializing');

      const { createFHEVMClient } = await import('uni-fhevm-sdk/vanilla');

      if (!createFHEVMClient) {
        throw new Error('SDK functions not found. Check if uni-fhevm-sdk is properly installed.');
      }

      // Create FHEVM client with provider and chainId
      const client = await createFHEVMClient({
        provider: window.ethereum,
        chainId: currentChainId,
      });

      setFhevmClient(client);
      setFhevmInstance(client.getInstance());
      setFhevmStatus('ready');
      setFhevmError(null);
      setMessage(`FHEVM initialized on ${SUPPORTED_NETWORKS[currentChainId]}!`);

      // Auto-refresh count after FHEVM initialization
      setTimeout(() => refreshCountHandle(), 1000);
    } catch (error: any) {
      setFhevmStatus('error');
      setFhevmError(error.message);
      setMessage(`FHEVM initialization failed: ${error.message}`);
    }
  };

  // Refresh count handle
  const refreshCountHandle = async () => {
    if (!account || !readonlyProvider || isRefreshing) {
      return;
    }

    try {
      setIsRefreshing(true);
      setMessage('Fetching encrypted count handle...');

      const contractAddress = getContractAddress();
      const contract = new ethers.Contract(contractAddress!, CONTRACT_ABI, readonlyProvider);
      const countHandle = await contract.getCount();

      setHandle(countHandle.toString());
      setIsDecrypted(false);
      setClear(null);
      setMessage(`Got encrypted handle: ${countHandle.toString().slice(0, 20)}...`);
    } catch (error: any) {
      setMessage(`Error fetching count: ${error.message}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Decrypt count handle (user decrypt with EIP-712)
  const decryptCountHandle = async () => {
    if (!handle || !fhevmClient || !signer || isDecrypting) {
      return;
    }

    try {
      setIsDecrypting(true);
      setMessage('Decrypting count handle...');

      const contractAddress = getContractAddress();

      // Use SDK's decrypt method
      const results = await fhevmClient.decrypt(
        [{ handle: handle, contractAddress: contractAddress! }],
        signer
      );

      const decryptedValue = results[handle];
      setClear(Number(decryptedValue));
      setIsDecrypted(true);
      setMessage(`Decrypted value: ${decryptedValue}`);
    } catch (error: any) {
      setMessage(`Error decrypting: ${error.message}`);
    } finally {
      setIsDecrypting(false);
    }
  };

  // Public decrypt count handle (no signature needed)
  const publicDecryptCountHandle = async () => {
    if (!handle || !fhevmClient || isDecrypting) {
      return;
    }

    try {
      setIsDecrypting(true);
      setMessage('Public decrypting count handle (no signature)...');

      // Use SDK's publicDecryptSingle method - no signature required
      const decryptedValue = await fhevmClient.publicDecryptSingle(handle);

      setClear(Number(decryptedValue));
      setIsDecrypted(true);
      setMessage(`Public decrypted value: ${decryptedValue}`);
    } catch (error: any) {
      setMessage(`Error public decrypting: ${error.message}`);
    } finally {
      setIsDecrypting(false);
    }
  };

  // Update counter (increment or decrement)
  const updateCounter = async (delta: number) => {
    if (!account || !signer || !fhevmClient || isProcessing) {
      return;
    }

    try {
      setIsProcessing(true);
      const action = delta > 0 ? 'Incrementing' : 'Decrementing';
      setMessage(`${action} counter...`);

      const contractAddress = getContractAddress();

      // Encrypt the input using SDK
      const encrypted = await fhevmClient.encryptValue(Math.abs(delta), 'uint32', {
        contractAddress: contractAddress!,
        userAddress: account
      });

      // Call contract
      const contract = new ethers.Contract(contractAddress!, CONTRACT_ABI, signer);
      const tx = delta > 0
        ? await contract.increment(encrypted.handles[0], encrypted.inputProof)
        : await contract.decrement(encrypted.handles[0], encrypted.inputProof);

      setMessage(`Transaction sent: ${tx.hash.slice(0, 10)}... Waiting for confirmation...`);

      await tx.wait();

      setMessage(`Counter ${delta > 0 ? 'incremented' : 'decremented'} successfully!`);

      // Refresh handle after update
      setTimeout(() => refreshCountHandle(), 1000);
    } catch (error: any) {
      setMessage(`Error updating counter: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Auto-connect on mount
  useEffect(() => {
    const autoConnect = async () => {
      if (typeof window.ethereum !== 'undefined') {
        try {
          const provider = new ethers.BrowserProvider(window.ethereum);
          const accounts = await provider.send('eth_accounts', []);

          if (accounts.length > 0) {
            const network = await provider.getNetwork();

            setEthersProvider(provider);
            setAccount(accounts[0]);
            setSigner(new ethers.JsonRpcSigner(provider, accounts[0]));
            setChainId(Number(network.chainId));

            if (Number(network.chainId) === 31337) {
              setReadonlyProvider(new ethers.JsonRpcProvider('http://localhost:8545'));
            } else {
              setReadonlyProvider(provider);
            }

            setMessage(`Auto-connected to ${SUPPORTED_NETWORKS[Number(network.chainId)] || `Chain ${network.chainId}`}: ${accounts[0].slice(0, 6)}...${accounts[0].slice(-4)}`);

            // Initialize FHEVM if network is supported
            if (Number(network.chainId) in SUPPORTED_NETWORKS) {
              setTimeout(() => initializeFHEVM(Number(network.chainId)), 500);
            }
          }
        } catch (error) {
          // Silent fail - user can manually connect
        }
      }

      setIsInitializing(false);
    };

    autoConnect();

    // Listen for account and chain changes
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts: string[]) => {
        if (accounts.length === 0) {
          disconnectWallet();
        } else {
          window.location.reload();
        }
      });

      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });
    }
  }, []);

  // Computed values
  const canDecrypt = !!handle && !isDecrypting && !isDecrypted && !!fhevmInstance;
  const canUpdateCounter = !!account && !isProcessing && !!fhevmInstance && !!signer;

  // Render loading screen
  if (isInitializing) {
    return (
      <div className="center-screen">
        <div className="message-card">
          <div className="message-card-icon icon-loading">
            <div className="spinner"></div>
          </div>
          <h2>Loading...</h2>
          <p>Initializing application</p>
        </div>
      </div>
    );
  }

  // Render FHEVM initializing screen
  if (account && fhevmStatus === 'initializing') {
    return (
      <>
        <WalletHeader
          account={account}
          chainId={chainId}
          fhevmStatus={fhevmStatus}
          onDisconnect={disconnectWallet}
        />
        <div className="center-screen">
          <div className="message-card">
            <div className="message-card-icon icon-loading">
              <div className="spinner"></div>
            </div>
            <h2>Initializing FHEVM...</h2>
            <p>Network: <strong>{getNetworkName()}</strong></p>
            <p>Loading encryption libraries and connecting to the network.</p>
            <p style={{ fontSize: '0.875rem', color: '#6B7280' }}>This may take a few seconds on first load.</p>
          </div>
        </div>
      </>
    );
  }

  // Render unsupported network screen
  if (account && !isNetworkSupported()) {
    const supportedNetworksList = Object.entries(SUPPORTED_NETWORKS)
      .map(([id, name]) => `${name} (${id})`)
      .join(', ');

    return (
      <>
        <WalletHeader
          account={account}
          chainId={chainId}
          fhevmStatus={fhevmStatus}
          onDisconnect={disconnectWallet}
        />
        <div className="center-screen">
          <div className="message-card">
            <div className="message-card-icon icon-warning">⚠️</div>
            <h2>FHEVM Not Supported</h2>
            <p>Current network: <strong>{getNetworkName()} ({chainId})</strong></p>
            <p>FHEVM is not available on this network.</p>
            <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', padding: '1rem', marginBottom: '1.5rem', textAlign: 'left' }}>
              <p style={{ fontSize: '0.875rem', color: '#1F2937', fontWeight: 600, marginBottom: '0.5rem' }}>Supported Networks:</p>
              <p style={{ fontSize: '0.875rem', color: '#4B5563' }}>{supportedNetworksList}</p>
            </div>
            <button onClick={disconnectWallet} className="btn btn-primary">Disconnect & Switch Network</button>
          </div>
        </div>
      </>
    );
  }

  // Render not connected screen
  if (!account) {
    return (
      <>
        <WalletHeader
          account={null}
          chainId={null}
          fhevmStatus={fhevmStatus}
          onConnect={connectWallet}
        />
        <div className="center-screen">
          <div className="message-card">
            <div className="message-card-icon icon-warning">⚠️</div>
            <h2>Wallet not connected</h2>
            <p>Connect your wallet to use the FHE Counter demo.</p>
            <button onClick={connectWallet} className="btn btn-primary">Connect Wallet</button>
          </div>
        </div>
      </>
    );
  }

  // Render main app
  return (
    <>
      <WalletHeader
        account={account}
        chainId={chainId}
        fhevmStatus={fhevmStatus}
        onDisconnect={disconnectWallet}
      />
      <div className="app-container">
        {/* Header */}
        <div className="app-header">
          <h1>FHE Counter Demo (NextJS)</h1>
          <p>Interact with the Fully Homomorphic Encryption Counter contract</p>
        </div>

        {/* Count Handle Display */}
        <div className="section">
          <h3 className="section-title">🔢 Count Handle</h3>
          <div className="property-list">
            <PropertyRow name="Encrypted Handle" value={handle || 'No handle available'} />
            <PropertyRow name="Decrypted Value" value={isDecrypted ? clear : 'Not decrypted yet'} />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="action-grid">
          <button
            onClick={decryptCountHandle}
            className={`btn ${isDecrypted ? 'btn-success' : 'btn-primary'}`}
            disabled={!canDecrypt}
          >
            {canDecrypt
              ? '🔓 Decrypt Counter (EIP-712)'
              : isDecrypted
                ? `✅ Decrypted: ${clear}`
                : isDecrypting
                  ? '⏳ Decrypting...'
                  : '❌ Nothing to decrypt'
            }
          </button>

          <button
            onClick={publicDecryptCountHandle}
            className={`btn ${isDecrypted ? 'btn-success' : 'btn-primary'}`}
            disabled={!handle || !fhevmClient || isDecrypting}
          >
            {isDecrypting
              ? '⏳ Public Decrypting...'
              : handle && fhevmClient
                ? '🔓 Public Decrypt (No Signature)'
                : '❌ Nothing to decrypt'
            }
          </button>

          <button
            onClick={() => updateCounter(1)}
            className="btn btn-secondary"
            disabled={!canUpdateCounter}
          >
            {canUpdateCounter
              ? '➕ Increment +1'
              : isProcessing
                ? '⏳ Processing...'
                : '❌ Cannot increment'
            }
          </button>

          <button
            onClick={() => updateCounter(-1)}
            className="btn btn-secondary"
            disabled={!canUpdateCounter}
          >
            {canUpdateCounter
              ? '➖ Decrement -1'
              : isProcessing
                ? '⏳ Processing...'
                : '❌ Cannot decrement'
            }
          </button>
        </div>

        {/* Messages */}
        {message && (
          <div className="section">
            <h3 className="section-title">💬 Messages</h3>
            <div className="messages-box">
              <p>{message}</p>
            </div>
          </div>
        )}

        {/* Status Cards */}
        <div className="status-grid">
          <div className="section">
            <h3 className="section-title">🔧 FHEVM Instance</h3>
            <div className="property-list">
              <PropertyRow name="Instance Status" value={fhevmInstance ? '✅ Connected' : '❌ Disconnected'} />
              <PropertyRow name="Status" value={fhevmStatus} />
              <PropertyRow name="Error" value={fhevmError ?? 'No errors'} />
            </div>
          </div>

          <div className="section">
            <h3 className="section-title">📊 Counter Status</h3>
            <div className="property-list">
              <BooleanPropertyRow name="Refreshing" value={isRefreshing} />
              <BooleanPropertyRow name="Decrypting" value={isDecrypting} />
              <BooleanPropertyRow name="Processing" value={isProcessing} />
              <BooleanPropertyRow name="Can Get Count" value={!!account && !isRefreshing && !!readonlyProvider} />
              <BooleanPropertyRow name="Can Decrypt" value={canDecrypt} />
              <BooleanPropertyRow name="Can Modify" value={canUpdateCounter} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Helper Components
interface WalletHeaderProps {
  account: string | null;
  chainId: number | null;
  fhevmStatus: string;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

function WalletHeader({ account, chainId, fhevmStatus, onConnect, onDisconnect }: WalletHeaderProps) {
  const isFhevmSupported = chainId && (chainId in SUPPORTED_NETWORKS);
  const networkName = chainId ? (SUPPORTED_NETWORKS[chainId] || `Chain ${chainId}`) : 'Unknown';

  if (!account) {
    return (
      <div className="wallet-header">
        <button onClick={onConnect} className="btn btn-primary">Connect Wallet</button>
      </div>
    );
  }

  return (
    <div className="wallet-header">
      <div className="wallet-info">
        <span className="wallet-address">
          {account.slice(0, 6)}...{account.slice(-4)}
        </span>
        {chainId && (
          <span className={`network-badge ${isFhevmSupported ? 'supported' : 'unsupported'}`}>
            {networkName}
          </span>
        )}
        {account && fhevmStatus && (
          <span className="fhevm-status-badge">
            {fhevmStatus}
          </span>
        )}
        <button onClick={onDisconnect} className="btn btn-secondary">Disconnect</button>
      </div>
    </div>
  );
}

interface PropertyRowProps {
  name: string;
  value: any;
}

function PropertyRow({ name, value }: PropertyRowProps) {
  let displayValue: string;

  if (typeof value === 'string' || typeof value === 'number') {
    displayValue = String(value);
  } else if (typeof value === 'bigint') {
    displayValue = String(value);
  } else if (value === null) {
    displayValue = 'null';
  } else if (value === undefined) {
    displayValue = 'undefined';
  } else {
    displayValue = JSON.stringify(value);
  }

  return (
    <div className="property-row">
      <span className="property-name">{name}</span>
      <span className="property-value">{displayValue}</span>
    </div>
  );
}

interface BooleanPropertyRowProps {
  name: string;
  value: boolean;
}

function BooleanPropertyRow({ name, value }: BooleanPropertyRowProps) {
  const className = value ? 'boolean-true' : 'boolean-false';
  const displayValue = value ? '✓ true' : '✗ false';

  return (
    <div className="property-row">
      <span className="property-name">{name}</span>
      <span className={`property-value ${className}`}>{displayValue}</span>
    </div>
  );
}

export default App;
