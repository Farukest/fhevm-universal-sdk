import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useFHEVM, useFHEEncrypt, useFHEDecrypt } from 'uni-fhevm-sdk/react';
import './index.css';

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
  11155111: '0xA91422DBbfbc125C0A852281a391D89389C4D69C',  // Sepolia Testnet
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
  const [readonlyProvider, setReadonlyProvider] = useState<any>(null);
  const [signer, setSigner] = useState<any>(null);
  const [handle, setHandle] = useState<string | null>(null);
  const [isDecrypted, setIsDecrypted] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const [publicDecryptedValue, setPublicDecryptedValue] = useState<number | null>(null);

  // Initialize FHEVM using the SDK hook
  const { instance: fhevmInstance, status: fhevmStatus, error: fhevmError } = useFHEVM({
    provider: window.ethereum as any,
    chainId: chainId || undefined,
  });

  // Get contract address for current chain
  const getContractAddress = () => {
    if (!chainId) return null;
    return CONTRACT_ADDRESSES[chainId] || null;
  };

  const contractAddress = getContractAddress();

  // Setup encryption hook
  const { encrypt, canEncrypt } = useFHEEncrypt({
    instance: fhevmInstance,
    signer: signer,
    contractAddress: contractAddress || undefined,
  });

  // Setup decryption hook
  const decryptRequests = handle && contractAddress
    ? [{ handle, contractAddress }]
    : [];

  const { decrypt, results: decryptResults, isDecrypting, clearResults, publicDecryptSingle } = useFHEDecrypt({
    instance: fhevmInstance,
    signer: signer,
    requests: decryptRequests,
  });

  // Helper functions
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

      // Auto-refresh count after wallet connection
      if (Number(network.chainId) in SUPPORTED_NETWORKS) {
        setTimeout(() => refreshCountHandle(), 1500);
      }
    } catch (error: any) {
      setMessage(`Error connecting: ${error.message}`);
    }
  };

  // Disconnect wallet
  const disconnectWallet = () => {
    setReadonlyProvider(null);
    setAccount(null);
    setSigner(null);
    setChainId(null);
    setHandle(null);
    setIsDecrypted(false);
    clearResults();
    setMessage('Wallet disconnected');
  };

  // Refresh count handle
  const refreshCountHandle = async () => {
    if (!account || !readonlyProvider || isRefreshing) {
      return;
    }

    try {
      setIsRefreshing(true);
      setMessage('Fetching encrypted count handle...');

      const contractAddr = getContractAddress();
      const contract = new ethers.Contract(contractAddr!, CONTRACT_ABI, readonlyProvider);
      const countHandle = await contract.getCount();

      setHandle(countHandle.toString());
      setIsDecrypted(false);
      setPublicDecryptedValue(null);
      clearResults();
      setMessage(`Got encrypted handle: ${countHandle.toString().slice(0, 20)}...`);
    } catch (error: any) {
      setMessage(`Error fetching count: ${error.message}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Decrypt count handle using SDK (user decrypt with EIP-712)
  const decryptCountHandle = async () => {
    if (!handle || !fhevmInstance || !account || isDecrypting) {
      return;
    }

    try {
      setMessage('Decrypting count handle...');
      await decrypt();
      // Note: decryptResults will be updated automatically via useEffect
    } catch (error: any) {
      setMessage(`Error decrypting: ${error.message}`);
    }
  };

  // Public decrypt count handle (no signature needed)
  const publicDecryptCountHandle = async () => {
    if (!handle || !fhevmInstance || isDecrypting) {
      return;
    }

    try {
      setMessage('Public decrypting count handle (no signature)...');
      const decryptedValue = await publicDecryptSingle(handle);
      setPublicDecryptedValue(Number(decryptedValue));
      setIsDecrypted(true);
      setMessage(`Public decrypted value: ${decryptedValue}`);
    } catch (error: any) {
      setMessage(`Error public decrypting: ${error.message}`);
    }
  };

  // Update counter (increment or decrement) using SDK encryption
  const updateCounter = async (delta: number) => {
    if (!account || !signer || !fhevmInstance || isProcessing || !canEncrypt) {
      return;
    }

    try {
      setIsProcessing(true);
      const action = delta > 0 ? 'Incrementing' : 'Decrementing';
      setMessage(`${action} counter...`);

      const contractAddr = getContractAddress();

      // Encrypt the input using SDK
      const encrypted = await encrypt((input) => {
        input.add32(Math.abs(delta));
      });

      // Call contract
      const contract = new ethers.Contract(contractAddr!, CONTRACT_ABI, signer);
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

            setAccount(accounts[0]);
            setSigner(new ethers.JsonRpcSigner(provider, accounts[0]));
            setChainId(Number(network.chainId));

            if (Number(network.chainId) === 31337) {
              setReadonlyProvider(new ethers.JsonRpcProvider('http://localhost:8545'));
            } else {
              setReadonlyProvider(provider);
            }

            setMessage(`Auto-connected to ${SUPPORTED_NETWORKS[Number(network.chainId)] || `Chain ${network.chainId}`}: ${accounts[0].slice(0, 6)}...${accounts[0].slice(-4)}`);

            // Auto-refresh after FHEVM initializes
            if (Number(network.chainId) in SUPPORTED_NETWORKS) {
              setTimeout(() => refreshCountHandle(), 2000);
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
      window.ethereum.on('accountsChanged', (accounts: any) => {
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

  // Update message when FHEVM status changes
  useEffect(() => {
    if (fhevmStatus === 'ready' && account) {
      setMessage(`FHEVM initialized on ${getNetworkName()}!`);
    } else if (fhevmStatus === 'error' && fhevmError) {
      setMessage(`FHEVM initialization failed: ${fhevmError.message}`);
    }
  }, [fhevmStatus, fhevmError, account]);

  // Auto-update when decryption results change
  useEffect(() => {
    if (handle && decryptResults && decryptResults[handle]) {
      const decryptedValue = decryptResults[handle];
      setIsDecrypted(true);
      setMessage(`Decrypted value: ${decryptedValue}`);
    }
  }, [decryptResults, handle]);

  // Computed values
  const clear = publicDecryptedValue !== null
    ? publicDecryptedValue
    : (handle && decryptResults && decryptResults[handle]
        ? Number(decryptResults[handle])
        : null);

  const canDecrypt = !!handle && !isDecrypting && !isDecrypted && !!fhevmInstance;
  const canUpdateCounter = !!account && !isProcessing && canEncrypt;

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
          <h1>
            <svg width="24" height="24" viewBox="0 0 841.9 595.3" xmlns="http://www.w3.org/2000/svg" style={{marginRight: '8px', verticalAlign: 'middle'}}>
              <g fill="#61DAFB">
                <path d="M666.3 296.5c0-32.5-40.7-63.3-103.1-82.4 14.4-63.6 8-114.2-20.2-130.4-6.5-3.8-14.1-5.6-22.4-5.6v22.3c4.6 0 8.3.9 11.4 2.6 13.6 7.8 19.5 37.5 14.9 75.7-1.1 9.4-2.9 19.3-5.1 29.4-19.6-4.8-41-8.5-63.5-10.9-13.5-18.5-27.5-35.3-41.6-50 32.6-30.3 63.2-46.9 84-46.9V78c-27.5 0-63.5 19.6-99.9 53.6-36.4-33.8-72.4-53.2-99.9-53.2v22.3c20.7 0 51.4 16.5 84 46.6-14 14.7-28 31.4-41.3 49.9-22.6 2.4-44 6.1-63.6 11-2.3-10-4-19.7-5.2-29-4.7-38.2 1.1-67.9 14.6-75.8 3-1.8 6.9-2.6 11.5-2.6V78.5c-8.4 0-16 1.8-22.6 5.6-28.1 16.2-34.4 66.7-19.9 130.1-62.2 19.2-102.7 49.9-102.7 82.3 0 32.5 40.7 63.3 103.1 82.4-14.4 63.6-8 114.2 20.2 130.4 6.5 3.8 14.1 5.6 22.5 5.6 27.5 0 63.5-19.6 99.9-53.6 36.4 33.8 72.4 53.2 99.9 53.2 8.4 0 16-1.8 22.6-5.6 28.1-16.2 34.4-66.7 19.9-130.1 62-19.1 102.5-49.9 102.5-82.3zm-130.2-66.7c-3.7 12.9-8.3 26.2-13.5 39.5-4.1-8-8.4-16-13.1-24-4.6-8-9.5-15.8-14.4-23.4 14.2 2.1 27.9 4.7 41 7.9zm-45.8 106.5c-7.8 13.5-15.8 26.3-24.1 38.2-14.9 1.3-30 2-45.2 2-15.1 0-30.2-.7-45-1.9-8.3-11.9-16.4-24.6-24.2-38-7.6-13.1-14.5-26.4-20.8-39.8 6.2-13.4 13.2-26.8 20.7-39.9 7.8-13.5 15.8-26.3 24.1-38.2 14.9-1.3 30-2 45.2-2 15.1 0 30.2.7 45 1.9 8.3 11.9 16.4 24.6 24.2 38 7.6 13.1 14.5 26.4 20.8 39.8-6.3 13.4-13.2 26.8-20.7 39.9zm32.3-13c5.4 13.4 10 26.8 13.8 39.8-13.1 3.2-26.9 5.9-41.2 8 4.9-7.7 9.8-15.6 14.4-23.7 4.6-8 8.9-16.1 13-24.1zM421.2 430c-9.3-9.6-18.6-20.3-27.8-32 9 .4 18.2.7 27.5.7 9.4 0 18.7-.2 27.8-.7-9 11.7-18.3 22.4-27.5 32zm-74.4-58.9c-14.2-2.1-27.9-4.7-41-7.9 3.7-12.9 8.3-26.2 13.5-39.5 4.1 8 8.4 16 13.1 24 4.7 8 9.5 15.8 14.4 23.4zM420.7 163c9.3 9.6 18.6 20.3 27.8 32-9-.4-18.2-.7-27.5-.7-9.4 0-18.7.2-27.8.7 9-11.7 18.3-22.4 27.5-32zm-74 58.9c-4.9 7.7-9.8 15.6-14.4 23.7-4.6 8-8.9 16-13 24-5.4-13.4-10-26.8-13.8-39.8 13.1-3.1 26.9-5.8 41.2-7.9zm-90.5 125.2c-35.4-15.1-58.3-34.9-58.3-50.6 0-15.7 22.9-35.6 58.3-50.6 8.6-3.7 18-7 27.7-10.1 5.7 19.6 13.2 40 22.5 60.9-9.2 20.8-16.6 41.1-22.2 60.6-9.9-3.1-19.3-6.5-28-10.2zM310 490c-13.6-7.8-19.5-37.5-14.9-75.7 1.1-9.4 2.9-19.3 5.1-29.4 19.6 4.8 41 8.5 63.5 10.9 13.5 18.5 27.5 35.3 41.6 50-32.6 30.3-63.2 46.9-84 46.9-4.5-.1-8.3-1-11.3-2.7zm237.2-76.2c4.7 38.2-1.1 67.9-14.6 75.8-3 1.8-6.9 2.6-11.5 2.6-20.7 0-51.4-16.5-84-46.6 14-14.7 28-31.4 41.3-49.9 22.6-2.4 44-6.1 63.6-11 2.3 10.1 4.1 19.8 5.2 29.1zm38.5-66.7c-8.6 3.7-18 7-27.7 10.1-5.7-19.6-13.2-40-22.5-60.9 9.2-20.8 16.6-41.1 22.2-60.6 9.9 3.1 19.3 6.5 28.1 10.2 35.4 15.1 58.3 34.9 58.3 50.6-.1 15.7-23 35.6-58.4 50.6zM320.8 78.4z" />
                <circle cx="420.9" cy="296.5" r="45.7" />
              </g>
            </svg>
            FHE Counter SDK Test (React)
          </h1>
          <p>Interact with the Fully Homomorphic Encryption Counter contract</p>
          <p style={{ fontSize: '0.875rem', color: '#6B7280' }}>Using uni-fhevm-sdk/react adapter</p>
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
            disabled={!handle || !fhevmInstance || isDecrypting}
          >
            {isDecrypting
              ? '⏳ Public Decrypting...'
              : handle && fhevmInstance
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
              <PropertyRow name="Error" value={fhevmError?.message ?? 'No errors'} />
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
