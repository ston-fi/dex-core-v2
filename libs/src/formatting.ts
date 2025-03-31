import { fromNanos } from "./balances";
import { AccountState, fetchJettonData } from "./onchain-helper";
import { AsyncReturnType } from "./types";
import { toRevStr } from "./utils";

export function prettyFees(fee: number | bigint | null | undefined) {
    if (fee === undefined || fee === null) {
        return null;
    } else {
        return `${fromNanos(BigInt(fee), 2)}%`;
    }
}

export function prettyVersion(version: { major: number; minor: number; dev: string; } | null | undefined) {
    if (version === undefined || version === null) {
        return null;
    } else {
        return `v${version.major}.${version.minor}-${version.dev}`;
    }
}

export function fDate(seconds: number | bigint) {
    seconds = Number(seconds)
    let d = new Date(seconds * 1000)
    return `${Math.floor(seconds / 86400)}d` + d.toISOString().substring(11, 19)
}

export function prettyBalance(balance: bigint | number | null | undefined, tokenData: AsyncReturnType<typeof fetchJettonData>) {
    if (balance === undefined || balance === null) {
        return null
    } else {
        return `${fromNanos(BigInt(balance), tokenData.decimals)} ${tokenData.symbol ? tokenData.symbol : "???"}`
    }
}

export function prettyState(state: AccountState) {
    let colorTag: string = ""
    if (state === "active") {
        colorTag = "<g>"
    } else if (state === "frozen") {
        colorTag = "<b>"
    } else if (state === "uninit") {
        colorTag = "<r>"
    }
    return `${colorTag}${state.toUpperCase()}`
}

export function prettyNumber(src: number | bigint) {
    // don't add to decimal part
    let strSrc = src.toString().split(".")
    let sign = strSrc[0].includes("-") ? "-" : ""
    strSrc[0] = strSrc[0].replace("-", "")
    strSrc[0] = toRevStr(toRevStr(strSrc[0]).match(/.{1,3}/g)?.join("_"))
    return sign + strSrc.join(".")
}