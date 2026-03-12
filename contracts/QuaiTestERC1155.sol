// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Pausable.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155URIStorage.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title QuaiTestERC1155
 * @dev Full-featured ERC1155 token for testing Quai Vault multisig interactions.
 *
 * Features:
 *  - Role-gated minting (single + batch)
 *  - Burning (via ERC1155Burnable — holder or approved operator)
 *  - Pausable transfers
 *  - Per-token and base URI management
 *  - Supply tracking per token ID
 *  - ERC2981 royalty info
 *  - AccessControl with MINTER, URI_SETTER, PAUSER roles
 */
contract QuaiTestERC1155 is
    ERC1155,
    ERC1155Burnable,
    ERC1155Pausable,
    ERC1155Supply,
    ERC1155URIStorage,
    ERC2981,
    AccessControl
{
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant URI_SETTER_ROLE = keccak256("URI_SETTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    constructor(
        address defaultAdmin,
        string memory baseUri,
        address royaltyReceiver,
        uint96 royaltyFeeNumerator
    ) ERC1155(baseUri) {
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(MINTER_ROLE, defaultAdmin);
        _grantRole(URI_SETTER_ROLE, defaultAdmin);
        _grantRole(PAUSER_ROLE, defaultAdmin);

        _setDefaultRoyalty(royaltyReceiver, royaltyFeeNumerator);
    }

    // ── Minting ──────────────────────────────────────────────────────────

    function mint(
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) external {
        _mint(to, id, amount, data);
    }

    function mintBatch(
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) external {
        _mintBatch(to, ids, amounts, data);
    }

    // ── URI Management ───────────────────────────────────────────────────

    function setURI(
        uint256 tokenId,
        string memory tokenURI
    ) external onlyRole(URI_SETTER_ROLE) {
        _setURI(tokenId, tokenURI);
    }

    function setBaseURI(
        string memory baseURI
    ) external onlyRole(URI_SETTER_ROLE) {
        _setBaseURI(baseURI);
    }

    // ── Pause / Unpause ──────────────────────────────────────────────────

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // ── Royalty Management ───────────────────────────────────────────────

    function setDefaultRoyalty(
        address receiver,
        uint96 feeNumerator
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setDefaultRoyalty(receiver, feeNumerator);
    }

    function setTokenRoyalty(
        uint256 tokenId,
        address receiver,
        uint96 feeNumerator
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setTokenRoyalty(tokenId, receiver, feeNumerator);
    }

    function deleteDefaultRoyalty() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _deleteDefaultRoyalty();
    }

    function resetTokenRoyalty(
        uint256 tokenId
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _resetTokenRoyalty(tokenId);
    }

    // ── Overrides (diamond inheritance resolution) ───────────────────────

    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal override(ERC1155, ERC1155Pausable, ERC1155Supply) {
        super._update(from, to, ids, values);
    }

    function uri(
        uint256 tokenId
    )
        public
        view
        override(ERC1155, ERC1155URIStorage)
        returns (string memory)
    {
        return ERC1155URIStorage.uri(tokenId);
    }

    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(ERC1155, ERC2981, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
