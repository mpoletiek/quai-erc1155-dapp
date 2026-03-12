import { useMemo } from "react";
import * as quais from "quais";
import { CONFIG } from "../config";
import abi from "../contracts/abi.json";

export function useContract(signer: quais.JsonRpcSigner | null) {
  return useMemo(() => {
    if (!signer) return null;
    return new quais.Contract(CONFIG.contractAddress, abi as quais.InterfaceAbi, signer);
  }, [signer]);
}
