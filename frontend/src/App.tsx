import { useState, useCallback, useEffect } from "react";
import { useWallet } from "./hooks/useWallet";
import { useContract } from "./hooks/useContract";
import { CONFIG } from "./config";
import "./App.css";

function App() {
  const { address, signer, isConnecting, error, connect, disconnect } = useWallet();
  const contract = useContract(signer);
  const [tokenId, setTokenId] = useState("1");
  const [amount, setAmount] = useState("1");
  const [transferTo, setTransferTo] = useState("");
  const [transferAmount, setTransferAmount] = useState("1");
  const [balance, setBalance] = useState<bigint | null>(null);
  const [totalSupply, setTotalSupply] = useState<bigint | null>(null);
  const [tokenUri, setTokenUri] = useState<string | null>(null);
  const [exists, setExists] = useState<boolean | null>(null);
  const [paused, setPaused] = useState<boolean | null>(null);
  const [royaltyInfo, setRoyaltyInfo] = useState<{ receiver: string; amount: bigint } | null>(null);
  const [hasUriRole, setHasUriRole] = useState(false);
  const [hasAdminRole, setHasAdminRole] = useState(false);
  const [txStatus, setTxStatus] = useState<{ type: "pending" | "success" | "error"; message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [burnAmount, setBurnAmount] = useState("1");
  const [copied, setCopied] = useState(false);
  const [copiedUri, setCopiedUri] = useState(false);
  const [copiedRoyalty, setCopiedRoyalty] = useState(false);
  const [newTokenUri, setNewTokenUri] = useState("");
  const [newBaseUri, setNewBaseUri] = useState("");
  const [newRoyaltyReceiver, setNewRoyaltyReceiver] = useState("");
  const [newRoyaltyBps, setNewRoyaltyBps] = useState("500");

  const refreshBalance = useCallback(async () => {
    if (!contract || !address) return;
    const id = BigInt(tokenId || "1");
    try {
      const bal = await contract.balanceOf(address, id);
      setBalance(bal);
    } catch {
      setBalance(null);
    }
    try {
      const supply = await contract.getFunction("totalSupply(uint256)")(id);
      setTotalSupply(supply);
    } catch {
      setTotalSupply(null);
    }
    try {
      const [uri, tokenExists, isPaused, royalty, uriRole, adminRole] = await Promise.all([
        contract.uri(id),
        contract.exists(id),
        contract.paused(),
        contract.royaltyInfo(id, BigInt(1e18)),
        contract.hasRole(await contract.URI_SETTER_ROLE(), address),
        contract.hasRole(await contract.DEFAULT_ADMIN_ROLE(), address),
      ]);
      setTokenUri(uri);
      setExists(tokenExists);
      setPaused(isPaused);
      setRoyaltyInfo({ receiver: royalty[0], amount: royalty[1] });
      setHasUriRole(uriRole);
      setHasAdminRole(adminRole);
    } catch {
      setTokenUri(null);
      setExists(null);
      setPaused(null);
      setRoyaltyInfo(null);
      setHasUriRole(false);
      setHasAdminRole(false);
    }
  }, [contract, address, tokenId]);

  useEffect(() => {
    if (address && contract) refreshBalance();
  }, [address, contract, refreshBalance]);

  const copyAddress = useCallback(() => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [address]);

  const copyToClipboard = useCallback((text: string, setter: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  }, []);

  const showToast = useCallback((type: "pending" | "success" | "error", message: string) => {
    setTxStatus({ type, message });
    if (type !== "pending") {
      setTimeout(() => setTxStatus(null), 4000);
    }
  }, []);

  const handleMint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contract || !address) return;
    setLoading(true);
    setTxStatus(null);
    try {
      const tx = await contract.mint(address, BigInt(tokenId), BigInt(amount), "0x");
      showToast("pending", `Minting… ${tx.hash.slice(0, 10)}…`);
      await tx.wait();
      showToast("success", "Mint confirmed!");
      await refreshBalance();
    } catch (err: unknown) {
      showToast("error", err instanceof Error ? err.message : "Mint failed");
    } finally {
      setLoading(false);
    }
  };

  const handleBurn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contract || !address) return;
    setLoading(true);
    setTxStatus(null);
    try {
      const tx = await contract.burn(address, BigInt(tokenId), BigInt(burnAmount));
      showToast("pending", `Burning… ${tx.hash.slice(0, 10)}…`);
      await tx.wait();
      showToast("success", "Burn confirmed!");
      await refreshBalance();
    } catch (err: unknown) {
      showToast("error", err instanceof Error ? err.message : "Burn failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSetUri = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contract || !newTokenUri.trim()) return;
    setLoading(true);
    setTxStatus(null);
    try {
      const tx = await contract.setURI(BigInt(tokenId), newTokenUri.trim());
      showToast("pending", `Setting URI… ${tx.hash.slice(0, 10)}…`);
      await tx.wait();
      showToast("success", "URI updated!");
      setNewTokenUri("");
      await refreshBalance();
    } catch (err: unknown) {
      showToast("error", err instanceof Error ? err.message : "Set URI failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSetBaseUri = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contract || !newBaseUri.trim()) return;
    setLoading(true);
    setTxStatus(null);
    try {
      const tx = await contract.setBaseURI(newBaseUri.trim());
      showToast("pending", `Setting base URI… ${tx.hash.slice(0, 10)}…`);
      await tx.wait();
      showToast("success", "Base URI updated!");
      setNewBaseUri("");
      await refreshBalance();
    } catch (err: unknown) {
      showToast("error", err instanceof Error ? err.message : "Set base URI failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSetRoyalty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contract || !newRoyaltyReceiver.trim()) return;
    const bps = Math.min(10000, Math.max(0, parseInt(newRoyaltyBps, 10) || 0));
    setLoading(true);
    setTxStatus(null);
    try {
      const tx = await contract.setDefaultRoyalty(newRoyaltyReceiver.trim(), bps);
      showToast("pending", `Setting royalty… ${tx.hash.slice(0, 10)}…`);
      await tx.wait();
      showToast("success", "Royalty updated!");
      setNewRoyaltyReceiver("");
      await refreshBalance();
    } catch (err: unknown) {
      showToast("error", err instanceof Error ? err.message : "Set royalty failed");
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contract || !address || !transferTo.trim()) return;
    setLoading(true);
    setTxStatus(null);
    try {
      const tx = await contract.safeTransferFrom(
        address,
        transferTo.trim(),
        BigInt(tokenId),
        BigInt(transferAmount),
        "0x"
      );
      showToast("pending", `Transferring… ${tx.hash.slice(0, 10)}…`);
      await tx.wait();
      showToast("success", "Transfer confirmed!");
      await refreshBalance();
    } catch (err: unknown) {
      showToast("error", err instanceof Error ? err.message : "Transfer failed");
    } finally {
      setLoading(false);
    }
  };

  const shortAddress = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

  return (
    <div className="app">
      {/* Toast */}
      {txStatus && (
        <div className={`toast toast-${txStatus.type}`} role="status">
          {txStatus.type === "pending" && <span className="toast-spinner" />}
          <span>{txStatus.message}</span>
        </div>
      )}

      <header className="header">
        <div className="header-inner">
          <div className="brand">
            <span className="brand-icon">◇</span>
            <h1 className="brand-title">Quai ERC1155</h1>
          </div>
          <div className="header-actions">
            {address ? (
              <div className="wallet-pill">
                <button
                  type="button"
                  className="wallet-address"
                  onClick={copyAddress}
                  title="Copy address"
                >
                  {shortAddress(address)}
                  {copied && <span className="copy-indicator copied">✓</span>}
                </button>
                <button type="button" className="btn btn-ghost" onClick={disconnect}>
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={connect}
                disabled={isConnecting}
              >
                {isConnecting ? (
                  <>
                    <span className="btn-spinner" />
                    Connecting…
                  </>
                ) : (
                  "Connect Pelagus"
                )}
              </button>
            )}
          </div>
        </div>
        {error && <p className="header-error">{error}</p>}
      </header>

      <main className="main">
        {!address && (
          <section className="hero">
            <h2 className="hero-title">ERC1155 testnet playground</h2>
            <p className="hero-subtitle">
              Mint, transfer, and burn tokens on Quai Network. Open to everyone — no whitelist.
            </p>
            <div className="hero-card">
              <h3>Get started</h3>
              <ol>
                <li>
                  Install <a href="https://pelaguswallet.io" target="_blank" rel="noopener noreferrer">Pelagus Wallet</a>
                </li>
                <li>
                  Switch to <strong>Quai Orchard Testnet</strong>
                </li>
                <li>
                  Get test QUAI from the <a href={CONFIG.faucetUrl} target="_blank" rel="noopener noreferrer">faucet</a>
                </li>
              </ol>
              <button type="button" className="btn btn-primary btn-lg" onClick={connect} disabled={isConnecting}>
                {isConnecting ? "Connecting…" : "Connect wallet"}
              </button>
            </div>
          </section>
        )}

        {address && contract && (
          <div className="dashboard">
            {/* Token context bar */}
            <div className="token-context">
              <label className="token-context-label">Token ID</label>
              <div className="token-context-input">
                <input
                  type="number"
                  min="1"
                  value={tokenId}
                  onChange={(e) => setTokenId(e.target.value)}
                />
                <button type="button" className="btn btn-ghost btn-sm" onClick={refreshBalance} title="Refresh">
                  ↻
                </button>
              </div>
            </div>

            {/* Stats row */}
            <div className="stats-row">
              <div className="stat">
                <span className="stat-label">Your balance</span>
                <span className="stat-value">
                  {balance !== null ? balance.toString() : "—"}
                </span>
              </div>
              <div className="stat">
                <span className="stat-label">Total supply</span>
                <span className="stat-value">
                  {totalSupply !== null ? totalSupply.toString() : "—"}
                </span>
              </div>
              {exists !== null && (
                <div className="stat stat-pill">
                  <span className={`badge ${exists ? "badge-success" : "badge-muted"}`}>
                    {exists ? "Exists" : "Not minted"}
                  </span>
                </div>
              )}
              {paused !== null && paused && (
                <div className="stat stat-pill">
                  <span className="badge badge-error">Paused</span>
                </div>
              )}
            </div>

            {/* Token metadata & royalty */}
            <div className="token-meta">
              {tokenUri != null && tokenUri !== "" && (
                <div className="meta-block">
                  <span className="meta-label">Token URI</span>
                  <div className="meta-value-row">
                    <code className="meta-uri">
                      {tokenUri.replace("{id}", tokenId)}
                    </code>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm meta-copy"
                      onClick={() => copyToClipboard(tokenUri.replace("{id}", tokenId), setCopiedUri)}
                      title="Copy"
                    >
                      {copiedUri ? "✓" : "⎘"}
                    </button>
                    <a
                      href={tokenUri.replace("{id}", tokenId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-ghost btn-sm"
                    >
                      ↗
                    </a>
                  </div>
                </div>
              )}
              {royaltyInfo !== null && (
                <div className="meta-block">
                  <span className="meta-label">Royalty</span>
                  <div className="meta-value-row">
                    <span className="meta-royalty-text">
                      {royaltyInfo.amount > 0n
                        ? `${(Number(royaltyInfo.amount) / 1e18 * 100).toFixed(1)}% → ${royaltyInfo.receiver}`
                        : "None"}
                    </span>
                    {royaltyInfo.receiver !== "0x0000000000000000000000000000000000000000" && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm meta-copy"
                        onClick={() => copyToClipboard(royaltyInfo.receiver, setCopiedRoyalty)}
                        title="Copy receiver"
                      >
                        {copiedRoyalty ? "✓" : "⎘"}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Admin: Set URI & Royalty (role-gated) */}
            {(hasUriRole || hasAdminRole) && (
              <div className="admin-section">
                <h3 className="admin-title">Admin</h3>
                {hasUriRole && (
                  <div className="admin-cards">
                    <section className="card card-admin">
                      <h4>Set token URI</h4>
                      <form onSubmit={handleSetUri} className="form">
                        <div className="form-group">
                          <label>URI for token {tokenId}</label>
                          <input
                            type="text"
                            placeholder="https://…"
                            value={newTokenUri}
                            onChange={(e) => setNewTokenUri(e.target.value)}
                          />
                        </div>
                        <button type="submit" className="btn btn-secondary btn-block" disabled={loading}>
                          {loading ? <span className="btn-spinner" /> : null}
                          Set URI
                        </button>
                      </form>
                    </section>
                    <section className="card card-admin">
                      <h4>Set base URI</h4>
                      <form onSubmit={handleSetBaseUri} className="form">
                        <div className="form-group">
                          <label>Base URI (use {"{id}"} for token ID)</label>
                          <input
                            type="text"
                            placeholder="https://…/{'{id}'}.json"
                            value={newBaseUri}
                            onChange={(e) => setNewBaseUri(e.target.value)}
                          />
                        </div>
                        <button type="submit" className="btn btn-secondary btn-block" disabled={loading}>
                          {loading ? <span className="btn-spinner" /> : null}
                          Set base URI
                        </button>
                      </form>
                    </section>
                  </div>
                )}
                {hasAdminRole && (
                  <section className="card card-admin">
                    <h4>Set default royalty</h4>
                    <form onSubmit={handleSetRoyalty} className="form">
                      <div className="form-row-2">
                        <div className="form-group form-group-amount">
                          <label>BPS (0–10000)</label>
                          <input
                            type="number"
                            min="0"
                            max="10000"
                            placeholder="500"
                            value={newRoyaltyBps}
                            onChange={(e) => setNewRoyaltyBps(e.target.value)}
                          />
                        </div>
                        <div className="form-group form-group-flex">
                          <label>Receiver</label>
                          <input
                            type="text"
                            placeholder="0x00…"
                            value={newRoyaltyReceiver}
                            onChange={(e) => setNewRoyaltyReceiver(e.target.value)}
                          />
                        </div>
                      </div>
                      <button type="submit" className="btn btn-secondary btn-block" disabled={loading}>
                        {loading ? <span className="btn-spinner" /> : null}
                        Set royalty
                      </button>
                    </form>
                  </section>
                )}
              </div>
            )}

            {/* Action cards */}
            <div className="actions-grid">
              <section className="card card-mint">
                <div className="card-header">
                  <span className="card-icon">✦</span>
                  <h2>Mint</h2>
                </div>
                <p className="card-hint">Anyone can mint — open for testing</p>
                <form onSubmit={handleMint} className="form">
                  <div className="form-group">
                    <label>Amount</label>
                    <input
                      type="number"
                      min="1"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                    {loading ? <span className="btn-spinner" /> : null}
                    {loading ? "Minting…" : "Mint"}
                  </button>
                </form>
              </section>

              <section className="card card-transfer">
                <div className="card-header">
                  <span className="card-icon">→</span>
                  <h2>Transfer</h2>
                </div>
                <form onSubmit={handleTransfer} className="form">
                  <div className="form-row-2">
                    <div className="form-group form-group-amount">
                      <label>Amount</label>
                      <input
                        type="number"
                        min="1"
                        value={transferAmount}
                        onChange={(e) => setTransferAmount(e.target.value)}
                      />
                    </div>
                    <div className="form-group form-group-flex">
                      <label>To address</label>
                      <input
                        type="text"
                        placeholder="0x00…"
                        value={transferTo}
                        onChange={(e) => setTransferTo(e.target.value)}
                      />
                    </div>
                  </div>
                  <button type="submit" className="btn btn-secondary btn-block" disabled={loading}>
                    {loading ? <span className="btn-spinner" /> : null}
                    {loading ? "Transferring…" : "Transfer"}
                  </button>
                </form>
              </section>

              <section className="card card-burn">
                <div className="card-header">
                  <span className="card-icon">✕</span>
                  <h2>Burn</h2>
                </div>
                <p className="card-hint">Burn your own tokens</p>
                <form onSubmit={handleBurn} className="form">
                  <div className="form-group">
                    <label>Amount</label>
                    <input
                      type="number"
                      min="1"
                      value={burnAmount}
                      onChange={(e) => setBurnAmount(e.target.value)}
                    />
                  </div>
                  <button
                    type="submit"
                    className="btn btn-ghost btn-block btn-danger"
                    disabled={loading || (balance !== null && balance === 0n)}
                  >
                    {loading ? <span className="btn-spinner" /> : null}
                    {loading ? "Burning…" : "Burn"}
                  </button>
                </form>
              </section>
            </div>
          </div>
        )}
      </main>

      <footer className="footer">
        <a href={`${CONFIG.explorerUrl}/address/${CONFIG.contractAddress}`} target="_blank" rel="noopener noreferrer">
          View contract on Quaiscan
        </a>
      </footer>
    </div>
  );
}

export default App;
