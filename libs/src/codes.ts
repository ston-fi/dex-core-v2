import fs from 'fs';
import * as parser from "./parser/confParser";

// https://docs.ton.org/learn/tvm-instructions/tvm-exit-codes
export const tvmErrorCodes = {
    ok: 0,
    okAlt: 1,
    stackUnderflow: 2,
    stackOverflow: 3,
    intOverflow: 4,
    intOutOfRange: 5,
    invalidOpCode: 6,
    typeCheckError: 7,
    cellOverflow: 8,
    cellUnderflow: 9,
    dictError: 10,
    getMethodNotFound11: 11,
    impossible: 12,
    outOfGas: 13,
    outOfGasAlt: -14,
    actionListInvalid: 32, // maybe get method not found
    actionInvalid: 34,
    notEnoughTon: 37,
    notEnoughExtra: 38,
} as const;

// https://github.com/ton-blockchain/token-contract/blob/main/nft/op-codes.fc
export const stdNftOpCodes = {
    nftTransfer: 0x5fcc3d14,
    nftOwnershipAssigned: 0x05138d91,
    nftGetStaticData: 0x2fcb26a2,
    nftReportStaticData: 0x8b771735,
    nftGetRoyaltyParams: 0x693d3950,
    nftReportRoyaltyParams: 0xa8cb00ad,
    nftEditContent: 0x1a0b9d51,
    nftTransferEditorship: 0x1c04412a,
    nftEditorshipAssigned: 0x511a4463,
    excesses: 0xd53276db,
} as const;

// https://github.com/ton-blockchain/token-contract/blob/main/ft/op-codes.fc
export const stdFtOpCodes = {
    ftTransfer: 0xf8a7ea5,
    ftInternalTransfer: 0x178d4519,
    ftTransferNotification: 0x7362d09c,
    ftBurn: 0x595f07bc,
    ftProvideWalletAddress: 0x2c76b973,
    ftTakeWalletAddress: 0xd1735400,
    excesses: 0xd53276db,
} as const;

export const stonFiDexCodesV1 = {
    provideLpDexV1: 0xfcf9e58f,
    swapDexV1: 0x25938561,
    resetGasDexV1: 0x42a0fb43,
    resetPoolGasDexV1: 0xf6aa9737,
    lockDexV1: 0x878f9b0e,
    unlockDexV1: 0x6ae4b0ef,
    setFeesDexV1: 0x355423e5,
    initAdminUpgradeDexV1: 0x2fb94384,
    initCodeUpgradeDexV1: 0xdf1e233d,
    cancelCodeUpgradeDexV1: 0x357ccc67,
    cancelAdminUpgradeDexV1: 0xa4ed9981,
    finalizeUpgradesDexV1: 0x6378509f,
    burnExtDexV1: 0x595f07bc,
    directAddLiquidityDexV1: 0x4cf82803,
    refundMeDexV1: 0xbf3f447,
    payToDexV1: 0xf93bb43f,
} as const;

export const stonFiDexCodesV2 = {
    resetGasDexV2: 0x29d22935,
    resetPoolGasDexV2: 0x66d0dff2,
    setFeesDexV2: 0x58274069,
    initAdminUpgradeDexV2: 0xb02fd5b,
    initCodeUpgradeDexV2: 0x3601fc8,
    cancelCodeUpgradeDexV2: 0x1f72111a,
    cancelAdminUpgradeDexV2: 0x72d6b3b4,
    finalizeUpgradesDexV2: 0x4e6707b7,
    updateStatusDexV2: 0x38a6022f,
    updatePoolStatusDexV2: 0x2af4607c,
    setParamsDexV2: 0x2b8b3b62,
    crossSwapDexV2: 0x69cf1a5b,
    crossProvideLpDexV2: 0x47df4137,
    provideLpDexV2: 0x37c096df,
    swapDexV2: 0x6664de2a,
    burnExtDexV2: 0x595f07bc,
    directAddLiquidityDexV2: 0xff8bfc6,
    refundMeDexV2: 0x132b9a2c,
    collectFeesDexV2: 0x1ee4911e,
    withdrawFeeDexV2: 0x354bcdf4,
    payToDexV2: 0x657b54f5,
    vaultPayToDexV2: 0x2100c922,
    cbRefundMeDexV2: 0xf98e2b8,
    addLiquidityDexV2: 0x50c6a654,
    depositRefFeeDexV2: 0x537c5a70,
} as const;

export const stonFiFarmCodesV3 = {
    unstakeFarmV3: 0x6ec9dc65,
    updateStakeTimeFarmV3: 0xf7929fbe,
    getterRoyaltyParamsFarmV3: 0x693d3950,
    changeOwnerFarmV3: 0x93b05b31,
    codeUpgradeFarmV3: 0x8fc13086,
    depositRewardsFarmV3: 0xe8e8e46c,
    stakeFarmV3: 0x6ec9dc65,
    initFarmV3: 0xc674e474,
    claimRewardsFarmV3: 0x78d9f109,
    internalRclaimFarmV3: 0xa1312496,
    updateClaimFarmV3: 0xc70d3ca5,
    internalUnstakeFarmV3: 0xa1312496,
    withdrawRewardsFarmV3: 0x82ee3aec,
    changeStatusFarmV3: 0x7331888c,
    changeRateFarmV3: 0xbc3b7682,
    changeCustodianFarmV3: 0x53b5e0e7,
    sendRawMsgFarmV3: 0xbc2d127b,
    confirmChangeCustodianFarmV3: 0xb2b4d0f7,
    confirmSendMsgFarmV3: 0x382b4467,
    confirmCodeUpgradeFarmV3: 0x267513cc,
    rejectChangeCustodianFarmV3: 0xf235998,
    rejectSendMsgFarmV3: 0xcfeda65d,
    rejectCodeUpgradeFarmV3: 0xadfc18b0,
    claimFeeFarmV3: 0x9d5d1457,
    changeFeeFarmV3: 0x476c06a8,
    changePoolStatusFarmV3: 0xb6eba1d8,
    createPoolFarmV3: 0x2e3034ef,
    updateAccruedValuesFarmV3: 0x7844c9d6,
    updateClaimFinalFarmV3: 0x2d673d98,
    changeRampDaysFarmV3: 0xf2a0313f
} as const;

export const stonFiPtonCodesV1 = {
    deployWalletPtonV1: 0x6cc43573
} as const;

export const stonFiPtonCodesV2 = {
    resetGasPtonV2: 0x29d22935,
    tonTransferPtonV2: 0x01f3835d,
    deployWalletPtonV2: 0x4f5f4313
} as const;

export function parseErrorsFromStr(src: string) {
    const entries = parser.parse(src);
    let res: Record<string, number> = {};
    // console.log(entries)
    for (let item of entries) {
        const typ = item.type;
        const key = item.key;
        const value = Number(item.val);

        if (typ !== "error")
            throw new Error(`type '${typ}' is not an error`)
        if (key in res)
            throw new Error(`key '${key}' defined twice`)
        if (!Number.isInteger(value))
            throw new Error(`value '${value}' is not a number`)
        if (Object.values(res).includes(value))
            throw new Error(`value '${value}' defined twice`)

        res[key] = value
    }
    return res
}

export function parseErrors(path: string) {
    const inp = fs.readFileSync(path, 'utf8');
    return parseErrorsFromStr(inp)
}


export function parseOpFromStr(src: string) {
    const entries = parser.parse(src);
    let res: Record<string, number> = {};
    for (let item of entries) {
        const typ = item.type;
        const key = (item.key as string).replace("::", "_");
        const value = Number(item.val);

        if (typ !== "op")
            continue
        if (key in res)
            throw new Error(`key '${key}' defined twice`)
        if (!Number.isInteger(value))
            throw new Error(`value '${value}' is not a number`)
        if (Object.values(res).includes(value))
            throw new Error(`value '${value}' defined twice`)

        res[key] = value
    }
    return res
}

export function parseOp(path: string) {
    const inp = fs.readFileSync(path, 'utf8');
    return parseOpFromStr(inp)
}

