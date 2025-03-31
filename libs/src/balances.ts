import { OpenedContract, toNano } from "@ton/core";
import { SandboxContract } from "@ton/sandbox";
import { JettonWalletContract } from "./wrappers/JettonWallet";
import { toRevStr } from "./utils";

export function fromNanos(val: bigint, decimals = 9) {
    let revVal = toRevStr(val);
    let deci = (toRevStr(revVal.slice(0, decimals)) || "0").padStart(decimals, "0");
    let main = toRevStr(revVal.slice(decimals)) || "0";
    return `${main}.${deci}`;
}

export function toCoins(src: number | string | bigint, decimals = 9) {
    if (decimals <= 9) {
        return toNano(src) / 10n ** BigInt(9 - decimals);
    } else {
        if (typeof src === "string") {
            let parts = src.split(".");
            let deci = parts[1] ? parts[1] : "";
            if (deci.length > decimals) {
                throw new Error("too many decimals in source");
            }
            deci = deci.padEnd(decimals, "0");
            return BigInt(`${parts[0]}${deci}`);
        } else {
            return toNano(src) * 10n ** BigInt(decimals - 9);
        }
    }
}

export async function getWalletBalance(wallet: SandboxContract<JettonWalletContract> | OpenedContract<JettonWalletContract>) {
    try {
        return (await wallet.getWalletData()).balance;
    } catch {
        return 0n;
    }
}