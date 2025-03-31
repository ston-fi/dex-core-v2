import { Address, Cell } from '@ton/core';
import { sha256_sync } from '@ton/crypto';
import { BlockchainTransaction, SendMessageResult } from '@ton/sandbox';
import '@ton/test-utils';
import { FlatTransaction, flattenTransaction } from '@ton/test-utils';
import fs from 'fs';
import path from "path";
import { AddressMap, isAddrStr, isExtAddrLike } from './address';
import { fromNanos } from "./balances";
import { stdFtOpCodes, stdNftOpCodes, stonFiDexCodesV1, stonFiDexCodesV2, stonFiFarmCodesV3, stonFiPtonCodesV1, stonFiPtonCodesV2, tvmErrorCodes } from './codes';
import { FlattenableObject, FlattenedValue, flattenObject } from './flatten';
import { prettyNumber } from './formatting';
import { isBnStr } from './number';
import { MdColumn, MdHighlightType, MdTable } from './table';
import { toHexStr, toSnakeCase } from './utils';
import { pTonWalletOpcodesV2 } from './wrappers/PTon';

export function toGraphMap(obj: { [k: string]: number; }): CodesMap {
    // use this to construct opMap or errMap
    let res = new Map<number, string>();
    for (let entry of Object.entries(obj)) {
        res.set(entry[1], toSnakeCase(entry[0]));
    }
    return res;
}

export const defaultCodeMap = toGraphMap({
    ...stdFtOpCodes,
    ...stdNftOpCodes,
    ...tvmErrorCodes,
    ...stonFiPtonCodesV1,
    ...stonFiPtonCodesV2,
    ...stonFiFarmCodesV3,
    ...stonFiDexCodesV1,
    ...stonFiDexCodesV2,
});

export const BracketType = {
    square: (inp: any) => `["${inp.toString()}"]`,
    diamond: (inp: any) => `{"${inp.toString()}"}`,
    fillet: (inp: any) => `("${inp.toString()}")`,
    rounded: (inp: any) => `(["${inp.toString()}"])`,
    circle: (inp: any) => `(("${inp.toString()}"))`,
    circle2: (inp: any) => `((("${inp.toString()}")))`,
    hex: (inp: any) => `{{"${inp.toString()}"}}`,
    sub: (inp: any) => `[["${inp.toString()}"]]`,
    flag: (inp: any) => `>"${inp.toString()}"]`,
    db: (inp: any) => `[("${inp.toString()}")]`,
    parallelR: (inp: any) => `[/"${inp.toString()}"/]`,
    parallelL: (inp: any) => `[\\"${inp.toString()}"\\]`,
    trapezoidT: (inp: any) => `[/"${inp.toString()}"\\]`,
    trapezoidB: (inp: any) => `[\\"${inp.toString()}"/]`,
} as const;


export type CodesMap = Map<number, string>;
export type Captions = { [k: string]: any; };
export type CaptionHandlerParams = {
    body: Cell,
    opMap?: CodesMap,
    errMap?: CodesMap,
    hideOkValues: boolean,
};
export type CaptionHandler = (params: CaptionHandlerParams) => Captions;

export function opEntries(obj: { [k: number]: CaptionHandler; }): [number, CaptionHandler][] {
    // use this to construct captionsMap from object
    return Object.entries(obj).map((val) => {
        let nKey = Number(val[0]);
        if (isNaN(nKey)) throw new Error("only number keys are allowed in this object");
        return [nKey, val[1]];
    });
}

export type FeeData = {
    computeFee?: bigint,
    storageFee?: bigint,
    totalFwdFee?: bigint,
    inForwardFee?: bigint,
    totalActionFee?: bigint,
};
export type FeeDetails = { [K in keyof FeeData]: boolean };
export type FlatTransactionExtended = FlatTransaction & FeeData  & { oldStorage?: Cell, newStorage?: Cell};
export function flattenTransactionExtended(tx: BlockchainTransaction) {
    let txFlat = flattenTransaction(tx);
    let description = tx.description;
    let res: FlatTransactionExtended = {
        ...txFlat
    };

    if (description.type === 'generic' && description.computePhase.type === "vm") {
        res.computeFee = description.computePhase.gasFees;
    }
    if (description.type === 'generic' && description.storagePhase) {
        res.storageFee = description.storagePhase.storageFeesCollected;
    }
    if (description.type === 'generic' && description.actionPhase) {
        res.totalFwdFee = description.actionPhase.totalFwdFees ? description.actionPhase.totalFwdFees : undefined;
        res.totalActionFee = description.actionPhase.totalActionFees ? description.actionPhase.totalActionFees : undefined;
    }
    if (tx.inMessage?.info.type === 'internal') {
        res.inForwardFee = tx.inMessage.info.forwardFee;
    }
    res.oldStorage = tx.oldStorage
    res.newStorage = tx.newStorage
    return res;

}

export const DEFAULT_CAPTION_MAP: Map<number, CaptionHandler> = new Map(/*@__PURE__*/opEntries({
    [stdFtOpCodes.ftInternalTransfer]: (params: CaptionHandlerParams) => {
        // internalTransfer
        let sc = params.body.beginParse();
        sc.loadUintBig(32 + 64);
        let amount = sc.loadCoins();
        return {
            amount: fromNanos(amount)
        };
    },
    [stonFiDexCodesV1.swapDexV1]: (params: CaptionHandlerParams) => {
        // swap
        let sc = params.body.beginParse();
        sc.loadUintBig(32 + 64);
        sc.loadAddress();
        let amount = sc.loadCoins() + sc.loadCoins();
        return {
            amount: fromNanos(amount)
        };
    },
    [stonFiDexCodesV2.swapDexV2]: (params: CaptionHandlerParams) => {
        // swap
        let sc = params.body.beginParse();
        sc.loadUintBig(32 + 64);
        sc.loadAddress();
        let amount = sc.loadCoins() + sc.loadCoins();
        return {
            amount: fromNanos(amount)
        };
    },
    [stdFtOpCodes.ftTransfer]: (params: CaptionHandlerParams) => {
        // transfer
        let res: Captions = {};
        let sc = params.body.beginParse();
        sc.loadUintBig(32 + 64);
        let amount = sc.loadCoins();
        sc.loadMaybeAddress();
        sc.loadMaybeAddress();
        sc.loadUint(1);
        let _fwd = sc.loadCoins();
        if (!params.hideOkValues || _fwd) res.fwdTon = fromNanos(_fwd);
        res.amount = fromNanos(amount);
        try {
            sc.loadUint(1);
            let transferCode = sc.loadUint(32);
            let strCode = params.opMap?.get(transferCode) ?? params.errMap?.get(transferCode);
            res.txCode = `${strCode ?? toHexStr(transferCode)}`;
        } catch { }
        return res;
    },
    [pTonWalletOpcodesV2.tonTransfer]: (params: CaptionHandlerParams) => {
        // ton_transfer
        let res: Captions = {};
        let sc = params.body.beginParse();
        sc.loadUintBig(32 + 64);
        let amount = sc.loadCoins();
        res.amount = fromNanos(amount);
        return res;
    },
    [stonFiDexCodesV1.payToDexV1]: (params: CaptionHandlerParams) => {
        // pay_to
        let res: Captions = {};
        try {
            let sc = params.body.beginParse();
            sc.loadUintBig(32 + 64);
            sc.loadAddress();
            sc.loadAddress();
            let payCode = sc.loadUint(32);
            let strPCode = params.opMap?.get(payCode) ?? toHexStr(payCode);
            res.pay = `${strPCode}`;
        } catch { }
        return res;
    },
    [stonFiDexCodesV2.payToDexV2]: (params: CaptionHandlerParams) => {
        // pay_to
        let res: Captions = {};
        try {
            let sc = params.body.beginParse();
            sc.loadUintBig(32 + 64);
            sc.loadAddress();
            sc.loadAddress();
            sc.loadAddress();
            let payCode = sc.loadUint(32);
            let strPCode = params.opMap?.get(payCode) ?? toHexStr(payCode);
            res.pay = `${strPCode}`;
        } catch { }
        return res;
    },
    [stonFiDexCodesV2.depositRefFeeDexV2]: (params: CaptionHandlerParams) => {
        // deposit_ref_fee
        let res: Captions = {};
        try {
            let sc = params.body.beginParse();
            sc.loadUintBig(32 + 64);
            let amount = sc.loadCoins();
            res.amount = fromNanos(amount);
        } catch { }
        return res;

    },
    [stdFtOpCodes.ftTransferNotification]: (params: CaptionHandlerParams) => {
        // transfer_notification
        let res: Captions = {};
        try {
            let sc = params.body.beginParse();
            sc.loadUintBig(32 + 64);
            let amount = sc.loadCoins();
            res.amount = fromNanos(amount);
            sc.loadAddress();
            let eBit = sc.loadUint(1);
            let fwdOp = 0;
            if (eBit) {
                fwdOp = sc.loadRef().beginParse().loadUint(32);
            } else {
                fwdOp = sc.loadUint(32);
            }
            if (fwdOp) {
                res.fwdOp = `${params.opMap?.get(fwdOp) ?? toHexStr(fwdOp)}`;
            }
        } catch { }
        return res;
    },
}));

export type HashFunction = (src: Buffer | string) => Buffer
export type StorageTableDisplay = "full" | "diff"
export type TableInfoStyle = "simple" | "mermaid"
export type StorageParser = (src: Cell) => FlattenableObject
export type TableColorSettings = {
    nullColor?: string,
    undefColor?: string,
    addrColor?: string,
    numColor?: string,
    strColor?: string,
    diffPlusColor?: string,
    diffMinusColor?: string,
}
export type DirectionType = "unidirectional" | "bidirectional";
export type ChartType = "TB" | "LR" | "BT" | "RL";
export type BracketKeysType = keyof typeof BracketType;
export type GraphArgsType = {
    directionType?: DirectionType,      // default "bidirectional"
    chartType?: ChartType,              // default "TB"
    folder?: string,                    // default "build/graph/"
    addressMap?: AddressMap<string>,
    bracketMap?: AddressMap<BracketKeysType>,
    storageMap?: AddressMap<StorageParser>,
    captionsMap?: Map<number, CaptionHandler>,
    opMap?: CodesMap,
    errMap?: CodesMap,
    hideOkValues?: boolean,                         // default true
    displayIndex?: boolean,                         // default true
    displayOp?: boolean,                            // default true
    displayStorage?: false | StorageTableDisplay,   // default 'diff'
    storageDivider?: string,                        // default ' > '
    displayValue?: boolean,                         // default true
    displayFees?: boolean,                          // default true
    displayDetails?: boolean,                       // default true
    displayExitCode?: boolean,                      // default true
    displayActionResult?: boolean,                  // default true
    displayDeploy?: boolean,                        // default false
    displayDestroyed?: boolean,                     // default true
    displayAborted?: boolean,                       // default true
    displaySuccess?: boolean,                       // default false
    disableStyles?: boolean,                        // default false
    feeDetails?: boolean | FeeDetails,              // default false
    showOrigin?: boolean,                           // default false
    colorForward?: string,                          // default #ff4747
    colorBackward?: string,                         // default #02dbdb
    colorExcess?: string,                           // default #0400f0
    colorTable?: boolean | TableColorSettings,      // default true (uses default in-built values)
    tableInfo?: TableInfoStyle,      // default mermaid
};

/*
    Methods staring with 'mut..' have side-effects on graph state
*/
export class SandboxGraph {
    readonly defaults = {
        folder: "build/graph/",
        hideOkValues: true,
        displayIndex: true,
        displayOp: true,
        displayValue: true,
        displayFees: true,
        displayDetails: true,
        displayExitCode: true,
        displayActionResult: true,
        displayDeploy: false,
        displayDestroyed: true,
        displayAborted: true,
        displaySuccess: false,
        disableStyles: false,
        feeDetails: false,
        showOrigin: false,

        displayStorage: "diff",
        tableInfo: "mermaid",
        chartType: "TB",
        directionType: "bidirectional",

        colorForward: "#ff4747",
        colorBackward: "#02dbdb",
        colorExcess: "#0400f0",
        storageDivider: " > ",

        colorTable: true,
        colorTableColors: {
            nullColor: "#569CD6",
            undefColor: "#569CD6",
            addrColor: "#D656B2",
            numColor: "#B0A104",
            diffPlusColor: "#1DB515",
            diffMinusColor: "#F70B14",
            strColor: "#E700FF",
        } as const,
    } as const;

    private _tableLen: number | null = 48           // separate string chunks with <br>
    private _minDisplayLen = 48     
    private _maxDisplayLen: number | null = 150     // if entry in table bigger - display sha256 instead
    private _hashFunc: HashFunction = sha256_sync
    private _hashFuncLabel = "sha256"
    private _simpleTableArrow = "**--->**"


    get hashFunc() {
        return {
            function: this._hashFunc,
            label: this._hashFuncLabel
        }
    }

    set hashFunc(src: { function: HashFunction, label: string }) {
        this._hashFunc = src.function
        this._hashFuncLabel = this._hashFuncLabel
    }

    get minDisplayLen() {
        return this._minDisplayLen
    }

    get tableLen() {
        return this._tableLen
    }

    set tableLen(len: number | null) {
        this.checkLengthValue(len, MdTable.prototype.minLineLen)
        this._tableLen = len
    }

    get maxDisplayLen() {
        return this._maxDisplayLen
    }

    set maxDisplayLen(len: number | null) {
        this.checkLengthValue(len, this._minDisplayLen)
        this._maxDisplayLen = len
    }

    private params;
    private links: string = "";
    private names: string = "";
    private styles: string = "";
    private tables: string = "";
    private actors: number = 0;
    private internalMap: Map<string, string> = new Map();

    private checkLengthValue(len: number | null, min: number) {
        if (len?.toString().includes(".")) {
            throw new Error("only whole numbers allowed")
        }
        if (len !== null && len < min) {
            throw new Error(`min len is ${min}`)
        }
    }

    private reset() {
        this.links = "";
        this.names = "";
        this.styles = "";
        this.tables = "";
        this.actors = 0;
        this.internalMap = new Map();
    }

    constructor(params?: GraphArgsType) {
        this.reset()
        this.params = {
            ...params,
            folder: params?.folder ?? this.defaults.folder,
            hideOkValues: params?.hideOkValues ?? this.defaults.hideOkValues,
            displayIndex: params?.displayIndex ?? this.defaults.displayIndex,
            displayOp: params?.displayOp ?? this.defaults.displayOp,
            displayStorage: params?.displayStorage ?? this.defaults.displayStorage,
            displayValue: params?.displayValue ?? this.defaults.displayValue,
            displayFees: params?.displayFees ?? this.defaults.displayFees,
            displayDetails: params?.displayDetails ?? this.defaults.displayDetails,
            displayExitCode: params?.displayExitCode ?? this.defaults.displayExitCode,
            displayActionResult: params?.displayActionResult ?? this.defaults.displayActionResult,
            displayDeploy: params?.displayDeploy ?? this.defaults.displayDeploy,
            displayDestroyed: params?.displayDestroyed ?? this.defaults.displayDestroyed,
            displayAborted: params?.displayAborted ?? this.defaults.displayAborted,
            displaySuccess: params?.displaySuccess ?? this.defaults.displaySuccess,
            disableStyles: params?.disableStyles ?? this.defaults.disableStyles,
            feeDetails: params?.feeDetails ?? this.defaults.feeDetails,
            colorForward: params?.colorForward ?? this.defaults.colorForward,
            colorBackward: params?.colorBackward ?? this.defaults.colorBackward,
            colorExcess: params?.colorExcess ?? this.defaults.colorExcess,
            chartType: params?.chartType ?? this.defaults.chartType,
            showOrigin: params?.showOrigin ?? this.defaults.showOrigin,
            directionType: params?.directionType ?? this.defaults.directionType,
            storageDivider: params?.storageDivider ?? this.defaults.storageDivider,
            tableInfo: params?.tableInfo ?? this.defaults.tableInfo,
            captionsMap: params?.captionsMap ? new Map([...DEFAULT_CAPTION_MAP, ...params.captionsMap]) : DEFAULT_CAPTION_MAP,
            storageMap: params?.storageMap ?? new AddressMap<StorageParser>(),
            colorTable: this.getColorTable(params?.colorTable ?? this.defaults.colorTable)
        };
    }

    private getColorTable(src: boolean | TableColorSettings | undefined): false | TableColorSettings {
        let colorTable: false | TableColorSettings = false
        if (src) {
            if (typeof src === "boolean") {
                colorTable = this.defaults.colorTableColors
            } else {
                colorTable = {
                    nullColor: src.nullColor ?? this.defaults.colorTableColors.nullColor,
                    undefColor: src.undefColor ?? this.defaults.colorTableColors.undefColor,
                    addrColor: src.addrColor ?? this.defaults.colorTableColors.addrColor,
                    numColor: src.numColor ?? this.defaults.colorTableColors.numColor,
                    strColor: src.strColor ?? this.defaults.colorTableColors.strColor,
                    diffPlusColor: src.diffPlusColor ?? this.defaults.colorTableColors.diffPlusColor,
                    diffMinusColor: src.diffMinusColor ?? this.defaults.colorTableColors.diffMinusColor,
                }
            }
        }
        return colorTable
    }

    private flattenDisplayLabel(src: string) {
        // replaces <br/>, <br> and \n with whitespace
        return src.split(/\<br\/\>|\n|\<br\>/).join(" ")
    }

    private getErrorCode(params: typeof this.params, code: number) {
        return params.errMap?.get(code) ?? code;
    }

    private getOpCode(params: typeof this.params, op: number) {
        return params.opMap?.get(op) ?? toHexStr(op);
    }

    private getDisplayKey(params: typeof this.params, src: string | Address) {
        return params.addressMap?.get(src.toString()) ?? src.toString();
    }

    private getBracketKey(params: typeof this.params, key: string) {
        return params.bracketMap?.get(key.toString());
    }

    private getEntryIndex(key: string) {
        // from str "A..."
        return Number(key.slice(1));
    };

    private getEntryString(info: string[], from: string, to: string, arrow: string) {
        // new link entry to mermaid graph
        let label = info.join("<br/>");
        return `\t${from} ${arrow} |${label}|${to}\n`;
    };

    private mutGetNameFromMap(params: typeof this.params, address: Address | -1, isTo = false) {
        // returns internal name for entry and adds it into internal name map if new
        const addrStr = address.toString();
        if (
            !this.internalMap.has(addrStr) || 
            (isTo && params.directionType === "unidirectional")
        ) {
            const index = this.actors;
            this.actors++;
            this.internalMap.set(addrStr, `A${index}`);
            this.mutAddName(params, address, index);
        }
        return this.internalMap.get(addrStr) as string;
    };

    private mutAddLink(link: string) {
        this.links += `${link}`;
    }

    private getStyleString(ind: number, color: string) {
        // color links in mermaid graph
        return `\tlinkStyle ${ind} stroke:${color},color:${color}\n`;
    };

    private mutAddStyle(ind: number, color: string) {
        this.styles += this.getStyleString(ind, color)
    };

    private getNameString(params: typeof this.params, address: Address | -1, index: number) {
        // returns name entry for mermaid graph
        let displayKey: string;
        if (address !== -1) {
            displayKey = this.getDisplayKey(params, address);
        } else {
            displayKey = "external";
        }
        let bracketKey: keyof typeof BracketType = this.getBracketKey(params, address.toString()) ?? "square";
        return `\tA${index}${BracketType[bracketKey](displayKey)}\n`;
    };

    private mutAddName(params: typeof this.params, address: Address | -1, index: number) {
        this.names += this.getNameString(params, address, index);
    };

    private strWrap(src: FlattenedValue): string {
        // substitute some values in md tables
        if (src === undefined) return "undef"
        if (src === null) return "null"
        return src.toString()
    }

    private compileStorageDifference(params: typeof this.params, oldStorage: ReturnType<StorageParser>, newStorage: ReturnType<StorageParser>) {
        // compares two storages and compiles an object with difference
        const flatOld = flattenObject(oldStorage, params.storageDivider)
        const flatNew = flattenObject(newStorage, params.storageDivider)
        let result: { [k: string]: [string, string, string] } = {}
        for (let key of Object.keys({...flatOld, ...flatNew})) {
            const oldVal = flatOld[key]
            const newVal = flatNew[key]
            if (!(oldVal !== newVal || params.displayStorage === "full")) continue

            let diff: number | bigint | string = "-"
            if (typeof oldVal === "bigint" && typeof newVal === "bigint") diff = newVal - oldVal
            if (typeof oldVal === "number" && typeof newVal === "number") diff = newVal - oldVal
            if (typeof diff === "bigint" && (diff) > 0n) diff = `+${diff}`
            if (typeof diff === "number" && (diff) > 0) diff = `+${diff}`
            result[key] = [this.strWrap(oldVal), this.strWrap(newVal), this.strWrap(diff)]
        }
        return result
    }

    private replaceAddressFromMap(params: typeof this.params, src: string) {
        // substitutes addr from address map if it is present, unchanged otherwise
        return isAddrStr(src) ? this.flattenDisplayLabel(this.getDisplayKey(params, src)) : src
    }

    private codeWrap(params: typeof this.params, src: string) {
        // wraps keys in unwrapped object in code symbols separating each token by divider
        return src.split(params.storageDivider).map((val) => { return `\`${this.replaceAddressFromMap(params, val)}\`` }).join(params.storageDivider) 
    }

    private styleWrap(params: typeof this.params, src: string, special?: "diff") {
        // add coloring and style to md table entry
        let color: string | undefined = undefined
        let highlight: MdHighlightType = null
        if (params.colorTable) {
            if (typeof params.colorTable === "boolean") {
                throw new Error("need full color object")
            }
            if (special === "diff") {
                color = src.includes("+") 
                    ? params.colorTable.diffPlusColor 
                    : src.length > 1
                        ? params.colorTable.diffMinusColor
                        : undefined
                let sign = src.includes("+") ? "+" : ""
                if (color) {
                    src = isBnStr(src) ? sign + prettyNumber(BigInt(src)) : sign + prettyNumber(Number(src))
                }
            } else if (src === "null") {
                color = params.colorTable.nullColor
                highlight = "bold"
            } else if (src === "undef") {
                color = params.colorTable.undefColor
                highlight = "bold"
            } else if (!isNaN(Number(src)) || isBnStr(src)) {
                color = params.colorTable.numColor
                src = isBnStr(src) ? prettyNumber(BigInt(src)) : prettyNumber(Number(src))
            } else if (isAddrStr(src)) {
                src = this.replaceAddressFromMap(params, src)
                color = params.colorTable.addrColor
            } else if (isExtAddrLike(src)) {
                src = (src as string).toString()
                color = params.colorTable.addrColor
            }else {
                color = params.colorTable.strColor
            }

        }
        return {
            text: src,
            color: color,
            highlight: highlight
        } satisfies MdColumn
    }

    private maybeReplaceWithHash(src: string) {
        // replace long entries in md table with their hash value
        return  this.maxDisplayLen && src.length > this.maxDisplayLen ? `${this._hashFuncLabel}: ${this._hashFunc(src).toString("hex")}` : src
    }

    private getDifferenceTable(params: typeof this.params, src: ReturnType<typeof this.compileStorageDifference>) {
        // compile md table from storage difference object
        let table = new MdTable("Name", "Before", "After", "Diff")
        table.lineLen = this._tableLen
        for (let el of Object.keys(src)) {
            let val1 = this.styleWrap(params, this.maybeReplaceWithHash(src[el][0]))
            let val2 = this.styleWrap(params, this.maybeReplaceWithHash(src[el][1]))
            let val3 = this.styleWrap(params, src[el][2], "diff")
            table.addEntry({
                text: this.codeWrap(params, el),
                splitLength: null
            }, val1, val2, val3)
        }
        return table
    }

    private mutCreateLink(params: typeof this.params, tx: FlatTransactionExtended, ind: number) {
        // process transaction to create mermaid graph & md table
        let from = this.mutGetNameFromMap(params, tx.from ?? -1);
        let to = this.mutGetNameFromMap(params, tx.to as Address, true);

        let arrow = this.getEntryIndex(from) <= this.getEntryIndex(to) ? "-->" : "-.->";
        let color = this.getEntryIndex(from) <= this.getEntryIndex(to) ? params.colorForward : params.colorBackward;

        let txInfo: string[] = [];
        const addInfo = (label: string, data: any) => { txInfo.push(`${label}: ${data}`); };
        // ------------------------------
        if (params.displayIndex) { addInfo("index", ind); }
        // ------------------------------
        if (params.displayValue && typeof tx.value !== "undefined") { addInfo("value", fromNanos(tx.value)); }
        // ------------------------------
        if (params.displayFees && typeof tx.totalFees !== "undefined") {
            if (params.feeDetails) {
                let fees = {
                    computeFee: tx.computeFee,
                    storageFee: tx.storageFee,
                    totalFwdFee: tx.totalFwdFee,
                    inForwardFee: tx.inForwardFee,
                    totalActionFee: tx.totalActionFee,
                };
                if (typeof params.feeDetails !== "boolean") {
                    fees = {
                        computeFee: params.feeDetails.computeFee ? tx.computeFee : undefined,
                        storageFee: params.feeDetails.storageFee ? tx.storageFee : undefined,
                        totalFwdFee: params.feeDetails.totalFwdFee ? tx.totalFwdFee : undefined,
                        inForwardFee: params.feeDetails.inForwardFee ? tx.inForwardFee : undefined,
                        totalActionFee: params.feeDetails.totalActionFee ? tx.totalActionFee : undefined,
                    };
                }
                addInfo("totalFee", fromNanos(tx.totalFees));
                if (fees.computeFee) addInfo("computeFee", fromNanos(fees.computeFee));
                if (fees.storageFee) addInfo("storageFee", fromNanos(fees.storageFee));
                if (fees.totalFwdFee) addInfo("totalFwdFee", fromNanos(fees.totalFwdFee));
                if (fees.inForwardFee) addInfo("inForwardFee", fromNanos(fees.inForwardFee));
                if (fees.totalActionFee) addInfo("totalActionFee", fromNanos(fees.totalActionFee));
            } else {
                addInfo("fees", fromNanos(tx.totalFees));
            }
        }
        // ------------------------------
        if (params.displayOp && typeof tx.op !== "undefined") {
            addInfo("op", this.getOpCode(params, tx.op));
            color = tx.op === 0xd53276db ? params.colorExcess : color;
        }
        // ------------------------------
        if (
            params.displayDetails
            && typeof tx.op !== "undefined"
            && typeof tx.body !== "undefined"
        ) {
            let handler = params.captionsMap.get(tx.op);
            if (handler) {
                try {
                    let captions = handler({
                        body: tx.body,
                        opMap: params.opMap,
                        errMap: params.errMap,
                        hideOkValues: params.hideOkValues
                    });
                    for (let key in captions) {
                        addInfo(key, captions[key]);
                    }
                } catch { }
            }
        }
        // ------------------------------
        if (
            params.displayExitCode
            && typeof tx.exitCode !== "undefined"
            && (!params.hideOkValues || tx.exitCode)
        ) { addInfo("exit", this.getErrorCode(params, tx.exitCode)); }
        // ------------------------------
        if (
            params.displayActionResult
            && typeof tx.actionResultCode !== "undefined"
            && (!params.hideOkValues || tx.actionResultCode)
        ) { addInfo("action", this.getErrorCode(params, tx.actionResultCode)); }
        // ------------------------------
        if (
            params.displayDeploy
            && (!params.hideOkValues || tx.deploy)
        ) { addInfo("deploy", tx.deploy); }
        // ------------------------------
        if (
            params.displayAborted
            && typeof tx.aborted !== "undefined"
            && (!params.hideOkValues || tx.aborted)
        ) { addInfo("abort", tx.aborted); }
        // ------------------------------
        if (
            params.displayDestroyed
            && typeof tx.destroyed !== "undefined"
            && (!params.hideOkValues || tx.destroyed)
        ) { addInfo("destroy", tx.destroyed); }
        // ------------------------------
        if (
            params.displaySuccess
            && typeof tx.success !== "undefined"
            && (!params.hideOkValues || tx.success)
        ) { addInfo("success", tx.success); }
        // ------------------------------
        if (
            params.displayStorage
            && (typeof tx.oldStorage !== "undefined" || typeof tx.newStorage !== "undefined")
            && typeof tx.from !== "undefined"
            && typeof tx.to !== "undefined"
        ) { 
            let parser = params.storageMap.get(tx.to.toString())
            if (parser) {
                let data = {
                    index: ind,
                    tx: tx,
                    color: color,
                    arrow: arrow,
                    txInfo: txInfo,
                    from: from,
                    to: to,
                }
                const [oldData, newData] = this.parseStorages(parser, tx.oldStorage, tx.newStorage)
                let compiledData = this.compileStorageDifference(params, oldData, newData)
                this.mutAddTable(params, data, this.getDifferenceTable(params, compiledData))
            }
        }
        // ------------------------------
        this.mutAddStyle(ind, color);
        this.mutAddLink(this.getEntryString(txInfo, from, to, arrow));
    };
    
    private mutAddTable<K extends MdColumn[]>(params: typeof this.params, data: { from: string, to: string, index: number, tx: FlatTransactionExtended, color: string, arrow: string, txInfo: string[]}, table: MdTable<K>) {
        let info: string = ""
        if (params.tableInfo === "simple") {
            info = `\`${this.flattenDisplayLabel(this.getDisplayKey(params, (data.tx.from as Address)))}\` ${this._simpleTableArrow} \`${this.flattenDisplayLabel(this.getDisplayKey(params, (data.tx.to as Address)))}\``
        } else if (params.tableInfo === "mermaid") {
            let indFrom = this.getEntryIndex(data.from)
            let indTo = this.getEntryIndex(data.to)
            let name1 = this.getNameString(params, data.tx.from ?? -1, indFrom)
            let name2 = this.getNameString(params, data.tx.to as Address, indTo)
            info = this.getMermaidGraph(
                "LR", 
                name1 + name2, 
                this.getEntryString(data.txInfo, data.from, data.to, data.arrow), 
                this.getStyleString(0, data.color)
            )
        }

        table.setTitle({
            text: `Index: ${data.index}`,
            level: 2
        }, info)
        this.tables += table.render() + "\n"
    }

    private parseStorages(parser: StorageParser, oldStorage?: Cell, newStorage?: Cell) {
        // parses before and after storage, substitutes missing keys from one of another as undefined
        let oldData: ReturnType<StorageParser> = {}
        let newData: ReturnType<StorageParser> = {}
        if (oldStorage) {
            oldData = parser(oldStorage)
        }
        if (newStorage) {
            newData = parser(newStorage)
        }
        if (oldStorage && !newStorage) {
            for (let el in Object.keys(oldStorage)) {
                newData[el] = undefined
            }
        }
        if (newStorage && !oldStorage) {
            for (let el in Object.keys(newStorage)) {
                oldData[el] = undefined
            }
        }
        return [oldData, newData]
    }

    private getMermaidGraph(type: ChartType, names: string | string[], links: string | string[], styles: string | string[]) {
        const unify = (src: string | string[]) => { return typeof src === "string" ? src : src.join("\n") }
        return "```mermaid\nflowchart " + `${type}\n`
            + unify(names) + "\n"
            + unify(links) + "\n"
            + unify(styles)
            + "\n```" 
            + "\n"
    }

    private compile(params: typeof this.params) {
        let tableDisplayMode = params.displayStorage === "diff" ? "difference" : "full"
        let tables = ""

        if (this.tables !== "") {
            tables = `# Storage Tables (${tableDisplayMode})\n\n` + this.tables
        }
        return this.getMermaidGraph(params.chartType, this.names, this.links, params.disableStyles ? "" : this.styles)
            + tables;
    }

    render(msgResult: SendMessageResult, name: string | null, overrides?: GraphArgsType) {
        // null suppresses output to file
        this.reset()

        const params = {
            ...this.params,
            ...overrides,
            colorTable: this.getColorTable(overrides?.colorTable ?? this.defaults.colorTable),
            captionsMap: overrides?.captionsMap ? new Map([...this.params.captionsMap, ...overrides.captionsMap]) : this.params.captionsMap,
            storageMap: overrides?.storageMap ? new AddressMap([...this.params.storageMap, ...overrides.storageMap]) : this.params.storageMap,
        };
        
        let cnt = 0;
        for (const tx of msgResult.transactions) {
            let txFlat = flattenTransactionExtended(tx);
            if (typeof txFlat.from === "undefined" && !params.showOrigin) continue;
            this.mutCreateLink(params, txFlat, cnt);
            cnt++;
        }
        let graph = this.compile(params)
        if (name !== null) {
            const outFile = path.join(params.folder, `${name}.md`)
            fs.mkdirSync(path.dirname(outFile), { recursive: true });
            fs.writeFileSync(outFile, graph, "utf-8");
        }
        return graph
    }

}


/**
 * @deprecated use SandboxGraph instead
 */
export function createMdGraph(params: {
    msgResult: SendMessageResult,
    directionType?: DirectionType, // default "bidirectional"
    chartType?: ChartType, // default TB
    output?: string,                // default "build/graph.md"
    addressMap?: Map<string, string> | AddressMap<string>,
    bracketMap?: Map<string, BracketKeysType> | AddressMap<BracketKeysType>,
    captionsMap?: Map<number, CaptionHandler>,
    opMap?: CodesMap,
    errMap?: CodesMap,
    hideOkValues?: boolean,         // default true
    displayIndex?: boolean,         // default true
    displayOp?: boolean,            // default true
    displayValue?: boolean,         // default true
    displayFees?: boolean,          // default true
    displayTokens?: boolean,        // default true
    displayExitCode?: boolean,      // default true
    displayActionResult?: boolean,  // default true
    displayDeploy?: boolean,        // default false
    displayDestroyed?: boolean,     // default true
    displayAborted?: boolean,       // default true
    displaySuccess?: boolean,       // default false
    disableStyles?: boolean,        // default false
    feeDetails?: boolean | FeeDetails,  // default false
    showOrigin?: boolean,           // default false
    colorForward?: string,          // default #ff4747
    colorBackward?: string,         // default #02dbdb
    colorExcess?: string,           // default #0400f0
    storageDivider?: string,        // default ' > ',
    colorTable?: boolean | TableColorSettings,        // default false (true val uses default in-built values)
    storageMap?: Map<string, StorageParser> | AddressMap<StorageParser>,
    displayStorage?: false | StorageTableDisplay,  // default true,
    tableInfo?: TableInfoStyle,      // default mermaid
}) {
    const filename = params.output ?? "build/graph.md"
    const folder = path.dirname(filename)
    const base = path.basename(filename, ".md")
    
    const graph = new SandboxGraph({
        ...params,
        folder: folder,
        displayDetails: params.displayTokens
    })
    graph.render(params.msgResult, base)
}

