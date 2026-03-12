/**
 * Quai ERC1155 dApp configuration
 * Orchard Testnet (Cyprus zone)
 */
export const CONFIG = {
  /** Deployed contract address on Orchard Testnet Cyprus1 */
  contractAddress:
    import.meta.env.VITE_ERC1155_CONTRACT ||
    "0x005ce6Bae8AFA47328b5c711b19e40afD881cE38",
  /** Orchard Testnet chain ID */
  chainId: 15000,
  /** Cyprus1 RPC for read-only queries (optional fallback) */
  rpcUrl:
    import.meta.env.VITE_RPC_URL || "https://orchard.rpc.quai.network/cyprus1",
  /** Block explorer */
  explorerUrl: "https://orchard.quaiscan.io",
  /** Faucet for testnet QUAI */
  faucetUrl: "https://orchard.faucet.quai.network",
} as const;
