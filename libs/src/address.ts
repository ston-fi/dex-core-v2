import { Address, Contract, ExternalAddress, OpenedContract } from "@ton/core";
import { SandboxContract } from "@ton/sandbox";
import { intNumber } from "./number";

export function padRawHexAddress(addressHex: string) {
    return `${'0'.repeat(64)}${addressHex}`.slice(-64);
}

export function rawNumberToAddress(address: string | bigint, workchain = 0) {
    if (typeof address === "string") {
        return Address.parseRaw(`${workchain}:${padRawHexAddress(address)}`);
    } else {
        return Address.parseRaw(`${workchain}:${padRawHexAddress(BigInt(address).toString(16))}`);
    }
}

export function parseAddress(inp: string): Address {
    if (inp.includes(":")) {
        return Address.parseRaw(inp);
    } else {
        return Address.parseFriendly(inp).address;
    }
}
export const HOLE_ADDRESS = /*@__PURE__*/parseAddress("EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c")

export function isHole(addr: Address | null) {
    if (addr === null) {
        return false
    } else {
        return HOLE_ADDRESS.toString() === addr.toString()
    }
}


export type AddressLike = SandboxContract<Contract> | OpenedContract<Contract> | Contract | Address | string

export function strAddress(src: AddressLike): string {
    let strKey = ""
    if (typeof src === "string") {
        try {
            strKey = parseAddress(src).toString()
        } catch {
            throw new Error(`could not parse '${src}' string as address`)
        }
    } else if (Address.isAddress(src)) {
        strKey = src.toString()
    } else {
        strKey = src.address.toString()
    }
    return strKey
}

export function isAddrStr(src: unknown): src is AddressLike {
    try {
        parseAddress(src as string)
        return true
    } catch {
        return false
    }
}

export type ExternalAddressStr = string & { __brand: "ExternalAddress" }
export type ExternalAddressLike = ExternalAddress | ExternalAddressStr

export function isExtAddrLike(src: unknown): src is ExternalAddressLike {
    if (ExternalAddress.isAddress(src)) return true
    if (src === undefined || src === null) return false
    let st = (src as string).toString()
    let bits = st.match(/(?<=^External\<)\d+/)?.[0]
    let value = st.match(/(?<=^External\<\d+\:)\d+(?=\>)/)?.[0]
    if (bits === undefined || bits === "0" || value === undefined) return false
    try {
        new ExternalAddress(BigInt(value), intNumber(bits))
        return true
    } catch {
        return false
    }
}

export function parseExtAddress(src: string) {
    let bits = src.match(/(?<=^External\<)\d+/)?.[0]
    let value = src.match(/(?<=^External\<\d+\:)\d+(?=\>)/)?.[0]
    if (bits === undefined || bits === "0" || value === undefined) throw new Error("cannot parse external address")
    return new ExternalAddress(BigInt(value), intNumber(bits))
}

export class AddressMap<V> extends Map<AddressLike, V> {
    constructor(entries?: readonly (readonly [AddressLike, V])[] | null) {
        if (entries) {
            let newEntries = [...entries]
            let i = 0
            for (let elem of entries) {
                newEntries[i] = [strAddress(elem[0]), elem[1]]
                i++
            }
            super(newEntries);
        } else {
            super(entries);
        }
    }
    get(key: AddressLike): V | undefined {
        return super.get(strAddress(key))
    }
    set(key: AddressLike, value: V): this {
        return super.set(strAddress(key), value)
    }
    has(key: AddressLike): boolean {
        return super.has(strAddress(key))
    }
    delete(key: AddressLike): boolean {
        return super.delete(strAddress(key))
    }
    forEach(callbackfn: (value: V, key: AddressLike, map: Map<AddressLike, V>) => void, thisArg?: any): void {
        return super.forEach(callbackfn, thisArg)
    }
}

let t = new AddressMap()
t.set