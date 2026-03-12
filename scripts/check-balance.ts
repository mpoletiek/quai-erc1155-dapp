import { setup } from "./utils";

async function main() {
  const { wallet, contract, contractAddress } = await setup();

  const checkAddress = process.env.CHECK_ADDRESS || wallet.address;

  console.log("ERC1155 Contract:", contractAddress);
  console.log("Checking address:", checkAddress);
  console.log();

  const tokenIdsStr = process.env.TOKEN_IDS;
  const singleId = process.env.TOKEN_ID;

  if (!tokenIdsStr && !singleId) {
    throw new Error(
      "TOKEN_ID or TOKEN_IDS is required. " +
        'Examples: TOKEN_ID=1 or TOKEN_IDS="1,2,3"'
    );
  }

  const ids: bigint[] = tokenIdsStr
    ? tokenIdsStr.split(",").map((s) => BigInt(s.trim()))
    : [BigInt(singleId!)];

  // Use balanceOfBatch for efficiency
  const addresses = ids.map(() => checkAddress);
  const balances = await contract.balanceOfBatch(addresses, ids);

  console.log("Token Balances:");
  console.log("─".repeat(50));
  console.log(
    "Token ID".padEnd(15) +
      "Balance".padEnd(15) +
      "Total Supply".padEnd(15) +
      "Exists"
  );
  console.log("─".repeat(50));

  for (let i = 0; i < ids.length; i++) {
    const totalSupply = await contract["totalSupply(uint256)"](ids[i]);
    const exists = await contract.exists(ids[i]);
    console.log(
      String(ids[i]).padEnd(15) +
        String(balances[i]).padEnd(15) +
        String(totalSupply).padEnd(15) +
        String(exists)
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
