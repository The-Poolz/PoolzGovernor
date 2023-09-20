import { keccak256 } from "ethers/lib/utils";

export function getSelectorFromSignature(sig: string): string {
  const hash = keccak256(Buffer.from(sig));
  const selector = hash.slice(0, 10);
  return selector;
}


export function getRoleOfSelector(_contract: string, selector: string): string {
    const _contractWithoutPrefix = _contract.replace("0x", "");
    const selectorWithoutPrefix = selector.replace("0x", "");
    const combined = _contractWithoutPrefix + selectorWithoutPrefix;
  
    const role = keccak256("0x" + combined);
  
    return role;
  }