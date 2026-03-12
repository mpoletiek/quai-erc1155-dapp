import { setup } from "./utils";

async function main() {
  const { wallet, contract, contractAddress } = await setup();

  const mintTo = process.env.MINT_TO || wallet.address;
  const batch = process.env.BATCH === "true";

  console.log("ERC1155 Contract:", contractAddress);
  console.log("Minter:", wallet.address);
  console.log("Mint to:", mintTo);
  console.log("Mode:", batch ? "batch" : "single");
  console.log();

  if (batch) {
    const tokenIdsStr = process.env.TOKEN_IDS;
    const amountsStr = process.env.AMOUNTS;

    if (!tokenIdsStr || !amountsStr) {
      throw new Error(
        "BATCH=true requires TOKEN_IDS and AMOUNTS (comma-separated). " +
          'Example: TOKEN_IDS="1,2,3" AMOUNTS="100,200,300"'
      );
    }

    const ids = tokenIdsStr.split(",").map((s) => BigInt(s.trim()));
    const amounts = amountsStr.split(",").map((s) => BigInt(s.trim()));

    if (ids.length !== amounts.length) {
      throw new Error(
        `TOKEN_IDS length (${ids.length}) must match AMOUNTS length (${amounts.length}).`
      );
    }

    console.log("Token IDs:", ids.map(String).join(", "));
    console.log("Amounts:", amounts.map(String).join(", "));

    const tx = await contract.mintBatch(mintTo, ids, amounts, "0x");
    console.log("\nTransaction hash:", tx.hash);
    await tx.wait();
    console.log("Batch mint confirmed!");

    // Check balances
    console.log("\nBalances after mint:");
    for (let i = 0; i < ids.length; i++) {
      const bal = await contract.balanceOf(mintTo, ids[i]);
      console.log(`  Token ${ids[i]}: ${bal}`);
    }
  } else {
    const tokenId = process.env.TOKEN_ID;
    const amount = process.env.AMOUNT || "1";

    if (!tokenId) {
      throw new Error("TOKEN_ID is required. Example: TOKEN_ID=1 AMOUNT=100");
    }

    console.log("Token ID:", tokenId);
    console.log("Amount:", amount);

    const tx = await contract.mint(
      mintTo,
      BigInt(tokenId),
      BigInt(amount),
      "0x"
    );
    console.log("\nTransaction hash:", tx.hash);
    await tx.wait();
    console.log("Mint confirmed!");

    const bal = await contract.balanceOf(mintTo, BigInt(tokenId));
    console.log(`\nBalance of token ${tokenId} for ${mintTo}: ${bal}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
