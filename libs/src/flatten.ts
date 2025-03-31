import { Address, Cell } from "@ton/core";
import { ExternalAddressLike, isExtAddrLike } from "./address";
import { cellToBocStr } from "./cell";

export type FlattenableMapKey = string | number | bigint | Address | ExternalAddressLike 
export type FlattenableValue = boolean | string | number | bigint | Address | ExternalAddressLike | Cell | Array<FlattenableValue> | FlattenableObject | Map<FlattenableMapKey, FlattenableValue> | null | undefined 
export type FlattenableObject = { [k: string]: FlattenableValue }

export type FlattenedValue = boolean | string | number | bigint | null | undefined
export type FlattenedObject = { [k: string]: FlattenedValue }

function mergePrefix(old: string | undefined, src: string | number | bigint | Address | ExternalAddressLike, divider: string) {
    return old ? `${old}${divider}${src}` : src.toString()
}

export function flattenArray(src: Array<FlattenableValue>, divider: string, prefix?: string): FlattenableObject {
    let flattened: FlattenableObject = {}
    
    for (let i = 0; i < src.length; i++) {
        let keyWithPrefix = mergePrefix(prefix, i, divider)
        let val = flattenValue(src[i], divider, keyWithPrefix)

        if (typeof val === "object" && val !== null) {
            flattened = {...flattened, ...val as FlattenableObject}
        } else {
            flattened[keyWithPrefix] = val
        }
    }
    return flattened
}

export function flattenMap(src: Map<FlattenableMapKey, FlattenableValue>, divider: string, prefix?: string): FlattenableObject {
    let unwrapped: FlattenableObject = {}
    for (let el of src) {
        let mKey = mergePrefix(prefix, el[0], divider)
        let mVal = el[1]
        if (Array.isArray(mVal)) {
            mVal = flattenArray(mVal, divider, mKey)
        } else if (Address.isAddress(mVal) || isExtAddrLike(mVal)) {
            mVal = mVal.toString()
        } else if (mVal instanceof Map) {
            mVal = flattenMap(mVal, divider, mKey)
        } else if (mVal instanceof Cell) {
            mVal = cellToBocStr(mVal)
        } else if (mVal instanceof Object) {
            mVal = flattenObject(mVal, divider, mKey)
        } 

        if (typeof mVal === "object" && mVal !== null) {
            unwrapped = {...unwrapped, ...mVal as FlattenableObject}
        } else {
            unwrapped[mKey] = mVal
        }
    }
    return unwrapped
}

export function flattenValue(src: FlattenableValue, divider: string, prefix?: string): FlattenableObject | FlattenedValue {
    let flattened: FlattenableObject | FlattenedValue 
    if (Address.isAddress(src) || isExtAddrLike(src)) {
        flattened = src.toString()
    } else if (Array.isArray(src)) {
        flattened = flattenArray(src, divider, prefix)
    } else if (src instanceof Map) {
        flattened = flattenMap(src, divider, prefix)
    } else if (src instanceof Cell) {
        flattened = cellToBocStr(src)
    } else if (src instanceof Object) {
        flattened = flattenObject(src, divider, prefix)
    } else {
        flattened = src
    }
    return flattened
}

export function flattenObject(src: FlattenableObject, divider: string, prefix?: string) {
    let flattened: FlattenableObject = {}
    for (let key of Object.keys(src)) {
        let keyWithPrefix = mergePrefix(prefix, key, divider)
        let val = flattenValue(src[key], divider, keyWithPrefix)
        
        if (typeof val === "object" && val !== null) {
            flattened = {...flattened, ...val as FlattenableObject}
        } else {
            flattened[keyWithPrefix] = val
        }
    }
    return flattened as FlattenedObject
}