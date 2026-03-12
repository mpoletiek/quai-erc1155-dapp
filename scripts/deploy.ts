import hre from "hardhat";
import * as quais from "quais";
import * as fs from "fs";
import * as path from "path";
import * as deployMetadata from "@quai/hardhat-deploy-metadata";
import { HttpNetworkConfig } from "hardhat/types";

// Import compiled contract artifact
const QuaiTestERC1155Json = require("../artifacts/contracts/QuaiTestERC1155.sol/QuaiTestERC1155.json");

async function main() {
  console.log("Starting QuaiTestERC1155 deployment to Quai Network...\n");
  console.log("Network:", hre.network.name);

  const networkConfig = hre.network.config as HttpNetworkConfig;
  console.log("RPC URL:", networkConfig.url);

  // Set up provider and wallet
  console.log("Connecting to provider...");
  const provider = new quais.JsonRpcProvider(
    networkConfig.url,
    undefined,
    { usePathing: true }
  );

  // Warm up the provider — quais.JsonRpcProvider lazily initializes on first
  // RPC call. The initialize() method calls _waitGetRunningLocations() which
  // polls the Prime node to discover shard URLs. If the RPC is cold or slow,
  // this can hang indefinitely. We issue an explicit getBlockNumber() with a
  // timeout so the shard URL map gets populated before any wallet calls.
  console.log("Warming up provider (discovering shard locations)...");
  const warmupTimeout = 30_000; // 30 seconds
  try {
    const blockNumber = await Promise.race([
      provider.getBlockNumber("0x00"),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Provider warm-up timed out after 30s — is the RPC URL reachable?")),
          warmupTimeout
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
      "Private key not set in .env file. Please set the appropriate zone PK (e.g. CYPRUS1_PK=your_private_key)."
    );
  }

  // Ensure private key is properly formatted
  let privateKey = accounts[0].trim();
  if (!privateKey.startsWith("0x")) {
    privateKey = "0x" + privateKey;
  }

  if (privateKey.length !== 66) {
    throw new Error(
      `Invalid private key length: ${privateKey.length} (expected 66 characters including 0x prefix). ` +
        `Please check your private key in the .env file.`
    );
  }

  const wallet = new quais.Wallet(privateKey, provider);

  console.log("Deploying with account:", wallet.address);

  console.log("Fetching account balance...");
  const balance = await provider.getBalance(wallet.address);
  console.log("Account balance:", quais.formatQuai(balance), "QUAI\n");

  // Configuration
  const baseUri =
    process.env.TOKEN_BASE_URI ||
    "https://example.com/api/token/{id}.json";
  const royaltyBps = Number(process.env.ROYALTY_BPS || "500");

  console.log("Base URI:", baseUri);
  console.log("Royalty BPS:", royaltyBps, `(${royaltyBps / 100}%)`);

  // Deploy QuaiTestERC1155
  console.log("\nPushing metadata to IPFS...");

  // Push metadata to IPFS (REQUIRED for Quai Network deployment)
  const ipfsHash =
    await hre.deployMetadata.pushMetadataToIPFSWithBytecode(
      QuaiTestERC1155Json.bytecode
    );
  console.log("Metadata IPFS hash:", ipfsHash);

  console.log("Creating ContractFactory...");
  // Create factory with IPFS hash as 4th parameter (Quai-specific)
  const QuaiTestERC1155 = new quais.ContractFactory(
    QuaiTestERC1155Json.abi,
    QuaiTestERC1155Json.bytecode,
    wallet,
    ipfsHash
  );

  // Deploy with constructor args:
  // (address defaultAdmin, string baseUri, address royaltyReceiver, uint96 royaltyFeeNumerator)
  console.log("Sending deploy transaction...");
  const contract = await QuaiTestERC1155.deploy(
    wallet.address,
    baseUri,
    wallet.address,
    royaltyBps
  );
  const deployTx = contract.deploymentTransaction();
  console.log("Deploy tx sent:", deployTx?.hash);
  console.log("Waiting for confirmation (this may take a few minutes)...");
  const receipt = await deployTx?.wait();
  console.log("Confirmed in block:", receipt?.blockNumber);
  const contractAddress = await contract.getAddress();
  console.log(
    "Transaction hash:",
    contract.deploymentTransaction()?.hash
  );
  console.log("QuaiTestERC1155 deployed to:", contractAddress);

  // Save deployment artifact
  const deployment = {
    network: hre.network.name,
    chainId: (await provider.getNetwork()).chainId.toString(),
    deployer: wallet.address,
    timestamp: new Date().toISOString(),
    contracts: {
      QuaiTestERC1155: contractAddress,
    },
    ipfsHashes: {
      QuaiTestERC1155: ipfsHash,
    },
    constructorArgs: {
      defaultAdmin: wallet.address,
      baseUri: baseUri,
      royaltyReceiver: wallet.address,
      royaltyFeeNumerator: royaltyBps,
    },
  };

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }

  const deploymentFile = path.join(
    deploymentsDir,
    `deployment-${hre.network.name}-${Date.now()}.json`
  );
  fs.writeFileSync(deploymentFile, JSON.stringify(deployment, null, 2));

  console.log("\nDeployment complete!");
  console.log("Deployment details saved to:", deploymentFile);
  console.log("\nContract Address:", contractAddress);
  console.log(
    "\nSet this in your .env file:\n  ERC1155_CONTRACT=" + contractAddress
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
