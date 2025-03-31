import { toNano } from "@ton/core";

export function rndBigInt32(): bigint {
    return BigInt(Math.floor(Math.random() * Math.pow(2, 31)));
}

export function rndBigInt64(): bigint {
    return (rndBigInt32() << 32n) | rndBigInt32();
}

export function intNumber(inp: any) {
    return Number(BigInt(inp));
}

export function isBnStr(inp: any) {
    try {
        BigInt(inp)
        return true
    } catch {
        return false
    }
}

export function divUp(val1: bigint, val2: bigint) {
    return val1 / val2 + (val1 % val2 === 0n ? 0n : 1n);
}
export function maxBigint(...inp: bigint[]): bigint {
    return inp.reduce((a, b) => b > a ? b : a);
}

export function isBnArray(inp: Array<bigint> | Array<number>): inp is Array<bigint> {
    return inp.every((val: any) => typeof val === "bigint");
}

export function isBnOrNanoStr(inp: string) {
    try { BigInt(inp); } catch {
        try { toNano(inp); } catch {
            return false;
        }
    }
    return true;
}