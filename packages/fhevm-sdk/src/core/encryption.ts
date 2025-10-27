/**
 * @fileoverview Encryption utilities and helpers
 * @module @fhevm-sdk/core/encryption
 */

import type { RelayerEncryptedInput } from "@zama-fhe/relayer-sdk/web";

/**
 * FHE data types supported by FHEVM
 */
export type FHEDataType =
  | "bool"
  | "uint8"
  | "uint16"
  | "uint32"
  | "uint64"
  | "uint128"
  | "uint256"
  | "address";

/**
 * External encrypted type mapping (used in Solidity)
 */
export type ExternalEncryptedType =
  | "externalEbool"
  | "externalEuint8"
  | "externalEuint16"
  | "externalEuint32"
  | "externalEuint64"
  | "externalEuint128"
  | "externalEuint256"
  | "externalEaddress";

/**
 * Input value types for encryption
 */
export type EncryptableValue =
  | boolean
  | number
  | bigint
  | string; // for addresses

/**
 * Map FHE data type to RelayerEncryptedInput method name
 */
export const FHE_TYPE_TO_METHOD: Record<
  FHEDataType,
  keyof Pick<RelayerEncryptedInput, "addBool" | "add8" | "add16" | "add32" | "add64" | "add128" | "add256" | "addAddress">
> = {
  bool: "addBool",
  uint8: "add8",
  uint16: "add16",
  uint32: "add32",
  uint64: "add64",
  uint128: "add128",
  uint256: "add256",
  address: "addAddress",
};

/**
 * Map external encrypted type to RelayerEncryptedInput method name
 */
export function getEncryptionMethod(
  externalType: ExternalEncryptedType
): keyof Pick<RelayerEncryptedInput, "addBool" | "add8" | "add16" | "add32" | "add64" | "add128" | "add256" | "addAddress"> {
  switch (externalType) {
    case "externalEbool":
      return "addBool";
    case "externalEuint8":
      return "add8";
    case "externalEuint16":
      return "add16";
    case "externalEuint32":
      return "add32";
    case "externalEuint64":
      return "add64";
    case "externalEuint128":
      return "add128";
    case "externalEuint256":
      return "add256";
    case "externalEaddress":
      return "addAddress";
    default:
      throw new Error(`Unknown external type: ${externalType}`);
  }
}

/**
 * Convert Uint8Array or string to 0x-prefixed hex string
 */
export function toHex(value: Uint8Array | string): `0x${string}` {
  if (typeof value === "string") {
    return (value.startsWith("0x") ? value : `0x${value}`) as `0x${string}`;
  }
  // value is Uint8Array
  return ("0x" + Buffer.from(value).toString("hex")) as `0x${string}`;
}

/**
 * Encryption result from the SDK
 */
export interface EncryptionResult {
  handles: Uint8Array[];
  inputProof: Uint8Array;
}

/**
 * Build contract function parameters from encryption result and ABI
 *
 * This utility helps convert encrypted handles and proofs into the correct
 * format expected by smart contract function parameters based on the ABI.
 *
 * @param enc - Encryption result
 * @param abi - Contract ABI
 * @param functionName - Name of the function to call
 * @returns Array of parameters ready for contract call
 *
 * @example
 * ```typescript
 * const encrypted = await client.encrypt(...);
 * const params = buildParamsFromAbi(encrypted, contractAbi, 'setValue');
 * await contract.setValue(...params);
 * ```
 */
export function buildParamsFromAbi(
  enc: EncryptionResult,
  abi: any[],
  functionName: string
): any[] {
  const fn = abi.find(
    (item: any) => item.type === "function" && item.name === functionName
  );

  if (!fn) {
    throw new Error(`Function ABI not found for ${functionName}`);
  }

  return fn.inputs.map((input: any, index: number) => {
    const raw = index === 0 ? enc.handles[0] : enc.inputProof;

    switch (input.type) {
      case "bytes32":
      case "bytes":
        return toHex(raw);
      case "uint256":
        return BigInt(raw as unknown as string);
      case "address":
      case "string":
        return raw as unknown as string;
      case "bool":
        return Boolean(raw);
      default:
        console.warn(`Unknown ABI param type ${input.type}; passing as hex`);
        return toHex(raw);
    }
  });
}

/**
 * Type-safe encryption builder
 *
 * Provides a fluent interface for building encrypted inputs with type safety.
 *
 * @example
 * ```typescript
 * const builder = new EncryptionBuilder(instance, contractAddress, userAddress);
 * builder
 *   .addUint32(42)
 *   .addBool(true)
 *   .addAddress('0x...');
 *
 * const result = await builder.encrypt();
 * ```
 */
export class EncryptionBuilder {
  private input: RelayerEncryptedInput;

  constructor(
    private relayerInput: RelayerEncryptedInput
  ) {
    this.input = relayerInput;
  }

  /**
   * Add a boolean value to encrypt
   */
  addBool(value: boolean): this {
    this.input.addBool(value);
    return this;
  }

  /**
   * Add a uint8 value to encrypt
   */
  addUint8(value: number): this {
    this.input.add8(value);
    return this;
  }

  /**
   * Add a uint16 value to encrypt
   */
  addUint16(value: number): this {
    this.input.add16(value);
    return this;
  }

  /**
   * Add a uint32 value to encrypt
   */
  addUint32(value: number): this {
    this.input.add32(value);
    return this;
  }

  /**
   * Add a uint64 value to encrypt
   */
  addUint64(value: number | bigint): this {
    this.input.add64(value);
    return this;
  }

  /**
   * Add a uint128 value to encrypt
   */
  addUint128(value: number | bigint): this {
    this.input.add128(value);
    return this;
  }

  /**
   * Add a uint256 value to encrypt
   */
  addUint256(value: number | bigint): this {
    this.input.add256(value);
    return this;
  }

  /**
   * Add an address to encrypt
   */
  addAddress(value: string): this {
    this.input.addAddress(value);
    return this;
  }

  /**
   * Add a value with automatic type detection
   */
  add(value: EncryptableValue, type: FHEDataType): this {
    const method = FHE_TYPE_TO_METHOD[type];

    switch (method) {
      case "addBool":
        this.addBool(value as boolean);
        break;
      case "add8":
        this.addUint8(value as number);
        break;
      case "add16":
        this.addUint16(value as number);
        break;
      case "add32":
        this.addUint32(value as number);
        break;
      case "add64":
        this.addUint64(value as number | bigint);
        break;
      case "add128":
        this.addUint128(value as number | bigint);
        break;
      case "add256":
        this.addUint256(value as number | bigint);
        break;
      case "addAddress":
        this.addAddress(value as string);
        break;
    }

    return this;
  }

  /**
   * Finalize and perform encryption
   */
  async encrypt(): Promise<EncryptionResult> {
    const result = await this.input.encrypt();
    return {
      handles: result.handles,
      inputProof: result.inputProof,
    };
  }

  /**
   * Get the underlying RelayerEncryptedInput for advanced usage
   */
  getInput(): RelayerEncryptedInput {
    return this.input;
  }
}

/**
 * Validate encryption input value for a given type
 */
export function validateEncryptionValue(
  value: EncryptableValue,
  type: FHEDataType
): boolean {
  switch (type) {
    case "bool":
      return typeof value === "boolean";
    case "uint8":
      return (
        typeof value === "number" &&
        Number.isInteger(value) &&
        value >= 0 &&
        value <= 255
      );
    case "uint16":
      return (
        typeof value === "number" &&
        Number.isInteger(value) &&
        value >= 0 &&
        value <= 65535
      );
    case "uint32":
      return (
        typeof value === "number" &&
        Number.isInteger(value) &&
        value >= 0 &&
        value <= 4294967295
      );
    case "uint64":
      return (
        (typeof value === "number" || typeof value === "bigint") &&
        BigInt(value) >= 0n &&
        BigInt(value) <= 18446744073709551615n
      );
    case "uint128":
      return (
        (typeof value === "number" || typeof value === "bigint") &&
        BigInt(value) >= 0n &&
        BigInt(value) <= (2n ** 128n - 1n)
      );
    case "uint256":
      return (
        (typeof value === "number" || typeof value === "bigint") &&
        BigInt(value) >= 0n &&
        BigInt(value) <= (2n ** 256n - 1n)
      );
    case "address":
      return (
        typeof value === "string" &&
        /^0x[0-9a-fA-F]{40}$/.test(value)
      );
    default:
      return false;
  }
}

/**
 * Error thrown when encryption validation fails
 */
export class EncryptionValidationError extends Error {
  constructor(
    public value: EncryptableValue,
    public type: FHEDataType,
    message?: string
  ) {
    super(
      message ||
        `Invalid value for type ${type}: ${value}`
    );
    this.name = "EncryptionValidationError";
  }
}
