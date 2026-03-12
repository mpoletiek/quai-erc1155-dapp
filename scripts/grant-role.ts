import * as quais from "quais";
import { setup } from "./utils";

const ROLE_MAP: Record<string, string> = {
  ADMIN: "0x0000000000000000000000000000000000000000000000000000000000000000",
  MINTER: quais.keccak256(quais.toUtf8Bytes("MINTER_ROLE")),
  URI_SETTER: quais.keccak256(quais.toUtf8Bytes("URI_SETTER_ROLE")),
  PAUSER: quais.keccak256(quais.toUtf8Bytes("PAUSER_ROLE")),
};

async function main() {
  const { wallet, contract, contractAddress } = await setup();

  const roleName = (process.env.ROLE || "").toUpperCase();
  const grantTo = process.env.GRANT_TO;

  console.log("ERC1155 Contract:", contractAddress);
  console.log("Caller:", wallet.address);
  console.log();

  if (!grantTo) {
    throw new Error("GRANT_TO is required. Set the address to grant the role to.");
  }

  if (!roleName || !ROLE_MAP[roleName]) {
    throw new Error(
      `ROLE is required. Valid values: ${Object.keys(ROLE_MAP).join(", ")}`
    );
  }

  const roleHash = ROLE_MAP[roleName];

  console.log(`Granting ${roleName} role to: ${grantTo}`);
  console.log("Role hash:", roleHash);

  // Check if already has role
  const alreadyHas = await contract.hasRole(roleHash, grantTo);
  if (alreadyHas) {
    console.log(`\nAddress ${grantTo} already has the ${roleName} role.`);
    return;
  }

  const tx = await contract.grantRole(roleHash, grantTo);
  console.log("\nTransaction hash:", tx.hash);
  await tx.wait();
  console.log("Role granted!");

  // Verify
  const hasRole = await contract.hasRole(roleHash, grantTo);
  console.log(`\nVerification - hasRole(${roleName}, ${grantTo}): ${hasRole}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
