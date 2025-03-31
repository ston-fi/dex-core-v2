import { NetworkProvider } from "@ton/blueprint";
import { Address, Cell, OpenedContract } from "@ton/core";
import { SandboxContract, SendMessageResult } from "@ton/sandbox";
import fs from "fs";
import path from 'path';
import { AddressMap, AsyncReturnType, CliConfig, ElementType, HOLE_ADDRESS, StorageParser, cellToBocStr, createMdGraph, fetchJettonData, jMinterOpcodes, jWalletOpcodes, nftMinterOpcodes, nftOpcodes, parseErrors, parseOp, parseTokenAddress, parseVersion, preprocBuildContracts, resolvers, stdFtOpCodes, stdNftOpCodes, toGraphMap, toHexStr, tvmErrorCodes } from "../libs";
import { BracketKeysType, CaptionHandler, CaptionHandlerParams, Captions, opEntries } from "../libs/src/graph";
import { LPAccount } from "../wrappers/LPAccount";
import { PoolBase, PoolCPI, PoolCSI, PoolCWSI, PoolStable, PoolWCPI } from "../wrappers/Pool";
import { routerOpcodes } from "../wrappers/Router";

export function dumpRawCells(src: Record<string, Cell>, filepath: string, encoding: "hex" | "base64" = "hex") {
    let cd: Record<string, string> = {}
    let item: keyof typeof src
    for (item in src) {
        cd[item] = src[item].toBoc().toString(encoding)
    }
    fs.mkdirSync(path.dirname(filepath), { recursive: true });
    fs.writeFileSync(filepath, JSON.stringify(cd, null, 4), "utf-8");
}

export function parseAddressArg(src: string, provider?: NetworkProvider) {
    if (src === "self" && provider) {
        return provider.sender().address as Address
    } else if (src === "hole") {
        return HOLE_ADDRESS
    }
    return parseTokenAddress(src)
}

export function getIdColor(id: number) {
    return id === 0 ? "<y>" : "<m>"
}

export type PoolDataAny = AsyncReturnType<PoolCPI["getPoolData"]> | AsyncReturnType<PoolCSI["getPoolData"]> | AsyncReturnType<PoolWCPI["getPoolData"]> | AsyncReturnType<PoolCWSI["getPoolData"]> | AsyncReturnType<PoolStable["getPoolData"]>

export const POOL_TYPES = [
    "weighted_const_product",
    "weighted_stableswap",
    "constant_product",
    "constant_sum",
    "stableswap"
] as const

export const FEE_DIVIDER = 10000

export const DefaultValues = {
    DEFAULT_MSG_VALUE: 1000000000n
};

export const ONE_DEC = 1_000000000_000000000n

export function isPton(data: AsyncReturnType<typeof fetchJettonData>) {
    return data.symbol?.toLowerCase() === "pton"
}

export async function getLpAccDataNoFail(lpAcc: SandboxContract<LPAccount>) {
    let res = {
        userAddress: HOLE_ADDRESS,
        poolAddress: HOLE_ADDRESS,
        leftAmount: 0n,
        rightAmount: 0n,
    }
    try {
        res = await lpAcc.getLPAccountData()
    } catch { }
    return res
}


export function preprocBuildContractsLocal(opts: {
    dexType: ElementType<typeof POOL_TYPES>,
    defaultIsLocked: Number | null,
    defaultLPFee: Number | null,
    defaultProtocolFee: Number | null,
    autocleanup?: boolean,
}): void {
    process.env.DEX_TYPE = opts.dexType
    preprocBuildContracts({
        autocleanup: opts.autocleanup,
        data: {
            dexType: opts.dexType,
            defaultIsLocked: opts.defaultIsLocked == null ? "0" : "1",
            defaultLPFee: opts.defaultLPFee == null ? "20" : opts.defaultLPFee,
            defaultProtocolFee: opts.defaultProtocolFee == null ? "10" : opts.defaultProtocolFee,
            version: parseVersion(),
            renderRouterAdminExtCalls: fs.existsSync(`contracts/router/pools/${opts.dexType}/ext_admin.fc`),
            renderPoolExtRouterCalls: fs.existsSync(`contracts/pool/pools/${opts.dexType}/ext_router.fc`),
            renderSetterCalls: fs.existsSync(`contracts/pool/pools/${opts.dexType}/setter.fc`),
        }
    })
}

export async function getCastedPool(provider: NetworkProvider, pool: OpenedContract<PoolBase>, typeOverride?: string) {
    let dexType =  typeOverride ?? await pool.getPoolType()
    let newPool
    switch (dexType) {
        case "constant_product":
            newPool = provider.open(PoolCPI.createFromAddress(pool.address))
            break
        case "constant_sum":
            newPool = provider.open(PoolCSI.createFromAddress(pool.address))
            break
        case "weighted_const_product":
            newPool = provider.open(PoolWCPI.createFromAddress(pool.address))
            break
        case "weighted_stableswap":
            newPool = provider.open(PoolCWSI.createFromAddress(pool.address))
            break
        case "stableswap":
            newPool = provider.open(PoolStable.createFromAddress(pool.address))
            break
        default:
            throw new Error("Unsupported pool type")
    }
    return {
        pool: newPool,
        type: dexType
    }
}

export type GraphParams = {
    msgResult: SendMessageResult,
    chartType?: "TB" | "LR" | "BT" | "RL", // default TB
    output: string,
    folderPath: string,
    addressMap?: AddressMap<string>,
    bracketMap?: AddressMap<BracketKeysType>,
    hideOkValues?: boolean,
    displayValue?: boolean,
    displayTokens?: boolean,
    displayExitCode?: boolean,
    displayFees?: boolean,
    displayActionResult?: boolean,
    displayDeploy?: boolean,
    displayAborted?: boolean,
    displayDestroyed?: boolean,
    displaySuccess?: boolean,
    disableStyles?: boolean,
    storageMap?: AddressMap<StorageParser>
}

export type GraphParamsWithoutPath = Omit<GraphParams, "folderPath">
// let codes = {}
export function createMdGraphLocal(params: GraphParams) {
    // @ts-ignore
    if (typeof createMdGraphLocal.opMap == 'undefined') {
        // @ts-ignore
        createMdGraphLocal.opMap = toGraphMap({
            ...nftMinterOpcodes,
            ...stdFtOpCodes,
            ...stdNftOpCodes,
            ...nftOpcodes,
            ...jWalletOpcodes,
            ...jMinterOpcodes,
            ...parseOp("contracts/common/op.fc")
        });
    }
    // @ts-ignore
    if (typeof createMdGraphLocal.errorMap == 'undefined') {
        // @ts-ignore
        createMdGraphLocal.errorMap = toGraphMap({
            ...tvmErrorCodes,
            ...parseErrors("contracts/common/errors.fc")
        });
    }
    
    // @ts-ignore
    // (createMdGraphLocal.opMap as Map<number, string>).forEach((value, key) => {
    //     // @ts-ignore
    //     codes[value] = toHexStr(key)
    // })
    // console.log(codes)

    const details = true

    const captionMap: Map<number, CaptionHandler> = new Map(opEntries({
        [routerOpcodes.payTo]: (params: CaptionHandlerParams) => {
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
        }
    }))
    
    createMdGraph({
        chartType: params.chartType ?? "TB",
        hideOkValues: params.hideOkValues ?? true,
        displayValue: params.displayValue ?? details,
        displayTokens: params.displayTokens ?? details,
        displayExitCode: params.displayExitCode ?? details,
        displayFees: params.displayFees ?? details,
        displayActionResult: params.displayActionResult ?? details,
        displayAborted: params.displayAborted ?? details,
        displayDeploy: params.displayDeploy ?? true,
        displayDestroyed: params.displayDestroyed ?? true,
        displaySuccess: params.displaySuccess ?? false,
        disableStyles: params.disableStyles ?? false,
        msgResult: params.msgResult,
        storageMap: params.storageMap,
        output: `${params.folderPath}${params.output}.md`,
        addressMap: params.addressMap,
        bracketMap: params.bracketMap,
        captionsMap: captionMap,
        tableInfo: "mermaid",
        // @ts-ignore
        opMap: createMdGraphLocal.opMap,
        // @ts-ignore
        errMap: createMdGraphLocal.errorMap,
    });
}

export type PoolType = ElementType<typeof POOL_TYPES>

const resolvePool = (inp: string | undefined): PoolType | null => {
    const tps = [...POOL_TYPES] as string[]
    if (typeof inp === "undefined") {
        return null;
    } else if (tps.includes(inp)) {
        return inp as PoolType
    } else {
        return null
    }
};

function resolveFeeBps(val: string | undefined) {
    const strVal = String(val);
    if ((typeof val === "undefined")) {
        return null;
    }

    return Number(strVal.replace(/_| /g, ""));
}

export const configParams = {
    routerAddress: resolvers.address,
    firstJettonMinter: resolvers.address,
    secondJettonMinter: resolvers.address,
    adminAddress: resolvers.address,
    tokenAmount: resolvers.bigint,
    libLpAccountAddress: resolvers.address,
    libLpWalletAddress: resolvers.address,
    libPoolAddress: resolvers.address,
    libRouterAddress: resolvers.address,
    libVaultAddress: resolvers.address,
    libLpAccountHex: resolvers.string,
    libLpWalletHex: resolvers.string,
    libPoolHex: resolvers.string,
    libRouterHex: resolvers.string,
    libVaultHex: resolvers.string,
    dexType: resolvePool,
    routerId: resolvers.number,
    defaultIsLocked: resolvers.number,
    defaultLPFee: resolveFeeBps,
    defaultProtocolFee: resolveFeeBps
};

export const cliConfig = new CliConfig(configParams, {
    dexType: true,
    defaultLPFee: true,
    defaultProtocolFee: true,
    defaultIsLocked: true,
});