import { setup } from "./utils";

async function main() {
  const { wallet, contract, contractAddress } = await setup();

  const transferTo = process.env.TRANSFER_TO;
  if (!transferTo) {
    throw new Error("TRANSFER_TO is required. Set the recipient address.");
  }

  const batch = process.env.BATCH === "true";

  console.log("ERC1155 Contract:", contractAddress);
  console.log("From:", wallet.address);
  console.log("To:", transferTo);
  console.log("Mode:", batch ? "batch" : "single");
  console.log();

  if (batch) {
    const tokenIdsStr = process.env.TOKEN_IDS;
    const amountsStr = process.env.AMOUNTS;

    if (!tokenIdsStr || !amountsStr) {
      throw new Error(
        "BATCH=true requires TOKEN_IDS and AMOUNTS (comma-separated)."
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

    const tx = await contract.safeBatchTransferFrom(
      wallet.address,
      transferTo,
      ids,
      amounts,
      "0x"
    );
    console.log("\nTransaction hash:", tx.hash);
    await tx.wait();
    console.log("Batch transfer confirmed!");

    console.log("\nRecipient balances after transfer:");
    for (let i = 0; i < ids.length; i++) {
      const bal = await contract.balanceOf(transferTo, ids[i]);
      console.log(`  Token ${ids[i]}: ${bal}`);
    }
  } else {
    const tokenId = process.env.TOKEN_ID;
    const amount = process.env.AMOUNT || "1";

    if (!tokenId) {
      throw new Error("TOKEN_ID is required.");
    }

    console.log("Token ID:", tokenId);
    console.log("Amount:", amount);

    // Show balance before
    const balBefore = await contract.balanceOf(
      wallet.address,
      BigInt(tokenId)
    );
    console.log(`\nSender balance before: ${balBefore}`);

    const tx = await contract.safeTransferFrom(
      wallet.address,
      transferTo,
      BigInt(tokenId),
      BigInt(amount),
      "0x"
    );
    console.log("Transaction hash:", tx.hash);
    await tx.wait();
    console.log("Transfer confirmed!");

    const senderBal = await contract.balanceOf(
      wallet.address,
      BigInt(tokenId)
    );
    const recipientBal = await contract.balanceOf(
      transferTo,
      BigInt(tokenId)
    );
    console.log(`\nSender balance after: ${senderBal}`);
    console.log(`Recipient balance after: ${recipientBal}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
