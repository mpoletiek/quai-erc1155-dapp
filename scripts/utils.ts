import hre from "hardhat";
import * as quais from "quais";
import { HttpNetworkConfig } from "hardhat/types";

const QuaiTestERC1155Json = require("../artifacts/contracts/QuaiTestERC1155.sol/QuaiTestERC1155.json");

export interface SetupResult {
  provider: quais.JsonRpcProvider;
  wallet: quais.Wallet;
  contract: quais.Contract;
  contractAddress: string;
}

/**
 * Common setup for all interaction scripts:
 * - Creates quais provider with usePathing
 * - Validates and creates wallet from private key
 * - Connects to the deployed ERC1155 contract
 */
export async function setup(): Promise<SetupResult> {
  const networkConfig = hre.network.config as HttpNetworkConfig;

  console.log("Connecting to provider...");
  const provider = new quais.JsonRpcProvider(
    networkConfig.url,
    undefined,
    { usePathing: true }
  );

  // Warm up provider — force shard URL discovery before making wallet calls
  console.log("Warming up provider (discovering shard locations)...");
  try {
    const blockNumber = await Promise.race([
      provider.getBlockNumber("0x00"),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Provider warm-up timed out after 30s — is the RPC URL reachable?")),
          30_000
        )
      ),
    ]);
    console.log("Provider ready. Latest block:", blockNumber);
  } catch (err: any) {
    console.error("Failed to connect to provider:", err.message);
    throw err;
  }

  const accounts = networkConfig.accounts as string[];
  if (!accounts || accounts.length === 0 || !accounts[0]) {
    throw new Error(
      "Private key not set. Please set the appropriate zone PK in .env."
    );
  }

  let privateKey = accounts[0].trim();
  if (!privateKey.startsWith("0x")) {
    privateKey = "0x" + privateKey;
  }
  if (privateKey.length !== 66) {
    throw new Error(
      `Invalid private key length: ${privateKey.length} (expected 66 including 0x prefix).`
    );
  }

  const wallet = new quais.Wallet(privateKey, provider);

  const contractAddress = process.env.ERC1155_CONTRACT;
  if (!contractAddress) {
    throw new Error(
      "ERC1155_CONTRACT not set in .env. Deploy first, then set ERC1155_CONTRACT=<address>."
    );
  }

  const contract = new quais.Contract(
    contractAddress,
    QuaiTestERC1155Json.abi,
    wallet
  );

  return { provider, wallet, contract, contractAddress };
}
