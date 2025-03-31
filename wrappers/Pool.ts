import { Address, beginCell, Cell, ContractProvider, Sender, SendMode } from '@ton/core';
import { AsyncReturnType, beginMessage, cellToBocStr, ElementType, HOLE_ADDRESS, JettonMinterContractBase } from '../libs';
import { DefaultValues, POOL_TYPES } from '../helpers/helpers';
import { swapPayload } from './Router';

export type PoolConfig = {
    routerAddress: Address;
    lpFee: bigint;
    protocolFee: bigint;
    protocolFeeAddress: Address;
    collectedLeftJettonProtocolFees: bigint;
    collectedRightJettonProtocolFees: bigint;
    leftReserve: bigint;
    rightReserve: bigint;
    leftWalletAddress: Address;
    rightWalletAddress: Address;
    totalSupplyLP: bigint;
    LPWalletCode: Cell;
    LPAccountCode: Cell;
};


export const poolOpcodes = {
    transferNotification: 0x7362d09c,
    provideLp: 0x37c096df,
    collectFees: 0x1ee4911e,
    cbRefundMe: 0xf98e2b8,
    resetGas: 0x29d22935,
    internalUpdateStatus: 0x62752512,
    internalSetFees: 0x58274069,
    swap: 0x6664de2a,
    addLiquidity: 0x50c6a654,
    getterLpAccountAddress: 0x15fbca95,
    getterPoolData: 0x26df39fc,
    provideWalletAddress: 0x2c76b973,
    takeWalletAddress: 0xd1735400,
    burnNotification: 0x297437cf,
    mint: 0,    // not present
    changeAdmin: 0, // not present
    changeContent: 0, // not present
    internalTransfer: 0, // not present,
    internalSetParams: 0x7163444a,
    setRate: 0x4a2bddb0,
} as const;

export abstract class PoolBase extends JettonMinterContractBase<typeof poolOpcodes> {

    async sendCollectFees(provider: ContractProvider, via: Sender, opts: {
        leftCustomPayload?: Cell;
        rightCustomPayload?: Cell;
    }, value?: bigint) {
        await provider.internal(via, {
            value: value || DefaultValues.DEFAULT_MSG_VALUE,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginMessage(this.opCodes.collectFees)
                .storeMaybeRef(opts.leftCustomPayload)
                .storeMaybeRef(opts.rightCustomPayload)
                .endCell(),
        });
    }

    async sendCBRefundMe(provider: ContractProvider, via: Sender, opts: {
        leftJettonAmount: bigint;
        rightJettonAmount: bigint;
        userAddress: Address;
    }, value?: bigint) {
        await provider.internal(via, {
            value: value || DefaultValues.DEFAULT_MSG_VALUE,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginMessage(this.opCodes.cbRefundMe)
                .storeCoins(opts.leftJettonAmount)
                .storeCoins(opts.rightJettonAmount)
                .storeAddress(opts.userAddress)
                .endCell(),
        });
    }

    async sendResetGas(provider: ContractProvider, via: Sender, value?: bigint) {
        await provider.internal(via, {
            value: value || DefaultValues.DEFAULT_MSG_VALUE,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginMessage(this.opCodes.resetGas)
                .endCell(),
        });
    }

    async sendInternalUpdateStatus(provider: ContractProvider, via: Sender, value?: bigint) {
        await provider.internal(via, {
            value: value || DefaultValues.DEFAULT_MSG_VALUE,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginMessage(this.opCodes.internalUpdateStatus)
                .endCell(),
        });
    }

    async sendInternalSetFees(provider: ContractProvider, via: Sender, opts: {
        newLPFee: bigint;
        newProtocolFee: bigint;
        newProtocolFeeAddress: Address;
    }, value?: bigint) {
        await provider.internal(via, {
            value: value || DefaultValues.DEFAULT_MSG_VALUE,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginMessage(this.opCodes.internalSetFees)
                .storeUint(opts.newLPFee, 16)
                .storeUint(opts.newProtocolFee, 16)
                .storeAddress(opts.newProtocolFeeAddress)
                .endCell(),
        });
    }

    async sendSwap(provider: ContractProvider, via: Sender, opts: {
        leftAmount: bigint;
        rightAmount: bigint;
        fromAddress: Address;
        excessesAddress?: Address;
        toAddress?: Address;
        minOut?: bigint;
        refAddress?: Address;
        refValue?: number;
        fwdTonAmount?: bigint;
        refundAddress?: Address;
        customPayload?: Cell;
        deadline: number;
        refundFwdTonAmount?: bigint;
        refundPayloadCs?: Cell;
    }, value?: bigint) {
        await provider.internal(via, {
            value: value || DefaultValues.DEFAULT_MSG_VALUE,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginMessage(this.opCodes.swap)
                .storeAddress(opts.fromAddress)
                .storeCoins(opts.leftAmount)
                .storeCoins(opts.rightAmount)
                .storeRef(beginCell()
                    .storeUint(this.opCodes.swap, 32) // opcode, not used, ignored
                    .storeAddress(null) // token_wallet1, not used, ignored
                    .storeAddress(opts.refundAddress || opts.fromAddress)
                    .storeAddress(opts.excessesAddress || opts.fromAddress)
                    .storeUint(opts.deadline, 64)
                    .storeRef(beginCell()
                        .storeCoins(opts.minOut ?? 1n)
                        .storeAddress(opts.toAddress || opts.fromAddress)
                        .storeCoins(opts.fwdTonAmount || 0n)
                        .storeMaybeRef(opts.customPayload)
                        .storeCoins(opts.refundFwdTonAmount ?? 0n)
                        .storeMaybeRef(opts.refundPayloadCs)
                        .storeUint(opts.refValue || 0, 16)
                        .storeAddress(opts.refAddress)
                        .endCell())
                    .endCell())
                .endCell(),
        });
    }

    async sendProvideLiquidity(provider: ContractProvider, via: Sender, opts: {
        leftAmount: bigint;
        rightAmount: bigint;
        fromAddress: Address;
        refundAddress?: Address;
        excessesAddress?: Address;
        deadline: number;
        minLpOut?: bigint;
        toAddress?: Address;
        bothPositive?: boolean;
        fwdTonAmount?: bigint;
        customPayload?: Cell;
    }, value?: bigint) {
        await provider.internal(via, {
            value: value || DefaultValues.DEFAULT_MSG_VALUE,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginMessage(this.opCodes.provideLp)
                .storeAddress(opts.fromAddress)
                .storeCoins(opts.leftAmount)
                .storeCoins(opts.rightAmount)
                .storeRef(beginCell()
                    .storeUint(0, 32) // opcode, not used, ignored
                    .storeAddress(null) // token_wallet1, not used, ignored
                    .storeAddress(opts.refundAddress || opts.fromAddress)
                    .storeAddress(opts.excessesAddress || opts.fromAddress)
                    .storeUint(opts.deadline, 64)
                    .storeRef(beginCell()
                        .storeCoins(opts.minLpOut ?? 1n)
                        .storeAddress(opts.toAddress || opts.fromAddress)
                        .storeUint(!opts.bothPositive ? 1 : 0, 1)
                        .storeCoins(opts.fwdTonAmount ?? 0n)
                        .storeMaybeRef(opts.customPayload)
                        .endCell())
                    .endCell())
                .endCell(),
        });
    }

    async sendBurnNotification(provider: ContractProvider, via: Sender, opts: {
        jettonAmount: number | bigint,
        fromAddress: Address,
        responseAddress: Address,
        customPayload?: Cell
    }, value?: bigint) {
        await provider.internal(via, {
            value: value || DefaultValues.DEFAULT_MSG_VALUE,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginMessage(this.opCodes.burnNotification)
                .storeCoins(opts.jettonAmount)
                .storeAddress(opts.fromAddress)
                .storeAddress(opts.responseAddress)
                .storeMaybeRef(opts.customPayload)
                .endCell()
        });
    }

    async sendCBProvideLiquidity(provider: ContractProvider, via: Sender, opts: {
        jettonAmount: bigint;
        fromAddress: Address;
        otherWalletAddress: Address;
        minLPOut?: bigint;
    }, value?: bigint) {
        await provider.internal(via, {
            value: value || DefaultValues.DEFAULT_MSG_VALUE,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginMessage(this.opCodes.transferNotification)
                .storeCoins(opts.jettonAmount)
                .storeAddress(opts.fromAddress)
                .storeBit(true)
                .storeRef(beginCell()
                    .storeUint(this.opCodes.provideLp, 32)
                    .storeAddress(opts.otherWalletAddress)
                    .storeCoins(opts.minLPOut || 0n)
                    .endCell())
                .endCell()
        });
    }

    async sendProvideWalletAddress(provider: ContractProvider, via: Sender, opts: {
        ownerAddress: Address;
        includeAddress: Boolean;
    }, value?: bigint) {
        await provider.internal(via, {
            value: value || DefaultValues.DEFAULT_MSG_VALUE,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginMessage(this.opCodes.provideWalletAddress)
                .storeAddress(opts.ownerAddress)
                .storeUint(opts.includeAddress ? 1 : 0, 1)
                .endCell()
        });
    }

    async sendGetterLPAccountAddress(provider: ContractProvider, via: Sender, opts: {
        userAddress: Address;
    }, value?: bigint) {
        await provider.internal(via, {
            value: value || DefaultValues.DEFAULT_MSG_VALUE,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginMessage(this.opCodes.getterLpAccountAddress)
                .storeAddress(opts.userAddress)
                .endCell(),
        });
    }

    async sendGetterPoolData(provider: ContractProvider, via: Sender, value?: bigint) {
        await provider.internal(via, {
            value: value || DefaultValues.DEFAULT_MSG_VALUE,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginMessage(this.opCodes.getterPoolData)
                .endCell(),
        });
    }

    async getLPAccountAddress(provider: ContractProvider, opts: {
        userAddress: Address;
    }) {
        const result = await provider.get('get_lp_account_address', [
            { type: 'slice', cell: beginCell().storeAddress(opts.userAddress).endCell() },
        ]);
        return result.stack.readAddress();
    }

    async getPoolType(provider: ContractProvider) {
        const result = await provider.get('get_pool_type', []);
        return result.stack.readString() as ElementType<typeof POOL_TYPES>;
    }
}

export function poolConfigToCell(config: PoolConfig): Cell {
    return beginCell()
        .storeUint(0, 1)
        .storeCoins(config.leftReserve)
        .storeCoins(config.rightReserve)
        .storeCoins(config.totalSupplyLP)
        .storeCoins(config.collectedLeftJettonProtocolFees)
        .storeCoins(config.collectedRightJettonProtocolFees)
        .storeAddress(config.protocolFeeAddress)
        .storeUint(config.lpFee, 16)
        .storeUint(config.protocolFee, 16)
        .storeRef(beginCell()
            .storeAddress(config.routerAddress)
            .storeAddress(config.leftWalletAddress)
            .storeAddress(config.rightWalletAddress)
            .storeRef(config.LPWalletCode)
            .storeRef(config.LPAccountCode)
            .endCell())
        .endCell();
}

export class Pool extends PoolBase {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell; }) {
        super(poolOpcodes, address, init)
    }

    static createFromConfig(config: PoolConfig, code: Cell, workchain = 0) {
        return this.createFromConfigBase(config, poolConfigToCell, code, workchain)
    }

    async getPoolData(provider: ContractProvider) {
        const result = await provider.get('get_pool_data', []);
        return {
            isLocked: result.stack.readBoolean(),
            routerAddress: result.stack.readAddress(),
            totalSupplyLP: result.stack.readBigNumber(),
            leftReserve: result.stack.readBigNumber(),
            rightReserve: result.stack.readBigNumber(),
            leftJettonAddress: result.stack.readAddress(),
            rightJettonAddress: result.stack.readAddress(),
            lpFee: result.stack.readBigNumber(),
            protocolFee: result.stack.readBigNumber(),
            protocolFeeAddress: result.stack.readAddressOpt(),
            collectedLeftJettonProtocolFees: result.stack.readBigNumber(),
            collectedRightJettonProtocolFees: result.stack.readBigNumber(),
            isV1: false
        };
    }
    async getPoolDataV1(provider: ContractProvider) {
        const result = await provider.get('get_pool_data', []);
        return {
            leftReserve: result.stack.readBigNumber(),
            rightReserve: result.stack.readBigNumber(),
            leftJettonAddress: result.stack.readAddress(),
            rightJettonAddress: result.stack.readAddress(),
            lpFee: result.stack.readBigNumber(),
            protocolFee: result.stack.readBigNumber(),
            refFee: result.stack.readBigNumber(),
            protocolFeeAddress: result.stack.readAddressOpt(),
            collectedLeftJettonProtocolFees: result.stack.readBigNumber(),
            collectedRightJettonProtocolFees: result.stack.readBigNumber(),
            isV1: true
        };
    }
}

export function cpiPoolConfigToCell(config: PoolConfig): Cell {
    return beginCell()
        .storeUint(0, 1)
        .storeCoins(config.leftReserve)
        .storeCoins(config.rightReserve)
        .storeCoins(config.totalSupplyLP)
        .storeCoins(config.collectedLeftJettonProtocolFees)
        .storeCoins(config.collectedRightJettonProtocolFees)
        .storeAddress(config.protocolFeeAddress)
        .storeUint(config.lpFee, 16)
        .storeUint(config.protocolFee, 16)
        .storeRef(beginCell()
            .storeAddress(config.routerAddress)
            .storeAddress(config.leftWalletAddress)
            .storeAddress(config.rightWalletAddress)
            .storeRef(config.LPWalletCode)
            .storeRef(config.LPAccountCode)
            .endCell())
        .endCell();
}

export function poolCpiStorageParser(src: Cell) {
    let ds = src.beginParse()
    return {
        isLocked: ds.loadBoolean(),
        reserve0: ds.loadCoins(),
        reserve1: ds.loadCoins(),
        totalSupplyLp: ds.loadCoins(),
        collectedToken0ProtocolFee: ds.loadCoins(),
        collectedToken1ProtocolFee: ds.loadCoins(),
        protocolFeeAddress: ds.loadMaybeAddress(),
        lpFee: ds.loadUintBig(16),
        protocolFee: ds.loadUintBig(16),
        ...(() => {
            let ds_p = ds.loadRef().beginParse()
            return {
                routerAddress: ds_p.loadAddress(),
                token0Address: ds_p.loadAddress(),
                token1Address: ds_p.loadAddress(),
                lpWalletCode: cellToBocStr(ds_p.loadRef()),
                lpAccCode: cellToBocStr(ds_p.loadRef()),
            }
        })(),

    }
}

export class PoolCPI extends PoolBase {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell; }) {
        super(poolOpcodes, address, init)
    }

    static createFromConfig(config: PoolConfig, code: Cell, workchain = 0) {
        return this.createFromConfigBase(config, cpiPoolConfigToCell, code, workchain)
    }

    async getPoolData(provider: ContractProvider) {
        const result = await provider.get('get_pool_data', []);
        return {
            isLocked: result.stack.readBoolean(),
            routerAddress: result.stack.readAddress(),
            totalSupplyLP: result.stack.readBigNumber(),
            leftReserve: result.stack.readBigNumber(),
            rightReserve: result.stack.readBigNumber(),
            leftJettonAddress: result.stack.readAddress(),
            rightJettonAddress: result.stack.readAddress(),
            lpFee: result.stack.readBigNumber(),
            protocolFee: result.stack.readBigNumber(),
            protocolFeeAddress: result.stack.readAddressOpt(),
            collectedLeftJettonProtocolFees: result.stack.readBigNumber(),
            collectedRightJettonProtocolFees: result.stack.readBigNumber(),
            isV1: false
        };
    }
}

export function csiPoolConfigToCell(config: PoolConfig): Cell {
    return beginCell()
        .storeUint(0, 1)
        .storeCoins(config.leftReserve)
        .storeCoins(config.rightReserve)
        .storeCoins(config.totalSupplyLP)
        .storeCoins(config.collectedLeftJettonProtocolFees)
        .storeCoins(config.collectedRightJettonProtocolFees)
        .storeAddress(config.protocolFeeAddress)
        .storeUint(config.lpFee, 16)
        .storeUint(config.protocolFee, 16)
        .storeRef(beginCell()
            .storeAddress(config.routerAddress)
            .storeAddress(config.leftWalletAddress)
            .storeAddress(config.rightWalletAddress)
            .storeRef(config.LPWalletCode)
            .storeRef(config.LPAccountCode)
            .endCell())
        .endCell();
}

export function poolCsiStorageParser(src: Cell) {
    let ds = src.beginParse()
    return {
        isLocked: ds.loadBoolean(),
        reserve0: ds.loadCoins(),
        reserve1: ds.loadCoins(),
        totalSupplyLp: ds.loadCoins(),
        collectedToken0ProtocolFee: ds.loadCoins(),
        collectedToken1ProtocolFee: ds.loadCoins(),
        protocolFeeAddress: ds.loadMaybeAddress(),
        lpFee: ds.loadUintBig(16),
        protocolFee: ds.loadUintBig(16),
        ...(() => {
            let ds_p = ds.loadRef().beginParse()
            return {
                routerAddress: ds_p.loadAddress(),
                token0Address: ds_p.loadAddress(),
                token1Address: ds_p.loadAddress(),
                lpWalletCode: cellToBocStr(ds_p.loadRef()),
                lpAccCode: cellToBocStr(ds_p.loadRef()),
            }
        })(),

    }
}

export class PoolCSI extends PoolBase {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell; }) {
        super(poolOpcodes, address, init)
    }

    static createFromConfig(config: PoolConfig, code: Cell, workchain = 0) {
        return this.createFromConfigBase(config, csiPoolConfigToCell, code, workchain)
    }

    async getPoolData(provider: ContractProvider) {
        const result = await provider.get('get_pool_data', []);
        return {
            isLocked: result.stack.readBoolean(),
            routerAddress: result.stack.readAddress(),
            totalSupplyLP: result.stack.readBigNumber(),
            leftReserve: result.stack.readBigNumber(),
            rightReserve: result.stack.readBigNumber(),
            leftJettonAddress: result.stack.readAddress(),
            rightJettonAddress: result.stack.readAddress(),
            lpFee: result.stack.readBigNumber(),
            protocolFee: result.stack.readBigNumber(),
            protocolFeeAddress: result.stack.readAddressOpt(),
            collectedLeftJettonProtocolFees: result.stack.readBigNumber(),
            collectedRightJettonProtocolFees: result.stack.readBigNumber(),
            isV1: false
        };
    }

}

export function cwsiPoolConfigToCell(config: PoolConfig & { amp?: bigint, rate?: bigint, w0?: bigint, setter?: Address }): Cell {
    return beginCell()
        .storeUint(1, 1)
        .storeCoins(config.leftReserve)
        .storeCoins(config.rightReserve)
        .storeCoins(config.totalSupplyLP)
        .storeCoins(config.collectedLeftJettonProtocolFees)
        .storeCoins(config.collectedRightJettonProtocolFees)
        .storeAddress(config.protocolFeeAddress)
        .storeUint(config.lpFee, 16)
        .storeUint(config.protocolFee, 16)
        .storeRef(beginCell()
            .storeUint(config.amp ?? 0n, 128)
            .storeUint(config.rate ?? 0n, 128)
            .storeUint(config.w0 ?? 0n, 128)
            .storeAddress(config.setter ?? null)
            .endCell())
        .storeRef(beginCell()
            .storeAddress(config.routerAddress)
            .storeAddress(config.leftWalletAddress)
            .storeAddress(config.rightWalletAddress)
            .storeRef(config.LPWalletCode)
            .storeRef(config.LPAccountCode)
            .endCell())
        .endCell();
}

export function poolCwsiStorageParser(src: Cell) {
    let ds = src.beginParse()
    return {
        isLocked: ds.loadBoolean(),
        reserve0: ds.loadCoins(),
        reserve1: ds.loadCoins(),
        totalSupplyLp: ds.loadCoins(),
        collectedToken0ProtocolFee: ds.loadCoins(),
        collectedToken1ProtocolFee: ds.loadCoins(),
        protocolFeeAddress: ds.loadMaybeAddress(),
        lpFee: ds.loadUintBig(16),
        protocolFee: ds.loadUintBig(16),
        ...(() => {
            let ds_p = ds.loadRef().beginParse()
            return {
                amp: ds_p.loadUintBig(128),
                rate: ds_p.loadUintBig(128),
                w0: ds_p.loadUintBig(128),
                rateSetter: ds_p.loadMaybeAddress(),
            }
        })(),
        ...(() => {
            let ds_p = ds.loadRef().beginParse()
            return {
                routerAddress: ds_p.loadAddress(),
                token0Address: ds_p.loadAddress(),
                token1Address: ds_p.loadAddress(),
                lpWalletCode: cellToBocStr(ds_p.loadRef()),
                lpAccCode: cellToBocStr(ds_p.loadRef()),
            }
        })(),

    }
}

export class PoolCWSI extends PoolBase {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell; }) {
        super(poolOpcodes, address, init)
    }

    static createFromConfig(config: PoolConfig, code: Cell, workchain = 0) {
        return this.createFromConfigBase(config, cwsiPoolConfigToCell, code, workchain)
    }

    async getPoolData(provider: ContractProvider) {
        const result = await provider.get('get_pool_data', []);
        return {
            isLocked: result.stack.readBoolean(),
            routerAddress: result.stack.readAddress(),
            totalSupplyLP: result.stack.readBigNumber(),
            leftReserve: result.stack.readBigNumber(),
            rightReserve: result.stack.readBigNumber(),
            leftJettonAddress: result.stack.readAddress(),
            rightJettonAddress: result.stack.readAddress(),
            lpFee: result.stack.readBigNumber(),
            protocolFee: result.stack.readBigNumber(),
            protocolFeeAddress: result.stack.readAddressOpt(),
            collectedLeftJettonProtocolFees: result.stack.readBigNumber(),
            collectedRightJettonProtocolFees: result.stack.readBigNumber(),
            amp: result.stack.readBigNumber(),
            rate: result.stack.readBigNumber(),
            w0: result.stack.readBigNumber(),
            setterAddress: result.stack.readAddressOpt(),
        };
    }

    async getPoolDataNoFail(provider: ContractProvider) {
        let data: AsyncReturnType<typeof this.getPoolData> = {
            isLocked: true,
            routerAddress: HOLE_ADDRESS,
            totalSupplyLP: 0n,
            leftReserve: 0n,
            rightReserve: 0n,
            leftJettonAddress: HOLE_ADDRESS,
            rightJettonAddress: HOLE_ADDRESS,
            lpFee: 0n,
            protocolFee: 0n,
            protocolFeeAddress: HOLE_ADDRESS,
            collectedLeftJettonProtocolFees: 0n,
            collectedRightJettonProtocolFees: 0n,
            amp: 0n,
            rate: 0n,
            w0: 0n,
            setterAddress: HOLE_ADDRESS,
        }
        try {
            data = await this.getPoolData(provider)
        } catch { }
        return data
    }

    async sendInternalSetParams(provider: ContractProvider, via: Sender, opts: {
        newAmp: bigint;
        newRate: bigint;
        newW: bigint;
        sideWalletAddress: Address;
        responseAddress: Address;
        rateSetterAddress: Address;
    }, value?: bigint) {
        await provider.internal(via, {
            value: value || DefaultValues.DEFAULT_MSG_VALUE,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginMessage(this.opCodes.internalSetParams)
                .storeAddress(opts.responseAddress)
                .storeAddress(opts.sideWalletAddress)
                .storeUint(opts.newAmp, 128)
                .storeUint(opts.newRate, 128)
                .storeUint(opts.newW, 128)
                .storeRef(beginCell()
                    .storeAddress(opts.rateSetterAddress)
                    .endCell())
                .endCell(),
        });
    }

    async sendSetRate(provider: ContractProvider, via: Sender, opts: {
        newRate: bigint;
    }, value?: bigint) {
        await provider.internal(via, {
            value: value || DefaultValues.DEFAULT_MSG_VALUE,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginMessage(this.opCodes.setRate)
                .storeUint(opts.newRate, 128)
                .endCell(),
        });
    }
}

export function wcpiPoolConfigToCell(config: PoolConfig & { w0?: bigint }): Cell {
    return beginCell()
        .storeUint(1, 1)
        .storeCoins(config.leftReserve)
        .storeCoins(config.rightReserve)
        .storeCoins(config.totalSupplyLP)
        .storeCoins(config.collectedLeftJettonProtocolFees)
        .storeCoins(config.collectedRightJettonProtocolFees)
        .storeAddress(config.protocolFeeAddress)
        .storeUint(config.lpFee, 16)
        .storeUint(config.protocolFee, 16)
        .storeUint(config.w0 ?? 0n, 64) // 0.0
        .storeRef(beginCell()
            .storeAddress(config.routerAddress)
            .storeAddress(config.leftWalletAddress)
            .storeAddress(config.rightWalletAddress)
            .storeRef(config.LPWalletCode)
            .storeRef(config.LPAccountCode)
            .endCell())
        .endCell();
}

export function poolWcpiStorageParser(src: Cell) {
    let ds = src.beginParse()
    return {
        isLocked: ds.loadBoolean(),
        reserve0: ds.loadCoins(),
        reserve1: ds.loadCoins(),
        totalSupplyLp: ds.loadCoins(),
        collectedToken0ProtocolFee: ds.loadCoins(),
        collectedToken1ProtocolFee: ds.loadCoins(),
        protocolFeeAddress: ds.loadMaybeAddress(),
        lpFee: ds.loadUintBig(16),
        protocolFee: ds.loadUintBig(16),
        w0: ds.loadUintBig(64),
        ...(() => {
            let ds_p = ds.loadRef().beginParse()
            return {
                routerAddress: ds_p.loadAddress(),
                token0Address: ds_p.loadAddress(),
                token1Address: ds_p.loadAddress(),
                lpWalletCode: cellToBocStr(ds_p.loadRef()),
                lpAccCode: cellToBocStr(ds_p.loadRef()),
            }
        })(),

    }
}

export class PoolWCPI extends PoolBase {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell; }) {
        super(poolOpcodes, address, init)
    }

    static createFromConfig(config: PoolConfig, code: Cell, workchain = 0) {
        return this.createFromConfigBase(config, wcpiPoolConfigToCell, code, workchain)
    }

    async getPoolData(provider: ContractProvider) {
        const result = await provider.get('get_pool_data', []);
        return {
            isLocked: result.stack.readBoolean(),
            routerAddress: result.stack.readAddress(),
            totalSupplyLP: result.stack.readBigNumber(),
            leftReserve: result.stack.readBigNumber(),
            rightReserve: result.stack.readBigNumber(),
            leftJettonAddress: result.stack.readAddress(),
            rightJettonAddress: result.stack.readAddress(),
            lpFee: result.stack.readBigNumber(),
            protocolFee: result.stack.readBigNumber(),
            protocolFeeAddress: result.stack.readAddressOpt(),
            collectedLeftJettonProtocolFees: result.stack.readBigNumber(),
            collectedRightJettonProtocolFees: result.stack.readBigNumber(),
            w0: result.stack.readBigNumber(),
        };
    }

    async sendInternalSetParams(provider: ContractProvider, via: Sender, opts: {
        newW: bigint,
        responseAddress: Address,
        sideWalletAddress: Address,
    }, value?: bigint) {
        await provider.internal(via, {
            value: value || DefaultValues.DEFAULT_MSG_VALUE,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginMessage(this.opCodes.internalSetParams)
                .storeAddress(opts.responseAddress)
                .storeAddress(opts.sideWalletAddress)
                .storeUint(opts.newW, 128)
                .endCell(),
        });
    }

    async getPoolDataNoFail(provider: ContractProvider) {
        let data: AsyncReturnType<typeof this.getPoolData> = {
            totalSupplyLP: 0n,
            routerAddress: HOLE_ADDRESS,
            isLocked: true,
            leftReserve: 0n,
            rightReserve: 0n,
            leftJettonAddress: HOLE_ADDRESS,
            rightJettonAddress: HOLE_ADDRESS,
            lpFee: 0n,
            protocolFee: 0n,
            protocolFeeAddress: HOLE_ADDRESS as Address | null,
            collectedLeftJettonProtocolFees: 0n,
            collectedRightJettonProtocolFees: 0n,
            w0: 0n,
        }
        try {
            data = await this.getPoolData(provider)
        } catch { }
        return data
    }

}

export function stablePoolConfigToCell(config: PoolConfig & { amp?: bigint }): Cell {
    return beginCell()
        .storeUint(0, 1)
        .storeCoins(config.leftReserve)
        .storeCoins(config.rightReserve)
        .storeCoins(config.totalSupplyLP)
        .storeCoins(config.collectedLeftJettonProtocolFees)
        .storeCoins(config.collectedRightJettonProtocolFees)
        .storeAddress(config.protocolFeeAddress)
        .storeUint(config.lpFee, 16)
        .storeUint(config.protocolFee, 16)
        .storeUint(config.amp ?? 1n, 32) // 1
        .storeRef(beginCell()
            .storeAddress(config.routerAddress)
            .storeAddress(config.leftWalletAddress)
            .storeAddress(config.rightWalletAddress)
            .storeRef(config.LPWalletCode)
            .storeRef(config.LPAccountCode)
            .endCell())
        .endCell();
}

export function poolStableStorageParser(src: Cell) {
    let ds = src.beginParse()
    return {
        isLocked: ds.loadBoolean(),
        reserve0: ds.loadCoins(),
        reserve1: ds.loadCoins(),
        totalSupplyLp: ds.loadCoins(),
        collectedToken0ProtocolFee: ds.loadCoins(),
        collectedToken1ProtocolFee: ds.loadCoins(),
        protocolFeeAddress: ds.loadMaybeAddress(),
        lpFee: ds.loadUintBig(16),
        protocolFee: ds.loadUintBig(16),
        amp: ds.loadUintBig(32),
        ...(() => {
            let ds_p = ds.loadRef().beginParse()
            return {
                routerAddress: ds_p.loadAddress(),
                token0Address: ds_p.loadAddress(),
                token1Address: ds_p.loadAddress(),
                lpWalletCode: cellToBocStr(ds_p.loadRef()),
                lpAccCode: cellToBocStr(ds_p.loadRef()),
            }
        })(),

    }
}

export class PoolStable extends PoolBase {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell; }) {
        super(poolOpcodes, address, init)
    }

    static createFromConfig(config: PoolConfig, code: Cell, workchain = 0) {
        return this.createFromConfigBase(config, wcpiPoolConfigToCell, code, workchain)
    }

    async getPoolData(provider: ContractProvider) {
        const result = await provider.get('get_pool_data', []);
        return {
            isLocked: result.stack.readBoolean(),
            routerAddress: result.stack.readAddress(),
            totalSupplyLP: result.stack.readBigNumber(),
            leftReserve: result.stack.readBigNumber(),
            rightReserve: result.stack.readBigNumber(),
            leftJettonAddress: result.stack.readAddress(),
            rightJettonAddress: result.stack.readAddress(),
            lpFee: result.stack.readBigNumber(),
            protocolFee: result.stack.readBigNumber(),
            protocolFeeAddress: result.stack.readAddressOpt(),
            collectedLeftJettonProtocolFees: result.stack.readBigNumber(),
            collectedRightJettonProtocolFees: result.stack.readBigNumber(),
            amp: result.stack.readBigNumber(),
        };
    }


    async getPoolDataNoFail(provider: ContractProvider) {
        let data: AsyncReturnType<typeof this.getPoolData> = {
            isLocked: false,
            routerAddress: HOLE_ADDRESS,
            totalSupplyLP: 0n,
            leftReserve: 0n,
            rightReserve: 0n,
            leftJettonAddress: HOLE_ADDRESS,
            rightJettonAddress: HOLE_ADDRESS,
            lpFee: 0n,
            protocolFee: 0n,
            protocolFeeAddress: HOLE_ADDRESS,
            collectedLeftJettonProtocolFees: 0n,
            collectedRightJettonProtocolFees: 0n,
            amp: 1n
        }
        try {
            data = await this.getPoolData(provider)
        } catch { }
        return data
    }

    async sendInternalSetParams(provider: ContractProvider, via: Sender, opts: {
        newAmp: bigint,
        responseAddress: Address,
    }, value?: bigint) {
        await provider.internal(via, {
            value: value || DefaultValues.DEFAULT_MSG_VALUE,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginMessage(this.opCodes.internalSetParams)
                .storeAddress(opts.responseAddress)
                .storeUint(opts.newAmp, 32)
                .endCell(),
        });
    }

}

