import { ethers } from 'ethers';

// Contract ABI
const CONTRACT_ABI = [
    {
        "inputs": [
            {
                "internalType": "externalEuint32",
                "name": "inputEuint32",
                "type": "bytes32"
            },
            {
                "internalType": "bytes",
                "name": "inputProof",
                "type": "bytes"
            }
        ],
        "name": "decrement",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getCount",
        "outputs": [
            {
                "internalType": "euint32",
                "name": "",
                "type": "bytes32"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "externalEuint32",
                "name": "inputEuint32",
                "type": "bytes32"
            },
            {
                "internalType": "bytes",
                "name": "inputProof",
                "type": "bytes"
            }
        ],
        "name": "increment",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "protocolId",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "pure",
        "type": "function"
    }
];

// Contract addresses by network
const CONTRACT_ADDRESSES = {
    31337: '0x5FbDB2315678afecb367f032d93F642f64180aa3',      // Hardhat Local
    11155111: '0xA91422DBbfbc125C0A852281a391D89389C4D69C',  // Sepolia Testnet
};

// FHEVM-supported networks
const SUPPORTED_NETWORKS = {
    31337: 'Hardhat Local',
    11155111: 'Sepolia Testnet',
};

// State
const state = {
    isInitializing: true,
    account: null,
    ethersProvider: null,
    readonlyProvider: null,
    signer: null,
    chainId: null,
    windowProvider: null,
    fhevmInstance: null,
    fhevmClient: null, // Store the full FHEVM client from uni-fhevm-sdk
    fhevmStatus: 'idle', // 'idle', 'initializing', 'ready', 'error'
    fhevmError: null,
    handle: null,
    clear: null,
    isDecrypted: false,
    isRefreshing: false,
    isDecrypting: false,
    isProcessing: false,
    message: ''
};

// Get contract address for current chain
function getContractAddress() {
    if (!state.chainId) return null;
    return CONTRACT_ADDRESSES[state.chainId] || null;
}

// Get network name
function getNetworkName() {
    if (!state.chainId) return 'Unknown';
    return SUPPORTED_NETWORKS[state.chainId] || `Chain ${state.chainId}`;
}

// Check if network is supported
function isNetworkSupported() {
    if (!state.chainId) return false;
    return state.chainId in SUPPORTED_NETWORKS;
}

// Connect wallet
async function connectWallet() {
    try {
        if (typeof window.ethereum === 'undefined') {
            state.message = 'MetaMask is not installed';
            render();
            return;
        }

        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send('eth_requestAccounts', []);
        const network = await provider.getNetwork();

        state.ethersProvider = provider;
        state.windowProvider = window.ethereum;
        state.account = accounts[0];
        state.signer = new ethers.JsonRpcSigner(provider, accounts[0]);
        state.chainId = Number(network.chainId);

        // For Hardhat (31337), use localhost RPC. For Sepolia (11155111), use the connected provider
        if (state.chainId === 31337) {
            state.readonlyProvider = new ethers.JsonRpcProvider('http://localhost:8545');
        } else {
            state.readonlyProvider = provider;
        }

        state.isInitializing = false;
        state.message = `Connected to ${getNetworkName()}: ${state.account.slice(0, 6)}...${state.account.slice(-4)}`;

        // Listen for account changes
        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', handleChainChanged);

        render();

        // Initialize FHEVM after wallet connection
        if (isNetworkSupported()) {
            await initializeFHEVM();
            // Auto-refresh count after FHEVM initialization
            setTimeout(() => {
                if (state.fhevmInstance && state.fhevmStatus === 'ready') {
                    refreshCountHandle();
                }
            }, 1000);
        }
    } catch (error) {
        state.message = `Error connecting: ${error.message}`;
        render();
    }
}

// Disconnect wallet
async function disconnectWallet() {
    state.ethersProvider = null;
    state.readonlyProvider = null;
    state.windowProvider = null;
    state.account = null;
    state.signer = null;
    state.chainId = null;
    state.handle = null;
    state.clear = null;
    state.isDecrypted = false;
    state.fhevmInstance = null;
    state.fhevmStatus = 'idle';
    state.message = 'Wallet disconnected';

    // Remove listeners
    if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
    }

    render();
}

function handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
        disconnectWallet();
    } else {
        state.account = accounts[0];
        state.message = `Account changed: ${state.account.slice(0, 6)}...${state.account.slice(-4)}`;
        render();
        refreshCountHandle();
    }
}

function handleChainChanged() {
    window.location.reload();
}

// Initialize FHEVM
async function initializeFHEVM() {
    try {
        state.fhevmStatus = 'initializing';
        render();

        const { createFHEVMClient } = await import('uni-fhevm-sdk/vanilla');

        if (!createFHEVMClient) {
            throw new Error('SDK functions not found. Check if uni-fhevm-sdk is properly installed.');
        }

        // Create FHEVM client with provider and chainId
        const fhevmClient = await createFHEVMClient({
            provider: state.windowProvider,
            chainId: state.chainId,
        });

        state.fhevmInstance = fhevmClient.getInstance();
        state.fhevmClient = fhevmClient; // Store the client for later use
        state.fhevmStatus = 'ready';
        state.fhevmError = null;
        state.message = `FHEVM initialized on ${getNetworkName()}!`;
        render();
    } catch (error) {
        state.fhevmStatus = 'error';
        state.fhevmError = error.message;
        state.message = `FHEVM initialization failed: ${error.message}`;
        render();
    }
}

// Refresh count handle
async function refreshCountHandle() {
    if (!state.account || !state.readonlyProvider || state.isRefreshing) {
        return;
    }

    try {
        state.isRefreshing = true;
        state.message = 'Fetching encrypted count handle...';
        render();

        const contractAddress = getContractAddress();
        const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, state.readonlyProvider);
        const countHandle = await contract.getCount();

        state.handle = countHandle.toString();
        state.isDecrypted = false;
        state.clear = null;
        state.message = `Got encrypted handle: ${state.handle.slice(0, 20)}...`;
    } catch (error) {
        state.message = `Error fetching count: ${error.message}`;
    } finally {
        state.isRefreshing = false;
        render();
    }
}

// Decrypt count handle
async function decryptCountHandle() {
    if (!state.handle || !state.fhevmInstance || !state.account || state.isDecrypting) {
        return;
    }

    try {
        state.isDecrypting = true;
        state.message = 'Decrypting count handle...';
        render();

        const contractAddress = getContractAddress();

        // Generate keypair for decryption
        const keypair = state.fhevmInstance.generateKeypair();
        const startTimestamp = Math.floor(Date.now() / 1000).toString();
        const durationDays = '10';

        // Create EIP712 message
        const eip712 = state.fhevmInstance.createEIP712(
            keypair.publicKey,
            [contractAddress],
            startTimestamp,
            durationDays
        );

        // Sign the message
        const signature = await state.signer.signTypedData(
            eip712.domain,
            { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
            eip712.message
        );

        // Call relayer for decryption
        const result = await state.fhevmInstance.userDecrypt(
            [{ handle: state.handle, contractAddress: contractAddress }],
            keypair.privateKey,
            keypair.publicKey,
            signature.replace('0x', ''),
            [contractAddress],
            state.account,
            startTimestamp,
            durationDays
        );

        const decryptedValue = result[state.handle];
        state.clear = Number(decryptedValue);
        state.isDecrypted = true;
        state.message = `Decrypted value: ${state.clear}`;
    } catch (error) {
        state.message = `Error decrypting: ${error.message}`;
    } finally {
        state.isDecrypting = false;
        render();
    }
}

// Public decrypt count handle (no signature needed)
async function publicDecryptCountHandle() {
    if (!state.handle || !state.fhevmClient || state.isDecrypting) {
        return;
    }

    try {
        state.isDecrypting = true;
        state.message = 'Public decrypting count handle (no signature)...';
        render();

        // Use SDK's publicDecryptSingle method - no signature required
        const decryptedValue = await state.fhevmClient.publicDecryptSingle(state.handle);

        state.clear = Number(decryptedValue);
        state.isDecrypted = true;
        state.message = `Public decrypted value: ${state.clear}`;
    } catch (error) {
        state.message = `Error public decrypting: ${error.message}`;
    } finally {
        state.isDecrypting = false;
        render();
    }
}

// Update counter (increment or decrement)
async function updateCounter(delta) {
    if (!state.account || !state.signer || !state.fhevmInstance || state.isProcessing) {
        return;
    }

    try {
        state.isProcessing = true;
        const action = delta > 0 ? 'Incrementing' : 'Decrementing';
        state.message = `${action} counter...`;
        render();

        const contractAddress = getContractAddress();

        // Encrypt the input
        const input = state.fhevmInstance.createEncryptedInput(contractAddress, state.account);
        input.add32(Math.abs(delta));
        const encryptedInput = await input.encrypt();

        // Call contract
        const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, state.signer);
        const tx = delta > 0
            ? await contract.increment(encryptedInput.handles[0], encryptedInput.inputProof)
            : await contract.decrement(encryptedInput.handles[0], encryptedInput.inputProof);

        state.message = `Transaction sent: ${tx.hash.slice(0, 10)}... Waiting for confirmation...`;
        render();

        await tx.wait();

        state.message = `Counter ${delta > 0 ? 'incremented' : 'decremented'} successfully!`;
        render();

        // Refresh handle after update
        setTimeout(() => refreshCountHandle(), 1000);
    } catch (error) {
        state.message = `Error updating counter: ${error.message}`;
        render();
    } finally {
        state.isProcessing = false;
    }
}

// Render UI
function render() {
    const app = document.getElementById('app');

    // Check if still initializing
    if (state.isInitializing) {
        app.innerHTML = renderInitializingScreen();
        return;
    }

    // Check if wallet is not connected
    if (!state.account) {
        app.innerHTML = renderNotConnectedScreen();
        attachNotConnectedEvents();
        return;
    }

    // Check if FHEVM is initializing
    if (state.fhevmStatus === 'initializing') {
        app.innerHTML = renderFHEVMInitializingScreen();
        return;
    }

    // Check if network is not supported
    if (!isNetworkSupported()) {
        app.innerHTML = renderUnsupportedNetworkScreen();
        attachUnsupportedNetworkEvents();
        return;
    }

    // Render main app
    app.innerHTML = renderMainApp();
    attachMainAppEvents();
}

function renderInitializingScreen() {
    return `
        <div class="center-screen">
            <div class="message-card">
                <div class="message-card-icon icon-loading">
                    <div class="spinner"></div>
                </div>
                <h2>Loading...</h2>
                <p>Initializing application</p>
            </div>
        </div>
    `;
}

function renderNotConnectedScreen() {
    return `
        ${renderWalletHeader()}
        <div class="center-screen">
            <div class="message-card">
                <div class="message-card-icon icon-warning">⚠️</div>
                <h2>Wallet not connected</h2>
                <p>Connect your wallet to use the FHE Counter demo.</p>
                <button id="connectBtn2" class="btn btn-primary">Connect Wallet</button>
            </div>
        </div>
    `;
}

function renderFHEVMInitializingScreen() {
    return `
        ${renderWalletHeader()}
        <div class="center-screen">
            <div class="message-card">
                <div class="message-card-icon icon-loading">
                    <div class="spinner"></div>
                </div>
                <h2>Initializing FHEVM...</h2>
                <p>Network: <strong>${getNetworkName()}</strong></p>
                <p>Loading encryption libraries and connecting to the network.</p>
                <p style="font-size: 0.875rem; color: #6B7280;">This may take a few seconds on first load.</p>
            </div>
        </div>
    `;
}

function renderUnsupportedNetworkScreen() {
    const supportedNetworksList = Object.entries(SUPPORTED_NETWORKS)
        .map(([id, name]) => `${name} (${id})`)
        .join(', ');

    return `
        ${renderWalletHeader()}
        <div class="center-screen">
            <div class="message-card">
                <div class="message-card-icon icon-warning">⚠️</div>
                <h2>FHEVM Not Supported</h2>
                <p>Current network: <strong>${getNetworkName()} (${state.chainId})</strong></p>
                <p>FHEVM is not available on this network.</p>
                <div style="background: #EFF6FF; border: 1px solid #BFDBFE; padding: 1rem; margin-bottom: 1.5rem; text-align: left;">
                    <p style="font-size: 0.875rem; color: #1F2937; font-weight: 600; margin-bottom: 0.5rem;">Supported Networks:</p>
                    <p style="font-size: 0.875rem; color: #4B5563;">${supportedNetworksList}</p>
                </div>
                <button id="disconnectBtn2" class="btn btn-primary">Disconnect & Switch Network</button>
            </div>
        </div>
    `;
}

function renderWalletHeader() {
    const isFhevmSupported = state.chainId && (state.chainId in SUPPORTED_NETWORKS);
    const networkName = state.chainId ? (SUPPORTED_NETWORKS[state.chainId] || `Chain ${state.chainId}`) : 'Unknown';

    if (!state.account) {
        return `
            <div class="wallet-header">
                <button id="connectBtn" class="btn btn-primary">Connect Wallet</button>
            </div>
        `;
    }

    return `
        <div class="wallet-header">
            <div class="wallet-info">
                <span class="wallet-address">
                    ${state.account.slice(0, 6)}...${state.account.slice(-4)}
                </span>
                ${state.chainId ? `
                    <span class="network-badge ${isFhevmSupported ? 'supported' : 'unsupported'}">
                        ${networkName}
                    </span>
                ` : ''}
                ${state.account && state.fhevmStatus ? `
                    <span class="fhevm-status-badge">
                        ${state.fhevmStatus}
                    </span>
                ` : ''}
                <button id="disconnectBtn" class="btn btn-secondary">Disconnect</button>
            </div>
        </div>
    `;
}

function renderMainApp() {
    const contractAddress = getContractAddress();
    const canDecrypt = !!state.handle && !state.isDecrypting && !state.isDecrypted && !!state.fhevmInstance;
    const canUpdateCounter = !!state.account && !state.isProcessing && !!state.fhevmInstance && !!state.signer;
    const canGetCount = !!state.account && !state.isRefreshing && !!state.readonlyProvider;

    return `
        ${renderWalletHeader()}
        <div class="app-container">
            <!-- Header -->
            <div class="app-header">
                <h1>FHE Counter Demo (NodeJS)</h1>
                <p>Interact with the Fully Homomorphic Encryption Counter contract</p>
            </div>

            <!-- Count Handle Display -->
            <div class="section">
                <h3 class="section-title">🔢 Count Handle</h3>
                <div class="property-list">
                    ${renderProperty('Encrypted Handle', state.handle || 'No handle available')}
                    ${renderProperty('Decrypted Value', state.isDecrypted ? state.clear : 'Not decrypted yet')}
                </div>
            </div>

            <!-- Action Buttons -->
            <div class="action-grid">
                <button
                    id="decryptBtn"
                    class="btn ${state.isDecrypted ? 'btn-success' : 'btn-primary'}"
                    ${!canDecrypt ? 'disabled' : ''}
                >
                    ${canDecrypt
                        ? '🔓 Decrypt Counter (EIP-712)'
                        : state.isDecrypted
                            ? `✅ Decrypted: ${state.clear}`
                            : state.isDecrypting
                                ? '⏳ Decrypting...'
                                : '❌ Nothing to decrypt'
                    }
                </button>

                <button
                    id="publicDecryptBtn"
                    class="btn ${state.isDecrypted ? 'btn-success' : 'btn-primary'}"
                    ${!state.handle || !state.fhevmClient || state.isDecrypting ? 'disabled' : ''}
                >
                    ${state.isDecrypting
                        ? '⏳ Public Decrypting...'
                        : state.handle && state.fhevmClient
                            ? '🔓 Public Decrypt (No Signature)'
                            : '❌ Nothing to decrypt'
                    }
                </button>

                <button
                    id="incrementBtn"
                    class="btn btn-secondary"
                    ${!canUpdateCounter ? 'disabled' : ''}
                >
                    ${canUpdateCounter
                        ? '➕ Increment +1'
                        : state.isProcessing
                            ? '⏳ Processing...'
                            : '❌ Cannot increment'
                    }
                </button>

                <button
                    id="decrementBtn"
                    class="btn btn-secondary"
                    ${!canUpdateCounter ? 'disabled' : ''}
                >
                    ${canUpdateCounter
                        ? '➖ Decrement -1'
                        : state.isProcessing
                            ? '⏳ Processing...'
                            : '❌ Cannot decrement'
                    }
                </button>
            </div>

            <!-- Messages -->
            ${state.message ? `
                <div class="section">
                    <h3 class="section-title">💬 Messages</h3>
                    <div class="messages-box">
                        <p>${state.message}</p>
                    </div>
                </div>
            ` : ''}

            <!-- Status Cards -->
            <div class="status-grid">
                <div class="section">
                    <h3 class="section-title">🔧 FHEVM Instance</h3>
                    <div class="property-list">
                        ${renderProperty('Instance Status', state.fhevmInstance ? '✅ Connected' : '❌ Disconnected')}
                        ${renderProperty('Status', state.fhevmStatus)}
                        ${renderProperty('Error', state.fhevmError ?? 'No errors')}
                    </div>
                </div>

                <div class="section">
                    <h3 class="section-title">📊 Counter Status</h3>
                    <div class="property-list">
                        ${renderBooleanProperty('Refreshing', state.isRefreshing)}
                        ${renderBooleanProperty('Decrypting', state.isDecrypting)}
                        ${renderBooleanProperty('Processing', state.isProcessing)}
                        ${renderBooleanProperty('Can Get Count', canGetCount)}
                        ${renderBooleanProperty('Can Decrypt', canDecrypt)}
                        ${renderBooleanProperty('Can Modify', canUpdateCounter)}
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderProperty(name, value) {
    return `
        <div class="property-row">
            <span class="property-name">${name}</span>
            <span class="property-value">${value}</span>
        </div>
    `;
}

function renderBooleanProperty(name, value) {
    const className = value ? 'boolean-true' : 'boolean-false';
    const displayValue = value ? '✓ true' : '✗ false';
    return `
        <div class="property-row">
            <span class="property-name">${name}</span>
            <span class="property-value ${className}">${displayValue}</span>
        </div>
    `;
}

// Attach event listeners
function attachNotConnectedEvents() {
    const connectBtn = document.getElementById('connectBtn');
    const connectBtn2 = document.getElementById('connectBtn2');

    if (connectBtn) {
        connectBtn.addEventListener('click', connectWallet);
    }
    if (connectBtn2) {
        connectBtn2.addEventListener('click', connectWallet);
    }
}

function attachUnsupportedNetworkEvents() {
    const disconnectBtn = document.getElementById('disconnectBtn');
    const disconnectBtn2 = document.getElementById('disconnectBtn2');

    if (disconnectBtn) {
        disconnectBtn.addEventListener('click', disconnectWallet);
    }
    if (disconnectBtn2) {
        disconnectBtn2.addEventListener('click', disconnectWallet);
    }
}

function attachMainAppEvents() {
    const decryptBtn = document.getElementById('decryptBtn');
    const publicDecryptBtn = document.getElementById('publicDecryptBtn');
    const incrementBtn = document.getElementById('incrementBtn');
    const decrementBtn = document.getElementById('decrementBtn');
    const disconnectBtn = document.getElementById('disconnectBtn');

    if (decryptBtn) {
        decryptBtn.addEventListener('click', decryptCountHandle);
    }

    if (publicDecryptBtn) {
        publicDecryptBtn.addEventListener('click', publicDecryptCountHandle);
    }

    if (incrementBtn) {
        incrementBtn.addEventListener('click', () => updateCounter(1));
    }

    if (decrementBtn) {
        decrementBtn.addEventListener('click', () => updateCounter(-1));
    }

    if (disconnectBtn) {
        disconnectBtn.addEventListener('click', disconnectWallet);
    }
}

// Initialize app
async function initializeApp() {
    // Check if wallet was previously connected (auto-connect)
    if (typeof window.ethereum !== 'undefined') {
        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const accounts = await provider.send('eth_accounts', []); // Use eth_accounts instead of eth_requestAccounts

            if (accounts.length > 0) {
                // Silently reconnect
                const network = await provider.getNetwork();

                state.ethersProvider = provider;
                state.windowProvider = window.ethereum;
                state.account = accounts[0];
                state.signer = new ethers.JsonRpcSigner(provider, accounts[0]);
                state.chainId = Number(network.chainId);

                // For Hardhat (31337), use localhost RPC. For Sepolia (11155111), use the connected provider
                if (state.chainId === 31337) {
                    state.readonlyProvider = new ethers.JsonRpcProvider('http://localhost:8545');
                } else {
                    state.readonlyProvider = provider;
                }

                state.message = `Auto-connected to ${getNetworkName()}: ${state.account.slice(0, 6)}...${state.account.slice(-4)}`;

                // Listen for account changes
                window.ethereum.on('accountsChanged', handleAccountsChanged);
                window.ethereum.on('chainChanged', handleChainChanged);

                // Initialize FHEVM if network is supported
                if (isNetworkSupported()) {
                    await initializeFHEVM();
                    // Auto-refresh count after auto-connection
                    setTimeout(() => {
                        if (state.fhevmInstance && state.fhevmStatus === 'ready') {
                            refreshCountHandle();
                        }
                    }, 1500);
                }
            }
        } catch (error) {
            // Silent fail - user can manually connect
        }
    }

    // Mark initialization as complete
    state.isInitializing = false;
    render();
}

// Start app
initializeApp();
