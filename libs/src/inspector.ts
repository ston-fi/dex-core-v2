import { DictionaryValue, Slice, Cell, Dictionary, beginCell } from "@ton/core";
import { calculateCrc16 } from "./crc16";

export function createSliceValue(): DictionaryValue<Slice> {
    return {
        serialize: (src, builder) => {
            builder.storeSlice(src);
        },
        parse: (src) => {
            return src;
        }
    };
}

export class ContractInspector {
    public methodsMapDecompiled = new Map<number, Slice>();

    constructor(code: Cell) {
        const slice = code.beginParse();

        const header = slice.loadUint(16);
        if (header !== 0xff00)
            throw new Error('unsupported codepage');

        slice.loadUint(14); // skip ops & dictjmp
        const keyLen = slice.loadUint(10);
        const methodsMap = slice.loadDict(Dictionary.Keys.Int(keyLen), createSliceValue());

        for (let [key, cs] of methodsMap) {
            this.methodsMapDecompiled.set(key, cs);
        }
    }

    public loadMethod(functionSelector: string | number) {
        let searchedId = 0;
        if ((functionSelector == "main") || (functionSelector == "recv_internal")) {
            searchedId = 0;
        } else if (functionSelector == "recv_external") {
            searchedId = -1;
        } else if (functionSelector == "run_ticktock") {
            searchedId = -2;
        } else {
            if (typeof functionSelector === "string")
                searchedId = (calculateCrc16(new TextEncoder().encode(functionSelector)) & 0xffff) | 0x10000;
            else
                searchedId = functionSelector;
        }

        return this.methodsMapDecompiled.get(searchedId);
    }

    public loadMethodCell(functionSelector: string | number) {
        let methodSlice = this.loadMethod(functionSelector)
        if (methodSlice === undefined) {
            return undefined
        }
        return beginCell().storeSlice(methodSlice).endCell()
    }
}