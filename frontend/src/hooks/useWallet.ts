import { useState, useCallback, useEffect } from "react";
import * as quais from "quais";
import { CONFIG } from "../config";

/** Pelagus injects window.pelagus; some Quai wallets may use window.ethereum */
declare global {
  interface Window {
    pelagus?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
    ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
  }
}

export interface WalletState {
  address: string | null;
  provider: quais.BrowserProvider | null;
  signer: quais.JsonRpcSigner | null;
  isConnecting: boolean;
  error: string | null;
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    address: null,
    provider: null,
    signer: null,
    isConnecting: false,
    error: null,
  });

  const getProvider = useCallback((): Window["pelagus"] | Window["ethereum"] | null => {
    return window.pelagus ?? window.ethereum ?? null;
  }, []);

  const connect = useCallback(async () => {
    const injected = getProvider();
    if (!injected) {
      setState((s) => ({
        ...s,
        error: "No wallet found. Install Pelagus from pelaguswallet.io",
      }));
      return;
    }

    setState((s) => ({ ...s, isConnecting: true, error: null }));

    try {
      const provider = new quais.BrowserProvider(
        injected as quais.Eip1193Provider,
        { name: "orchard", chainId: CONFIG.chainId }
      );
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      setState({
        address,
        provider,
        signer,
        isConnecting: false,
        error: null,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to connect";
      setState((s) => ({
        ...s,
        address: null,
        provider: null,
        signer: null,
        isConnecting: false,
        error: message,
      }));
    }
  }, [getProvider]);

  const disconnect = useCallback(() => {
    setState({
      address: null,
      provider: null,
      signer: null,
      isConnecting: false,
      error: null,
    });
  }, []);

  useEffect(() => {
    const injected = getProvider();
    if (!injected) return;

    const checkAccounts = async () => {
      try {
        const accounts = await (injected as { request: (a: { method: string }) => Promise<string[]> }).request({
          method: "quai_accounts",
        });
        if (accounts && Array.isArray(accounts) && accounts.length > 0) {
          const provider = new quais.BrowserProvider(
            injected as quais.Eip1193Provider,
            { name: "orchard", chainId: CONFIG.chainId }
          );
          const signer = await provider.getSigner(accounts[0]);
          const address = await signer.getAddress();
          setState((s) => ({
            ...s,
            address,
            provider,
            signer,
          }));
        }
      } catch {
        // Ignore - user not connected
      }
    };

    checkAccounts();
  }, [getProvider]);

  return { ...state, connect, disconnect };
}
