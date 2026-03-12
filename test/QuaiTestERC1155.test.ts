import { expect } from "chai";
import { ethers } from "hardhat";
import { QuaiTestERC1155 } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("QuaiTestERC1155", function () {
  let token: QuaiTestERC1155;
  let admin: SignerWithAddress;
  let minter: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let royaltyReceiver: SignerWithAddress;

  const DEFAULT_ROYALTY_BPS = 500; // 5%
  const BASE_URI = "https://example.com/api/token/";

  // Role hashes
  let DEFAULT_ADMIN_ROLE: string;
  let MINTER_ROLE: string;
  let URI_SETTER_ROLE: string;
  let PAUSER_ROLE: string;

  beforeEach(async function () {
    [admin, minter, user1, user2, royaltyReceiver] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory("QuaiTestERC1155");
    token = await Factory.deploy(
      admin.address,
      BASE_URI,
      royaltyReceiver.address,
      DEFAULT_ROYALTY_BPS
    );
    await token.waitForDeployment();

    DEFAULT_ADMIN_ROLE = await token.DEFAULT_ADMIN_ROLE();
    MINTER_ROLE = await token.MINTER_ROLE();
    URI_SETTER_ROLE = await token.URI_SETTER_ROLE();
    PAUSER_ROLE = await token.PAUSER_ROLE();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 1. Deployment & Initialization
  // ═══════════════════════════════════════════════════════════════════════

  describe("Deployment & Initialization", function () {
    it("should grant all roles to the default admin", async function () {
      expect(await token.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.true;
      expect(await token.hasRole(MINTER_ROLE, admin.address)).to.be.true;
      expect(await token.hasRole(URI_SETTER_ROLE, admin.address)).to.be.true;
      expect(await token.hasRole(PAUSER_ROLE, admin.address)).to.be.true;
    });

    it("should set the base URI", async function () {
      // Mint a token so we can query its URI
      await token.connect(admin).mint(admin.address, 1, 1, "0x");
      const tokenUri = await token.uri(1);
      // ERC1155URIStorage returns base URI when no per-token URI is set
      expect(tokenUri).to.equal(BASE_URI);
    });

    it("should configure default royalty", async function () {
      const salePrice = ethers.parseEther("1");
      const [receiver, amount] = await token.royaltyInfo(1, salePrice);
      expect(receiver).to.equal(royaltyReceiver.address);
      // 5% of 1 ETH = 0.05 ETH
      expect(amount).to.equal(salePrice * BigInt(DEFAULT_ROYALTY_BPS) / 10000n);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 2. Minting
  // ═══════════════════════════════════════════════════════════════════════

  describe("Minting", function () {
    it("should mint a single token", async function () {
      await token.connect(admin).mint(user1.address, 1, 100, "0x");
      expect(await token.balanceOf(user1.address, 1)).to.equal(100);
    });

    it("should mint a batch of tokens", async function () {
      const ids = [1, 2, 3];
      const amounts = [100, 200, 300];
      await token.connect(admin).mintBatch(user1.address, ids, amounts, "0x");

      for (let i = 0; i < ids.length; i++) {
        expect(await token.balanceOf(user1.address, ids[i])).to.equal(amounts[i]);
      }
    });

    it("should emit TransferSingle event on single mint", async function () {
      await expect(token.connect(admin).mint(user1.address, 1, 100, "0x"))
        .to.emit(token, "TransferSingle")
        .withArgs(admin.address, ethers.ZeroAddress, user1.address, 1, 100);
    });

    it("should emit TransferBatch event on batch mint", async function () {
      const ids = [1, 2];
      const amounts = [100, 200];
      await expect(
        token.connect(admin).mintBatch(user1.address, ids, amounts, "0x")
      ).to.emit(token, "TransferBatch");
    });

    it("should allow anyone to mint (open minting for testing)", async function () {
      await token.connect(user1).mint(user2.address, 1, 50, "0x");
      expect(await token.balanceOf(user2.address, 1)).to.equal(50);
    });

    it("should revert when minting to zero address", async function () {
      await expect(
        token.connect(admin).mint(ethers.ZeroAddress, 1, 100, "0x")
      ).to.be.revertedWithCustomError(token, "ERC1155InvalidReceiver");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 3. Burning
  // ═══════════════════════════════════════════════════════════════════════

  describe("Burning", function () {
    beforeEach(async function () {
      await token.connect(admin).mint(user1.address, 1, 100, "0x");
      await token.connect(admin).mintBatch(user1.address, [2, 3], [200, 300], "0x");
    });

    it("should allow token holder to burn their own tokens", async function () {
      await token.connect(user1).burn(user1.address, 1, 50);
      expect(await token.balanceOf(user1.address, 1)).to.equal(50);
    });

    it("should allow approved operator to burn on behalf of holder", async function () {
      await token.connect(user1).setApprovalForAll(user2.address, true);
      await token.connect(user2).burn(user1.address, 1, 30);
      expect(await token.balanceOf(user1.address, 1)).to.equal(70);
    });

    it("should revert when unapproved address tries to burn", async function () {
      await expect(
        token.connect(user2).burn(user1.address, 1, 10)
      ).to.be.revertedWithCustomError(token, "ERC1155MissingApprovalForAll");
    });

    it("should revert when burning more than balance", async function () {
      await expect(
        token.connect(user1).burn(user1.address, 1, 200)
      ).to.be.revertedWithCustomError(token, "ERC1155InsufficientBalance");
    });

    it("should batch burn correctly", async function () {
      await token.connect(user1).burnBatch(user1.address, [2, 3], [100, 150]);
      expect(await token.balanceOf(user1.address, 2)).to.equal(100);
      expect(await token.balanceOf(user1.address, 3)).to.equal(150);
    });

    it("should update supply tracking after burn", async function () {
      expect(await token["totalSupply(uint256)"](1)).to.equal(100);
      await token.connect(user1).burn(user1.address, 1, 40);
      expect(await token["totalSupply(uint256)"](1)).to.equal(60);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 4. Transfers
  // ═══════════════════════════════════════════════════════════════════════

  describe("Transfers", function () {
    beforeEach(async function () {
      await token.connect(admin).mint(user1.address, 1, 100, "0x");
      await token.connect(admin).mintBatch(user1.address, [2, 3], [200, 300], "0x");
    });

    it("should allow token holder to safeTransferFrom", async function () {
      await token
        .connect(user1)
        .safeTransferFrom(user1.address, user2.address, 1, 50, "0x");
      expect(await token.balanceOf(user1.address, 1)).to.equal(50);
      expect(await token.balanceOf(user2.address, 1)).to.equal(50);
    });

    it("should allow approved operator to safeTransferFrom", async function () {
      await token.connect(user1).setApprovalForAll(user2.address, true);
      await token
        .connect(user2)
        .safeTransferFrom(user1.address, admin.address, 1, 25, "0x");
      expect(await token.balanceOf(user1.address, 1)).to.equal(75);
      expect(await token.balanceOf(admin.address, 1)).to.equal(25);
    });

    it("should allow safeBatchTransferFrom", async function () {
      await token
        .connect(user1)
        .safeBatchTransferFrom(
          user1.address,
          user2.address,
          [2, 3],
          [100, 200],
          "0x"
        );
      expect(await token.balanceOf(user2.address, 2)).to.equal(100);
      expect(await token.balanceOf(user2.address, 3)).to.equal(200);
    });

    it("should revert transfer without approval", async function () {
      await expect(
        token
          .connect(user2)
          .safeTransferFrom(user1.address, user2.address, 1, 10, "0x")
      ).to.be.revertedWithCustomError(token, "ERC1155MissingApprovalForAll");
    });

    it("should revert transfer to zero address", async function () {
      await expect(
        token
          .connect(user1)
          .safeTransferFrom(user1.address, ethers.ZeroAddress, 1, 10, "0x")
      ).to.be.revertedWithCustomError(token, "ERC1155InvalidReceiver");
    });

    it("should emit TransferSingle on single transfer", async function () {
      await expect(
        token
          .connect(user1)
          .safeTransferFrom(user1.address, user2.address, 1, 10, "0x")
      )
        .to.emit(token, "TransferSingle")
        .withArgs(user1.address, user1.address, user2.address, 1, 10);
    });

    it("should emit TransferBatch on batch transfer", async function () {
      await expect(
        token
          .connect(user1)
          .safeBatchTransferFrom(
            user1.address,
            user2.address,
            [2, 3],
            [10, 20],
            "0x"
          )
      ).to.emit(token, "TransferBatch");
    });

    it("should manage approval via setApprovalForAll / isApprovedForAll", async function () {
      expect(await token.isApprovedForAll(user1.address, user2.address)).to.be
        .false;
      await token.connect(user1).setApprovalForAll(user2.address, true);
      expect(await token.isApprovedForAll(user1.address, user2.address)).to.be
        .true;
      await token.connect(user1).setApprovalForAll(user2.address, false);
      expect(await token.isApprovedForAll(user1.address, user2.address)).to.be
        .false;
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 5. URI Management
  // ═══════════════════════════════════════════════════════════════════════

  describe("URI Management", function () {
    it("should return base URI by default", async function () {
      await token.connect(admin).mint(admin.address, 1, 1, "0x");
      expect(await token.uri(1)).to.equal(BASE_URI);
    });

    it("should set per-token URI", async function () {
      await token.connect(admin).mint(admin.address, 1, 1, "0x");
      const tokenSuffix = "1.json";
      await token.connect(admin).setURI(1, tokenSuffix);
      // Without setBaseURI, per-token URI is returned as-is
      expect(await token.uri(1)).to.equal(tokenSuffix);
    });

    it("should concatenate setBaseURI + per-token URI", async function () {
      await token.connect(admin).setBaseURI(BASE_URI);
      await token.connect(admin).setURI(1, "1.json");
      expect(await token.uri(1)).to.equal(BASE_URI + "1.json");
    });

    it("should update base URI via setBaseURI", async function () {
      const newBase = "https://newbase.com/";
      await token.connect(admin).setBaseURI(newBase);
      // Set a per-token URI so we can see the new base in effect
      await token.connect(admin).setURI(5, "5.json");
      expect(await token.uri(5)).to.equal(newBase + "5.json");
    });

    it("should revert when non-URI_SETTER tries to set URI", async function () {
      await expect(
        token.connect(user1).setURI(1, "https://bad.com")
      ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
    });

    it("should revert when non-URI_SETTER tries to set base URI", async function () {
      await expect(
        token.connect(user1).setBaseURI("https://bad.com/")
      ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
    });

    it("should emit URI event on setURI", async function () {
      await token.connect(admin).mint(admin.address, 1, 1, "0x");
      await expect(token.connect(admin).setURI(1, "updated.json")).to.emit(
        token,
        "URI"
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 6. Pause / Unpause
  // ═══════════════════════════════════════════════════════════════════════

  describe("Pause / Unpause", function () {
    beforeEach(async function () {
      await token.connect(admin).mint(user1.address, 1, 100, "0x");
    });

    it("should prevent transfers when paused", async function () {
      await token.connect(admin).pause();
      await expect(
        token
          .connect(user1)
          .safeTransferFrom(user1.address, user2.address, 1, 10, "0x")
      ).to.be.revertedWithCustomError(token, "EnforcedPause");
    });

    it("should prevent minting when paused", async function () {
      await token.connect(admin).pause();
      await expect(
        token.connect(admin).mint(user1.address, 2, 50, "0x")
      ).to.be.revertedWithCustomError(token, "EnforcedPause");
    });

    it("should prevent burning when paused", async function () {
      await token.connect(admin).pause();
      await expect(
        token.connect(user1).burn(user1.address, 1, 10)
      ).to.be.revertedWithCustomError(token, "EnforcedPause");
    });

    it("should re-enable transfers after unpause", async function () {
      await token.connect(admin).pause();
      await token.connect(admin).unpause();
      await token
        .connect(user1)
        .safeTransferFrom(user1.address, user2.address, 1, 10, "0x");
      expect(await token.balanceOf(user2.address, 1)).to.equal(10);
    });

    it("should revert when non-PAUSER tries to pause", async function () {
      await expect(
        token.connect(user1).pause()
      ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
    });

    it("should revert when non-PAUSER tries to unpause", async function () {
      await token.connect(admin).pause();
      await expect(
        token.connect(user1).unpause()
      ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
    });

    it("should emit Paused and Unpaused events", async function () {
      await expect(token.connect(admin).pause())
        .to.emit(token, "Paused")
        .withArgs(admin.address);
      await expect(token.connect(admin).unpause())
        .to.emit(token, "Unpaused")
        .withArgs(admin.address);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 7. Supply Tracking
  // ═══════════════════════════════════════════════════════════════════════

  describe("Supply Tracking", function () {
    it("should return correct totalSupply after mint", async function () {
      await token.connect(admin).mint(user1.address, 1, 100, "0x");
      expect(await token["totalSupply(uint256)"](1)).to.equal(100);
    });

    it("should return correct totalSupply after multiple mints", async function () {
      await token.connect(admin).mint(user1.address, 1, 100, "0x");
      await token.connect(admin).mint(user2.address, 1, 50, "0x");
      expect(await token["totalSupply(uint256)"](1)).to.equal(150);
    });

    it("should decrease totalSupply after burn", async function () {
      await token.connect(admin).mint(user1.address, 1, 100, "0x");
      await token.connect(user1).burn(user1.address, 1, 40);
      expect(await token["totalSupply(uint256)"](1)).to.equal(60);
    });

    it("should return true for exists() on minted tokens", async function () {
      await token.connect(admin).mint(user1.address, 1, 1, "0x");
      expect(await token.exists(1)).to.be.true;
    });

    it("should return false for exists() on unminted tokens", async function () {
      expect(await token.exists(999)).to.be.false;
    });

    it("should return false for exists() after burning all supply", async function () {
      await token.connect(admin).mint(user1.address, 1, 10, "0x");
      await token.connect(user1).burn(user1.address, 1, 10);
      expect(await token.exists(1)).to.be.false;
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 8. Royalty Info (ERC2981)
  // ═══════════════════════════════════════════════════════════════════════

  describe("Royalty Info (ERC2981)", function () {
    const salePrice = ethers.parseEther("10");

    it("should return default royalty info", async function () {
      const [receiver, amount] = await token.royaltyInfo(1, salePrice);
      expect(receiver).to.equal(royaltyReceiver.address);
      // 5% of 10 ETH = 0.5 ETH
      expect(amount).to.equal(salePrice * BigInt(DEFAULT_ROYALTY_BPS) / 10000n);
    });

    it("should allow per-token royalty override", async function () {
      await token.connect(admin).setTokenRoyalty(1, user1.address, 1000); // 10%
      const [receiver, amount] = await token.royaltyInfo(1, salePrice);
      expect(receiver).to.equal(user1.address);
      expect(amount).to.equal(salePrice * 1000n / 10000n);
    });

    it("should update default royalty", async function () {
      await token.connect(admin).setDefaultRoyalty(user2.address, 250); // 2.5%
      const [receiver, amount] = await token.royaltyInfo(99, salePrice);
      expect(receiver).to.equal(user2.address);
      expect(amount).to.equal(salePrice * 250n / 10000n);
    });

    it("should delete default royalty", async function () {
      await token.connect(admin).deleteDefaultRoyalty();
      const [receiver, amount] = await token.royaltyInfo(99, salePrice);
      expect(receiver).to.equal(ethers.ZeroAddress);
      expect(amount).to.equal(0);
    });

    it("should reset per-token royalty back to default", async function () {
      await token.connect(admin).setTokenRoyalty(1, user1.address, 1000);
      await token.connect(admin).resetTokenRoyalty(1);
      const [receiver, amount] = await token.royaltyInfo(1, salePrice);
      expect(receiver).to.equal(royaltyReceiver.address);
      expect(amount).to.equal(salePrice * BigInt(DEFAULT_ROYALTY_BPS) / 10000n);
    });

    it("should revert when non-admin tries to set royalty", async function () {
      await expect(
        token.connect(user1).setDefaultRoyalty(user1.address, 100)
      ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 9. Access Control
  // ═══════════════════════════════════════════════════════════════════════

  describe("Access Control", function () {
    it("should allow admin to grant roles", async function () {
      await token.connect(admin).grantRole(MINTER_ROLE, user1.address);
      expect(await token.hasRole(MINTER_ROLE, user1.address)).to.be.true;
    });

    it("should allow admin to revoke roles", async function () {
      await token.connect(admin).grantRole(MINTER_ROLE, user1.address);
      await token.connect(admin).revokeRole(MINTER_ROLE, user1.address);
      expect(await token.hasRole(MINTER_ROLE, user1.address)).to.be.false;
    });

    it("should allow role holder to renounce their own role", async function () {
      await token.connect(admin).grantRole(MINTER_ROLE, user1.address);
      await token.connect(user1).renounceRole(MINTER_ROLE, user1.address);
      expect(await token.hasRole(MINTER_ROLE, user1.address)).to.be.false;
    });

    it("should revert when non-admin tries to grant roles", async function () {
      await expect(
        token.connect(user1).grantRole(MINTER_ROLE, user2.address)
      ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
    });

    it("should return correct role admin", async function () {
      expect(await token.getRoleAdmin(MINTER_ROLE)).to.equal(DEFAULT_ADMIN_ROLE);
      expect(await token.getRoleAdmin(URI_SETTER_ROLE)).to.equal(
        DEFAULT_ADMIN_ROLE
      );
      expect(await token.getRoleAdmin(PAUSER_ROLE)).to.equal(DEFAULT_ADMIN_ROLE);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 10. Interface Support (ERC165)
  // ═══════════════════════════════════════════════════════════════════════

  describe("Interface Support (ERC165)", function () {
    it("should support IERC165", async function () {
      expect(await token.supportsInterface("0x01ffc9a7")).to.be.true;
    });

    it("should support IERC1155", async function () {
      expect(await token.supportsInterface("0xd9b67a26")).to.be.true;
    });

    it("should support IERC1155MetadataURI", async function () {
      expect(await token.supportsInterface("0x0e89341c")).to.be.true;
    });

    it("should support IERC2981", async function () {
      expect(await token.supportsInterface("0x2a55205a")).to.be.true;
    });

    it("should support IAccessControl", async function () {
      expect(await token.supportsInterface("0x7965db0b")).to.be.true;
    });

    it("should not support random interface", async function () {
      expect(await token.supportsInterface("0xdeadbeef")).to.be.false;
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 11. Vault Interaction Simulation
  // ═══════════════════════════════════════════════════════════════════════

  describe("Vault Interaction Simulation", function () {
    // Simulates the patterns used in QUAI-VAULT's TokenReceiver.test.ts

    it("should mint tokens directly to a vault address", async function () {
      // Simulate minting to a vault (use user2 as vault stand-in)
      const vaultAddr = user2.address;
      await token.connect(admin).mint(vaultAddr, 1, 100, "0x");
      expect(await token.balanceOf(vaultAddr, 1)).to.equal(100);
    });

    it("should allow vault to send tokens via safeTransferFrom (with approval)", async function () {
      const vaultAddr = user2.address;
      const recipient = user1.address;

      // Mint to vault
      await token.connect(admin).mint(vaultAddr, 1, 100, "0x");

      // Vault transfers out (user2 acts as vault signer)
      await token
        .connect(user2)
        .safeTransferFrom(vaultAddr, recipient, 1, 50, "0x");

      expect(await token.balanceOf(vaultAddr, 1)).to.equal(50);
      expect(await token.balanceOf(recipient, 1)).to.equal(50);
    });

    it("should receive tokens via safeTransferFrom to vault", async function () {
      const vaultAddr = user2.address;

      // Mint to user1
      await token.connect(admin).mint(user1.address, 1, 100, "0x");

      // user1 transfers to vault
      await token
        .connect(user1)
        .safeTransferFrom(user1.address, vaultAddr, 1, 100, "0x");

      expect(await token.balanceOf(vaultAddr, 1)).to.equal(100);
    });

    it("should handle batch mint to vault and batch transfer out", async function () {
      const vaultAddr = user2.address;
      const recipient = user1.address;
      const ids = [1, 2, 3];
      const amounts = [100, 200, 300];

      // Batch mint to vault
      await token.connect(admin).mintBatch(vaultAddr, ids, amounts, "0x");

      for (let i = 0; i < ids.length; i++) {
        expect(await token.balanceOf(vaultAddr, ids[i])).to.equal(amounts[i]);
      }

      // Vault batch transfers out
      const transferAmounts = [50, 100, 150];
      await token
        .connect(user2)
        .safeBatchTransferFrom(vaultAddr, recipient, ids, transferAmounts, "0x");

      for (let i = 0; i < ids.length; i++) {
        expect(await token.balanceOf(recipient, ids[i])).to.equal(
          transferAmounts[i]
        );
        expect(await token.balanceOf(vaultAddr, ids[i])).to.equal(
          amounts[i] - transferAmounts[i]
        );
      }
    });

    it("should handle batch receive via safeBatchTransferFrom to vault", async function () {
      const vaultAddr = user2.address;
      const ids = [1, 2, 3];
      const amounts = [100, 200, 300];

      // Mint to user1
      for (let i = 0; i < ids.length; i++) {
        await token.connect(admin).mint(user1.address, ids[i], amounts[i], "0x");
      }

      // Batch transfer to vault
      await token
        .connect(user1)
        .safeBatchTransferFrom(user1.address, vaultAddr, ids, amounts, "0x");

      for (let i = 0; i < ids.length; i++) {
        expect(await token.balanceOf(vaultAddr, ids[i])).to.equal(amounts[i]);
      }
    });

    it("should support balanceOfBatch for vault holdings", async function () {
      const vaultAddr = user2.address;
      const ids = [1, 2, 3];
      const amounts = [100, 200, 300];

      await token.connect(admin).mintBatch(vaultAddr, ids, amounts, "0x");

      const addresses = ids.map(() => vaultAddr);
      const balances = await token.balanceOfBatch(addresses, ids);

      for (let i = 0; i < ids.length; i++) {
        expect(balances[i]).to.equal(amounts[i]);
      }
    });
  });
});
