import { isAddress, Eip1193Provider, JsonRpcProvider } from "ethers";
import type {
  FhevmInitSDKOptions,
  FhevmInitSDKType,
  FhevmLoadSDKType,
  FhevmWindowType,
} from "./fhevmTypes";
import { publicKeyStorageGet, publicKeyStorageSet } from "./PublicKeyStorage";
import { FhevmInstance, FhevmInstanceConfig } from "../fhevmTypes";

export class FhevmReactError extends Error {
  code: string;
  constructor(code: string, message?: string, options?: ErrorOptions) {
    super(message, options);
    this.code = code;
    this.name = "FhevmReactError";
  }
}

function throwFhevmError(
  code: string,
  message?: string,
  cause?: unknown
): never {
  throw new FhevmReactError(code, message, cause ? { cause } : undefined);
}

// Store SDK module globally to avoid re-importing
let relayerSDKModule: any = null;
let sdkInitialized = false;

const fhevmLoadSDK = async () => {
  if (relayerSDKModule) {
    return relayerSDKModule;
  }

  // Use npm package instead of CDN
  relayerSDKModule = await import('@zama-fhe/relayer-sdk/bundle');
  return relayerSDKModule;
};

const fhevmInitSDK = async (options?: FhevmInitSDKOptions) => {
  if (sdkInitialized) {
    return true;
  }

  if (!relayerSDKModule) {
    throw new Error("SDK not loaded. Call fhevmLoadSDK first.");
  }

  await relayerSDKModule.initSDK(options);
  sdkInitialized = true;
  return true;
};

function checkIsAddress(a: unknown): a is `0x${string}` {
  if (typeof a !== "string") {
    return false;
  }
  if (!isAddress(a)) {
    return false;
  }
  return true;
}

export class FhevmAbortError extends Error {
  constructor(message = "FHEVM operation was cancelled") {
    super(message);
    this.name = "FhevmAbortError";
  }
}

type FhevmRelayerStatusType =
  | "sdk-loading"
  | "sdk-loaded"
  | "sdk-initializing"
  | "sdk-initialized"
  | "creating";

async function getChainId(
  providerOrUrl: Eip1193Provider | string
): Promise<number> {
  if (typeof providerOrUrl === "string") {
    const provider = new JsonRpcProvider(providerOrUrl);
    return Number((await provider.getNetwork()).chainId);
  }
  const chainId = await providerOrUrl.request({ method: "eth_chainId" });
  return Number.parseInt(chainId as string, 16);
}

async function getWeb3Client(rpcUrl: string) {
  const rpc = new JsonRpcProvider(rpcUrl);
  try {
    const version = await rpc.send("web3_clientVersion", []);
    return version;
  } catch (e) {
    throwFhevmError(
      "WEB3_CLIENTVERSION_ERROR",
      `The URL ${rpcUrl} is not a Web3 node or is not reachable. Please check the endpoint.`,
      e
    );
  } finally {
    rpc.destroy();
  }
}

async function tryFetchFHEVMHardhatNodeRelayerMetadata(rpcUrl: string): Promise<
  | {
      ACLAddress: `0x${string}`;
      InputVerifierAddress: `0x${string}`;
      KMSVerifierAddress: `0x${string}`;
    }
  | undefined
> {
  const version = await getWeb3Client(rpcUrl);
  if (
    typeof version !== "string" ||
    !version.toLowerCase().includes("hardhat")
  ) {
    // Not a Hardhat Node
    return undefined;
  }
  try {
    const metadata = await getFHEVMRelayerMetadata(rpcUrl);
    if (!metadata || typeof metadata !== "object") {
      return undefined;
    }
    if (
      !(
        "ACLAddress" in metadata &&
        typeof metadata.ACLAddress === "string" &&
        metadata.ACLAddress.startsWith("0x")
      )
    ) {
      return undefined;
    }
    if (
      !(
        "InputVerifierAddress" in metadata &&
        typeof metadata.InputVerifierAddress === "string" &&
        metadata.InputVerifierAddress.startsWith("0x")
      )
    ) {
      return undefined;
    }
    if (
      !(
        "KMSVerifierAddress" in metadata &&
        typeof metadata.KMSVerifierAddress === "string" &&
        metadata.KMSVerifierAddress.startsWith("0x")
      )
    ) {
      return undefined;
    }
    return metadata;
  } catch {
    // Not a FHEVM Hardhat Node
    return undefined;
  }
}

async function getFHEVMRelayerMetadata(rpcUrl: string) {
  const rpc = new JsonRpcProvider(rpcUrl);
  try {
    const version = await rpc.send("fhevm_relayer_metadata", []);
    return version;
  } catch (e) {
    throwFhevmError(
      "FHEVM_RELAYER_METADATA_ERROR",
      `The URL ${rpcUrl} is not a FHEVM Hardhat node or is not reachable. Please check the endpoint.`,
      e
    );
  } finally {
    rpc.destroy();
  }
}

type MockResolveResult = { isMock: true; chainId: number; rpcUrl: string };
type GenericResolveResult = { isMock: false; chainId: number; rpcUrl?: string };
type ResolveResult = MockResolveResult | GenericResolveResult;

async function resolve(
  providerOrUrl: Eip1193Provider | string,
  mockChains?: Record<number, string>,
  explicitChainId?: number
): Promise<ResolveResult> {
  // Resolve chainId - use explicit chainId if provided to avoid MetaMask cache issues
  const chainId = explicitChainId ?? (await getChainId(providerOrUrl));

  // Resolve rpc url
  let rpcUrl = typeof providerOrUrl === "string" ? providerOrUrl : undefined;

  // Default mock chain: Hardhat (31337)
  const _mockChains: Record<number, string> = {
    31337: "http://localhost:8545", // Hardhat default
    ...(mockChains ?? {}),
  };

  // Help Typescript solver here:
  if (Object.hasOwn(_mockChains, chainId)) {
    if (!rpcUrl) {
      rpcUrl = _mockChains[chainId];
    }

    return { isMock: true, chainId, rpcUrl };
  }

  return { isMock: false, chainId, rpcUrl };
}

export const createFhevmInstance = async (parameters: {
  provider: Eip1193Provider | string;
  mockChains?: Record<number, string>;
  signal: AbortSignal;
  onStatusChange?: (status: FhevmRelayerStatusType) => void;
  chainId?: number;
}): Promise<FhevmInstance> => {
  const throwIfAborted = () => {
    if (signal.aborted) throw new FhevmAbortError();
  };

  const notify = (status: FhevmRelayerStatusType) => {
    if (onStatusChange) onStatusChange(status);
  };

  const {
    signal,
    onStatusChange,
    provider: providerOrUrl,
    mockChains,
    chainId: explicitChainId,
  } = parameters;

  // Resolve chainId
  const { isMock, rpcUrl, chainId } = await resolve(providerOrUrl, mockChains, explicitChainId);

  if (isMock) {
    // Throws an error if cannot connect or url does not refer to a Web3 client
    const fhevmRelayerMetadata =
      await tryFetchFHEVMHardhatNodeRelayerMetadata(rpcUrl);

    if (fhevmRelayerMetadata) {
      // fhevmRelayerMetadata is defined, which means rpcUrl refers to a FHEVM Hardhat Node
      notify("creating");

      //////////////////////////////////////////////////////////////////////////
      //
      // WARNING!!
      // ALWAY USE DYNAMIC IMPORT TO AVOID INCLUDING THE ENTIRE FHEVM MOCK LIB
      // IN THE FINAL PRODUCTION BUNDLE!!
      //
      //////////////////////////////////////////////////////////////////////////
      // @ts-ignore - Dynamic import for mock mode only, not included in production build
      const fhevmMock = await import("./mock/fhevmMock");
      const mockInstance = await fhevmMock.fhevmMockCreateInstance({
        rpcUrl,
        chainId,
        metadata: fhevmRelayerMetadata,
      });

      throwIfAborted();

      return mockInstance;
    }
  }

  throwIfAborted();

  // Load SDK from npm package
  notify("sdk-loading");
  const sdk = await fhevmLoadSDK();
  throwIfAborted();
  notify("sdk-loaded");

  // Initialize SDK
  notify("sdk-initializing");
  await fhevmInitSDK();
  throwIfAborted();
  notify("sdk-initialized");

  const aclAddress = sdk.SepoliaConfig.aclContractAddress;
  if (!checkIsAddress(aclAddress)) {
    throw new Error(`Invalid address: ${aclAddress}`);
  }

  const pub = await publicKeyStorageGet(aclAddress);
  throwIfAborted();

  const config: FhevmInstanceConfig = {
    ...sdk.SepoliaConfig,
    network: providerOrUrl,
    publicKey: pub.publicKey,
    publicParams: pub.publicParams,
  };

  // notify that state === "creating"
  notify("creating");

  const instance = await sdk.createInstance(config);

  // Save the key even if aborted
  await publicKeyStorageSet(
    aclAddress,
    instance.getPublicKey(),
    instance.getPublicParams(2048)
  );

  throwIfAborted();

  return instance;
};
