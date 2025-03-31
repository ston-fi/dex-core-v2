import { Builder, beginCell, Cell, Address, Slice } from "@ton/core";
import { rndBigInt64 } from './number';
import { crc32 } from "./crc32";
import fs from 'fs';
import path from 'path';
import * as color from "./color";

export function beginMessage(op: bigint | number | string): Builder {
    return beginCell()
        .storeUint(typeof op == "string" ? crc32(op) : op, 32)
        .storeUint(rndBigInt64(), 64);
}

export function emptyCell(): Cell {
    return beginCell().endCell();
}

export function stringCell(data: string): Cell {
    return beginCell().storeStringTail(data).endCell();
}

export function codeFromString(code: string): Cell {
    return Cell.fromBoc(Buffer.from(code, 'hex'))[0];
}

export function cellFromStrFile(filePath: string) {
    let strData = fs.readFileSync(filePath, 'utf8');
    return codeFromString(strData);
}

export function cellToBocStr(cell: Cell, filePath = "") {
    let res = cell.toBoc().toString("hex");
    if (filePath) {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, res, "utf-8");
    }
    return res;
}

export function getContractCode(contract: string): Cell {
    let tmp: string;
    try {
        tmp = JSON.parse(fs.readFileSync(`build/${contract}.compiled.json`, 'utf-8')).hex as string;
    } catch {
        let msg = color.colorText(`<bld><r>Error: build data for <b>'${contract}' <r>cannot be found, you need to build it first`);
        throw new Error(msg[0]);
    }
    return codeFromString(tmp);
}

export enum Flags {
    bounce = 0x18,
    noBounce = 0x10,
}

export function createInternalMsgCell(params: {
    to: Address,
    amount: bigint,
    payload?: Cell | Slice,
    stateInit?: Cell,
    flag?: Flags;
}) {

    let msg = beginCell()
        .storeUint(params.flag ?? Flags.bounce, 6)
        .storeAddress(params.to)
        .storeCoins(params.amount)
        .storeUint((params.payload instanceof Cell ? 1 : 0) + (params.stateInit ? 6 : 0), 107 + (params.stateInit ? 1 : 0));

    if (params.stateInit) {
        msg = msg.storeRef(params.stateInit);
    }

    if (typeof params.payload !== "undefined") {
        if (params.payload instanceof Cell) {
            msg = msg.storeRef(params.payload);
        } else {
            msg = msg.storeSlice(params.payload);
        }
    }
    return msg.endCell();
}