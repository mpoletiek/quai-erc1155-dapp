import { setup } from "./utils";

async function main() {
  const { wallet, contract, contractAddress } = await setup();

  const setBase = process.env.SET_BASE_URI === "true";
  const tokenUri = process.env.TOKEN_URI;

  console.log("ERC1155 Contract:", contractAddress);
  console.log("Caller:", wallet.address);
  console.log();

  if (!tokenUri) {
    throw new Error("TOKEN_URI is required. Set the URI string to apply.");
  }

  if (setBase) {
    console.log("Setting base URI to:", tokenUri);

    const tx = await contract.setBaseURI(tokenUri);
    console.log("Transaction hash:", tx.hash);
    await tx.wait();
    console.log("Base URI updated!");
  } else {
    const tokenId = process.env.TOKEN_ID;
    if (!tokenId) {
      throw new Error(
        "TOKEN_ID is required for per-token URI. Use SET_BASE_URI=true for base URI."
      );
    }

    console.log(`Setting URI for token ${tokenId} to:`, tokenUri);

    const tx = await contract.setURI(BigInt(tokenId), tokenUri);
    console.log("Transaction hash:", tx.hash);
    await tx.wait();
    console.log("Token URI updated!");

    // Verify
    const currentUri = await contract.uri(BigInt(tokenId));
    console.log(`\nCurrent uri(${tokenId}):`, currentUri);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
