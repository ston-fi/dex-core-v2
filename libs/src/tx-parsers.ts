import { stdFtOpCodes, stonFiDexCodesV2 } from "./codes";
import { fromNanos } from "./balances";
import { codeFromString } from "./cell";
import { defaultCodeMap } from "./graph";
import { dateFromSec } from "./time";

export function parsePayToV2(src: string, mode?: "core" | "full" | "nocell") {
    mode = mode ?? "nocell"
    let ds = codeFromString(src).beginParse()
    let op = ds.loadUint(32)
    if (op !== stonFiDexCodesV2.payToDexV2) {
        throw new Error("is not a pay_to op")
    }
    let primary = {
        qId: ds.loadUint(64),
        toAddress: ds.loadAddress(),
        excessesAddress: ds.loadAddress(),
        originalSender: ds.loadAddress(),
        exitCode: ds.loadUint(32),
        customPayload: ds.loadMaybeRef()
    }
    ds = ds.loadRef().beginParse()
    let additional = {
        fwdAmount: fromNanos(ds.loadCoins()),
        amount0: ds.loadCoins(),
        token0Address: ds.loadAddress(),
        amount1: ds.loadCoins(),
        token1Address: ds.loadAddress(),
    }

    let coreDisp = {
        op: "pay_to_v2.1",
        toAddress: primary.toAddress,
        excessesAddress: primary.excessesAddress,
        exitCodeParsed: defaultCodeMap.get(primary.exitCode),
        exitCodeDec: primary.exitCode,
        exitCodeHex: "0x" + primary.exitCode.toString(16),
    }
    if (mode === "core") {
        return {
            ...coreDisp,
            customPayload: primary.customPayload ? true : false,
        }
    } else if (mode === "full") {
        return {
            ...coreDisp,
            customPayload: primary.customPayload,
            fwdAmount: additional.fwdAmount,
            amount0: additional.amount0,
            token0Address: additional.token0Address,
            amount1: additional.amount1,
            token1Address: additional.token1Address,
        }
    } else if (mode === "nocell") {
        return {
            ...coreDisp,
            customPayload: primary.customPayload ? true : false,
            fwdAmount: additional.fwdAmount,
            amount0: additional.amount0,
            token0Address: additional.token0Address,
            amount1: additional.amount1,
            token1Address: additional.token1Address,
        }
    }
}

export function parseSwapV2(src: string, mode?: "core" | "full" | "nocell") {
    mode = mode ?? "nocell"
    let ds = codeFromString(src).beginParse()
    let op = ds.loadUint(32)
    if (op !== stdFtOpCodes.ftTransferNotification) {
        throw new Error("is not a transfer_notification op")
    }
    let jetton = {
        qId: ds.loadUint(64),
        jettonAmount: ds.loadCoins(),
        fromAddress: ds.loadAddress(),
    }
    ds = ds.loadRef().beginParse()
    op = ds.loadUint(32)
    if (op !== stonFiDexCodesV2.swapDexV2) {
        throw new Error("is not a lp_provide op")
    }
    let primary = {
        otherTokenWallet: ds.loadAddress(),
        refundAddress: ds.loadAddress(),
        excessesAddress: ds.loadAddress(),
        deadline: ds.loadUintBig(64),
    }
    ds = ds.loadRef().beginParse()
    let additional = {
        minOut: ds.loadCoins(),
        toAddress: ds.loadAddress(),
        fwdGas : ds.loadCoins(),
        customPayload: ds.loadMaybeRef(),
        refundFwdGas : ds.loadCoins(),
        refundPayload: ds.loadMaybeRef(),
        refFee : ds.loadUint(16),
        refAddress: ds.loadMaybeAddress(),
    }

    let coreDisp = {
        op: "swap_v2.1",
        jettonAmount: jetton.jettonAmount,
        toAddress: additional.toAddress,
        otherTokenWallet: primary.otherTokenWallet,
        minOut: additional.minOut,
        deadline: dateFromSec(primary.deadline),
        fwdAmount: fromNanos(additional.fwdGas),
    }
    if (mode === "core") {
        return {
            ...coreDisp,
            customPayload: additional.customPayload ? true : false,
        }
    } else if (mode === "full") {
        return {
            ...coreDisp,
            excessesAddress: primary.excessesAddress,
            refundAddress: primary.refundAddress,    
            customPayload: additional.customPayload,
        }
    } else if (mode === "nocell") {
        return {
            ...coreDisp,
            excessesAddress: primary.excessesAddress,
            refundAddress: primary.refundAddress,    
            customPayload: additional.customPayload ? true : false,
        }
    }
}

export function parseLpV2(src: string, mode?: "core" | "full" | "nocell") {
    mode = mode ?? "nocell"
    let ds = codeFromString(src).beginParse()
    let op = ds.loadUint(32)
    if (op !== stdFtOpCodes.ftTransferNotification) {
        throw new Error("is not a transfer_notification op")
    }
    let jetton = {
        qId: ds.loadUint(64),
        jettonAmount: ds.loadCoins(),
        fromAddress: ds.loadAddress(),
    }
    ds = ds.loadRef().beginParse()
    op = ds.loadUint(32)
    if (op !== stonFiDexCodesV2.provideLpDexV2) {
        throw new Error("is not a lp_provide op")
    }
    let primary = {
        otherTokenWallet: ds.loadAddress(),
        refundAddress: ds.loadAddress(),
        excessesAddress: ds.loadAddress(),
        deadline: ds.loadUintBig(64),
    }
    ds = ds.loadRef().beginParse()
    let additional = {
        minLpOut: fromNanos(ds.loadCoins()),
        toAddress: ds.loadAddress(),
        bothPositive: ds.loadUint(1),
        fwdAmount: ds.loadCoins(),
        customPayload: ds.loadMaybeRef(),
    }

    let coreDisp = {
        op: "lp_provide_v2.1",
        jettonAmount: jetton.jettonAmount,
        toAddress: additional.toAddress,
        otherTokenWallet: primary.otherTokenWallet,
        minLpOut: additional.minLpOut,
        bothPositive: additional.bothPositive,
        fwdAmount: fromNanos(additional.fwdAmount),
    }
    if (mode === "core") {
        return {
            ...coreDisp,
            customPayload: additional.customPayload ? true : false,
        }
    } else if (mode === "full") {
        return {
            ...coreDisp,
            excessesAddress: primary.excessesAddress,
            refundAddress: primary.refundAddress,    
            customPayload: additional.customPayload,
        }
    } else if (mode === "nocell") {
        return {
            ...coreDisp,
            excessesAddress: primary.excessesAddress,
            refundAddress: primary.refundAddress,    
            customPayload: additional.customPayload ? true : false,
        }
    }
}

export function parseCBAddLiqV1(src: string, mode?: "core" | "full" | "nocell") {
    mode = mode ?? "nocell"
    let ds = codeFromString(src).beginParse()
    let op = ds.loadUint(32)
    if (op !== 0x56dfeb8a) {
        throw new Error("is not a cb_add_liquidity op")
    }
    let data = {
        qId: ds.loadUint(64),
        amount1: ds.loadCoins(),
        amount2: ds.loadCoins(),
        user: ds.loadAddress(),
        minOut: ds.loadCoins(),
    }

    let coreDisp = {
        op: "cb_add_liquidity_v1",
        amount1: data.amount1,
        amount2: data.amount2,
        user: data.user,
        minOut: data.minOut
    }
    if (mode === "core") {
        return {
            ...coreDisp,
        }
    } else if (mode === "full") {
        return {
            ...coreDisp,
        }
    } else if (mode === "nocell") {
        return {
            ...coreDisp,
        }
    }
}

export function parseCBAddLiqV2(src: string, mode?: "core" | "full" | "nocell") {
    mode = mode ?? "nocell"
    let ds = codeFromString(src).beginParse()
    let op = ds.loadUint(32)
    if (op !== 0x6ecd527) {
        throw new Error("is not a cb_add_liquidity op")
    }
    let data = {
        qId: ds.loadUint(64),
        amount1: ds.loadCoins(),
        amount2: ds.loadCoins(),
        user: ds.loadAddress(),
        minOut: ds.loadCoins(),
        fwdAmount: ds.loadCoins(),
    }

    let coreDisp = {
        op: "cb_add_liquidity_v2.1",
        amount1: data.amount1,
        amount2: data.amount2,
        user: data.user,
        minOut: data.minOut,
        fwdAmount: fromNanos(data.minOut)
    }
    ds = ds.loadRef().beginParse()
    let additional = {
        toAddress: ds.loadAddress(),
        refund: ds.loadAddress(),
        excess: ds.loadAddress(),
    }
    if (mode === "core") {
        return {
            ...coreDisp,
            ...additional
        }
    } else if (mode === "full") {
        return {
            ...coreDisp,
            ...additional
        }
    } else if (mode === "nocell") {
        return {
            ...coreDisp,
            ...additional
        }
    }
}