import {
    beginCell,
    Builder,
    Cell,
    Dictionary
} from '@ton/core';

import { sha256_sync } from '@ton/crypto';
import fs from 'fs';
import { toSnakeCase } from './utils';

export type JettonContent = {
    uri?: string,
    name?: string,
    description?: string,
    image?: string,
    imageData?: string,
    symbol?: string,
    decimals?: string | number,
};

export type NftContent = {
    uri?: string,
    name?: string,
    description?: string,
    image?: string,
    // imageData expects a path to png file on your machine
    imageData?: string,
    // publicKeys is stored as <key_len><combined_string>, where key_len is UInt16BE
    publicKeys?: string | string[],
};

export function processPublicKeys(publicKeys?: NftContent["publicKeys"]) {
    if (publicKeys) {
        publicKeys = typeof publicKeys === "string" ? [publicKeys] : publicKeys
        let checkLen = publicKeys[0].length
        for (const entry of publicKeys) {
            if (entry.length !== checkLen) {
                throw new Error("public keys must be the same length")
            }
            if (publicKeys.join('').length > 63000) {
                throw new Error("max combined len is 63000")
            }
        }
        return publicKeys
    } else {
        return undefined
    }
}

export function onchainMetadata(params: JettonContent | NftContent) {
    const cellMaxSizeBytes = Math.floor((1023 - 8) / 8);
    const snakePrefix = 0x00;

    const dict: Dictionary<Buffer, Cell> = Dictionary.empty(Dictionary.Keys.Buffer(32), Dictionary.Values.Cell());
    const paramsCast = (params as NftContent)
    paramsCast.publicKeys = processPublicKeys(paramsCast.publicKeys)

    let key: keyof typeof params;
    for (key in params) {
        const entry = params[key]
        if (typeof entry === "undefined") {
            continue;
        }

        let encoding: "ascii" | "utf8";
        if (key === "image") {
            encoding = "ascii";
        } else {
            encoding = "utf8";
        }

        let value = ""
        if ((key as keyof NftContent) === "publicKeys") {
            value = (paramsCast.publicKeys as string[]).join('')
        } else {
            value = entry.toString() as string;
        }

        let bufferToStore: Buffer;
        if (key === "imageData") {
            const file = fs.readFileSync(value);
            bufferToStore = file
        } else if ((key as keyof NftContent) === "publicKeys") {
            const len = (paramsCast.publicKeys as string[])[0].length
            const buffLen = Buffer.alloc(2)
            buffLen.writeUInt16BE(len)
            bufferToStore = Buffer.concat([buffLen, Buffer.from(value, encoding)])
        } else {
            bufferToStore = Buffer.from(value, encoding);
        }
        
        const rootB = beginCell().storeUint(snakePrefix, 8);

        let currentB = rootB;
        let builders: Builder[] = [];
        while (bufferToStore.length > 0) {
            builders.push(currentB);
            currentB.storeBuffer(bufferToStore.subarray(0, cellMaxSizeBytes));
            bufferToStore = bufferToStore.subarray(cellMaxSizeBytes);
            if (bufferToStore.length > 0) {
                currentB = beginCell();
            }
        }

        for (let i = builders.length - 1; i > 0; i--) {
            builders[i - 1].storeRef(builders[i].endCell());
        }
        const finalCell = builders[0].endCell();

        dict.set(sha256_sync(toSnakeCase(key)), finalCell);
    }
    return dict;
}

export function metadataCell(content: string | Dictionary<Buffer, Cell>): Cell {
    let res: Cell;
    if (typeof content === "string") {
        res = beginCell()
            .storeUint(0x01, 8)
            .storeStringTail(content)
            .endCell();
    } else {
        res = beginCell()
            .storeUint(0x00, 8)
            .storeDict(content)
            .endCell();
    }
    return res;
}

export function parseMeta<T extends JettonContent | NftContent>(src: Cell) {
    let res: string | T = ""
    const contentSlice = src.beginParse();
    const contentType = contentSlice.loadUint(8);
    if (contentType === 1) {
        res = contentSlice.loadStringTail();
    } else {
        const keys = [
            "uri",
            "name",
            "description",
            "image",
            "imageData",
            "publicKeys",
            "symbol",
            "decimals",
        ] as const;
        let contentRes: T = {} as T;

        const dict = contentSlice.loadDict(Dictionary.Keys.Buffer(32), Dictionary.Values.Cell());

        for (const key of keys) {
            let val = dict.get(sha256_sync(toSnakeCase(key)));
            if (typeof val === "undefined") {
                continue;
            }

            let encoding: "utf8" | "ascii";
            if (key === "image") {
                encoding = "ascii" as const;
            } else {
                encoding = "utf8" as const;
            }

            let resRead: Buffer = Buffer.from("");
            let sc = val.beginParse();
            if (sc.preloadUint(8) === 0) {
                sc.loadUint(8);
            } else {
                throw new Error("unsupported encoding type")
            }
            while (true) {
                let newData = sc.loadBits(sc.remainingBits);
                resRead = Buffer.concat([resRead, newData.subbuffer(0, newData.length) as Buffer]);
                if (sc.remainingRefs === 0) break;
                sc = sc.loadRef().beginParse();
            }
            if (key === "publicKeys") {
                let keys = []
                let keyLen = resRead.readUInt16BE()
                let keysRaw = resRead.subarray(2).toString(encoding)
                while (keysRaw) {
                    keys.push(keysRaw.slice(0, keyLen))
                    keysRaw = keysRaw.slice(keyLen)
                }
                // @ts-ignore
                contentRes[key] = keys
            } else {
                // @ts-ignore
                contentRes[key] = resRead.toString(encoding);
            }
        }
        res = contentRes;
    }
    return res
}