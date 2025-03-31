import { Address, beginCell, Cell, ContractProvider, Sender, SendMode } from '@ton/core';
import { beginMessage, cellToBocStr, CommonContractBase, emptyCell } from '../libs';
import { DefaultValues } from '../helpers/helpers';

export type RouterConfig = {
    id?: number;
    isLocked: boolean;
    adminAddress: Address;
    lpWalletCode: Cell;
    poolCode: Cell;
    lpAccountCode: Cell;
    vaultCode: Cell;
    upgradePoolCode?: Cell;
};

export function routerConfigToCell(config: RouterConfig): Cell {
    return beginCell()
        .storeUint(config.isLocked ? 1 : 0, 1)
        .storeAddress(config.adminAddress)
        .storeRef(beginCell()
            .storeUint(0n, 64)
            .storeUint(0n, 64)
            .storeUint(0n, 64)
            .storeAddress(null)
            .storeRef(emptyCell())
            .storeRef(emptyCell())
            .endCell())
        .storeRef(beginCell()
            .storeUint(config.id ?? 0, 64)
            .storeRef(config.lpWalletCode)
            .storeRef(config.poolCode)
            .storeRef(config.lpAccountCode)
            .storeRef(config.vaultCode)
            .endCell())
        .storeRef(config.upgradePoolCode ?? emptyCell())
        .endCell();
}

export function routerStorageParser(src: Cell) {
    let ds = src.beginParse()
    return {
        isLocked: ds.loadBoolean(),
        admin: ds.loadAddress(),
        ...(() => {
            let ds_p = ds.loadRef().beginParse()
            return {
                codeEnd: ds_p.loadUintBig(64),
                adminEnd: ds_p.loadUintBig(64),
                poolEnd: ds_p.loadUintBig(64),
                newAdmin: ds_p.loadMaybeAddress(),
                newCode: emptyCell().equals(ds_p.loadRef()) ? false : true,
                newPoolCode: emptyCell().equals(ds_p.loadRef()) ? false : true
            }
        })(),
        ...(() => {
            let ds_p = ds.loadRef().beginParse()
            return {
                id: ds_p.loadUintBig(64),
                lpWalletCode: cellToBocStr(ds_p.loadRef()),
                poolCode: cellToBocStr(ds_p.loadRef()),
                lpAccCode: cellToBocStr(ds_p.loadRef()),
                vaultCode: cellToBocStr(ds_p.loadRef()),
            }
        })(),
        upgradePoolCode: cellToBocStr(ds.loadRef()),
    }
}

export const routerOpcodes = {
    crossSwap: 0x69cf1a5b,
    crossProvideLp: 0x47df4137,
    provideLp: 0x37c096df,
    swap: 0x6664de2a,
    transferNotification: 0x7362d09c,
    resetGas: 0x29d22935,
    resetPoolGas: 0x66d0dff2,
    updatePoolStatus: 0x2af4607c,
    setFees: 0x58274069,
    updateStatus: 0x38a6022f,
    initAdminUpgrade: 0xb02fd5b,
    initCodeUpgrade: 0x3601fc8,
    cancelCodeUpgrade: 0x1f72111a,
    cancelAdminUpgrade: 0x72d6b3b4,

    initPoolCodeUpgrade: 0x29be3423,
    cancelPoolCodeUpgrade: 0x3d51269b,
    updatePoolCode: 0x68e89380,

    finalizeUpgrades: 0x4e6707b7,
    payTo: 0x657b54f5,
    vaultPayTo: 0x2100c922,
    getterPoolAddress: 0x2993ade0,
    setParams: 0x2b8b3b62
} as const;

export function provideLpPayload(opts: {
    otherTokenAddress: Address,
    minLpOut?: bigint | number,
    customPayload?: Cell,
    fwdAmount?: bigint,
    toAddress: Address,
    refundAddress: Address,
    excessesAddress?: Address,
    bothPositive?: boolean,
    deadline: number
}) {
    return beginCell()
        .storeUint(routerOpcodes.provideLp, 32)
        .storeAddress(opts.otherTokenAddress)
        .storeAddress(opts.refundAddress)
        .storeAddress(opts.excessesAddress ? opts.excessesAddress : opts.refundAddress)
        .storeUint(opts.deadline, 64)
        .storeRef(beginCell()
            .storeCoins(opts.minLpOut ?? 1n)
            .storeAddress(opts.toAddress)
            // is used for old liquidity provision, requires that both token amounts on 
            // lp account are positive before sending a call to pool to mint liquidity
            .storeUint(opts.bothPositive ? 1 : 0, 1)
            .storeCoins(opts.fwdAmount ?? 0n)
            .storeMaybeRef(opts.customPayload)
            .endCell())
        .endCell()
}

export function swapPayload(opts: {
    otherTokenWallet: Address,
    receiver: Address,
    minOut?: bigint,
    fwdGas?: bigint,
    refundFwdGas?: bigint,
    refAddress?: Address,
    refundAddress: Address,
    excessesAddress?: Address,
    deadline: number,
    customPayload?: Cell,
    refundPayload?: Cell,
    refFee?: bigint
}) {
    return beginCell()
        .storeUint(routerOpcodes.swap, 32)
        .storeAddress(opts.otherTokenWallet)
        .storeAddress(opts.refundAddress)
        .storeAddress(opts.excessesAddress ? opts.excessesAddress : opts.refundAddress)
        .storeUint(opts.deadline, 64)
        .storeRef(beginCell()
            .storeCoins(opts.minOut || 1n)
            .storeAddress(opts.receiver)
            .storeCoins(opts.fwdGas || 0n) // unused if cross-swap payload
            .storeMaybeRef(opts.customPayload)
            .storeCoins(opts.refundFwdGas || 0n) // used if refund occurs
            .storeMaybeRef(opts.refundPayload)  // used if refund occurs
            .storeUint(opts.refFee ?? 10, 16)   // max is 100 (1%)
            .storeAddress(opts.refAddress || null)
            .endCell())
        .endCell()
}

export function crossSwapPayload(opts: {
    otherTokenWallet: Address,
    receiver: Address,
    fwdGas?: bigint,
    minOut?: bigint,
    refAddress?: Address,
    refundAddress: Address,
    excessesAddress?: Address,
    customPayload?: Cell,
    refundFwdGas?: bigint,
    deadline: number,
    refFee?: bigint,
    refundPayload?: Cell
}) {
    // use this payload in swapPayload() to chain swaps on the same router
    return beginCell()
        .storeUint(routerOpcodes.crossSwap, 32)
        .storeAddress(opts.otherTokenWallet)
        .storeAddress(opts.refundAddress)
        .storeAddress(opts.excessesAddress ? opts.excessesAddress : opts.refundAddress)
        .storeUint(opts.deadline, 64)
        .storeRef(beginCell()
            .storeCoins(opts.minOut || 1n)
            .storeAddress(opts.receiver)
            .storeCoins(opts.fwdGas || 0n)
            .storeMaybeRef(opts.customPayload)
            .storeCoins(opts.refundFwdGas || 0n)
            .storeMaybeRef(opts.refundPayload)
            .storeUint(opts.refFee ?? 10, 16)
            .storeAddress(opts.refAddress || null)
            .endCell())
        .endCell()
}

export abstract class RouterBase extends CommonContractBase {
    async sendResetGas(provider: ContractProvider, via: Sender, value?: bigint) {
        await provider.internal(via, {
            value: value || DefaultValues.DEFAULT_MSG_VALUE,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginMessage(routerOpcodes.resetGas)
                .endCell(),
        });
    }

    async sendResetPoolGas(provider: ContractProvider, via: Sender, opts: {
        firstWalletAddress: Address;
        secondWalletAddress: Address;
        excessesAddress?: Address;
    }, value?: bigint) {
        await provider.internal(via, {
            value: value || DefaultValues.DEFAULT_MSG_VALUE,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginMessage(routerOpcodes.resetPoolGas)
                .storeAddress(opts.firstWalletAddress)
                .storeAddress(opts.secondWalletAddress)
                .storeAddress(opts.excessesAddress)
                .endCell(),
        });
    }

    async sendUpdatePoolStatus(provider: ContractProvider, via: Sender, opts: {
        firstWalletAddress: Address;
        secondWalletAddress: Address;
        excessesAddress?: Address;
    }, value?: bigint) {
        await provider.internal(via, {
            value: value || DefaultValues.DEFAULT_MSG_VALUE,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginMessage(routerOpcodes.updatePoolStatus)
                .storeAddress(opts.firstWalletAddress)
                .storeAddress(opts.secondWalletAddress)
                .storeAddress(opts.excessesAddress)
                .endCell(),
        });
    }

    async sendSetFees(provider: ContractProvider, via: Sender, opts: {
        newLPFee: bigint;
        newProtocolFee: bigint;
        newProtocolFeeAddress: Address;
        leftWalletAddress: Address;
        rightWalletAddress: Address;
        excessesAddress?: Address;
    }, value?: bigint) {
        await provider.internal(via, {
            value: value || DefaultValues.DEFAULT_MSG_VALUE,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginMessage(routerOpcodes.setFees)
                .storeUint(opts.newLPFee, 16)
                .storeUint(opts.newProtocolFee, 16)
                .storeAddress(opts.newProtocolFeeAddress)
                .storeRef(beginCell()
                    .storeAddress(opts.leftWalletAddress)
                    .storeAddress(opts.rightWalletAddress)
                    .storeAddress(opts.excessesAddress)
                    .endCell()
                )
                .endCell(),
        });
    }

    async sendUpdateStatus(provider: ContractProvider, via: Sender, value?: bigint) {
        await provider.internal(via, {
            value: value || DefaultValues.DEFAULT_MSG_VALUE,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginMessage(routerOpcodes.updateStatus)
                .endCell(),
        });
    }

    async sendInitAdminUpgrade(provider: ContractProvider, via: Sender, opts: {
        newAdmin: Address
    }, value?: bigint) {
        await provider.internal(via, {
            value: value || DefaultValues.DEFAULT_MSG_VALUE,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginMessage(routerOpcodes.initAdminUpgrade)
                .storeAddress(opts.newAdmin)
                .endCell(),
        });
    }

    async sendInitCodeUpgrade(provider: ContractProvider, via: Sender, opts: {
        newCode: Cell
    }, value?: bigint) {
        await provider.internal(via, {
            value: value || DefaultValues.DEFAULT_MSG_VALUE,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginMessage(routerOpcodes.initCodeUpgrade)
                .storeRef(opts.newCode)
                .endCell(),
        });
    }

    async sendCancelCodeUpgrade(provider: ContractProvider, via: Sender, value?: bigint) {
        await provider.internal(via, {
            value: value || DefaultValues.DEFAULT_MSG_VALUE,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginMessage(routerOpcodes.cancelCodeUpgrade)
                .endCell(),
        });
    }

    async sendInitPoolCodeUpgrade(provider: ContractProvider, via: Sender, opts: {
        newCode: Cell
    }, value?: bigint) {
        await provider.internal(via, {
            value: value || DefaultValues.DEFAULT_MSG_VALUE,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginMessage(routerOpcodes.initPoolCodeUpgrade)
                .storeRef(opts.newCode)
                .endCell(),
        });
    }

    async sendCancelPoolCodeUpgrade(provider: ContractProvider, via: Sender, value?: bigint) {
        await provider.internal(via, {
            value: value || DefaultValues.DEFAULT_MSG_VALUE,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginMessage(routerOpcodes.cancelPoolCodeUpgrade)
                .endCell(),
        });
    }

    async sendCancelAdminUpgrade(provider: ContractProvider, via: Sender, value?: bigint) {
        await provider.internal(via, {
            value: value || DefaultValues.DEFAULT_MSG_VALUE,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginMessage(routerOpcodes.cancelAdminUpgrade)
                .endCell(),
        });
    }

    async sendUpgradePoolCode(provider: ContractProvider, via: Sender, opts: {
        firstWalletAddress: Address;
        secondWalletAddress: Address;
    }, value?: bigint) {
        await provider.internal(via, {
            value: value || DefaultValues.DEFAULT_MSG_VALUE,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginMessage(routerOpcodes.updatePoolCode)
                .storeAddress(opts.firstWalletAddress)
                .storeAddress(opts.secondWalletAddress)
                .endCell(),
        });
    }

    async sendFinalizeUpgrades(provider: ContractProvider, via: Sender, value?: bigint) {
        await provider.internal(via, {
            value: value || DefaultValues.DEFAULT_MSG_VALUE,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginMessage(routerOpcodes.finalizeUpgrades)
                .endCell(),
        });
    }

    async sendPayTo(provider: ContractProvider, via: Sender, opts: {
        owner: Address;
        leftAmount: bigint;
        leftWalletAddress: Address;
        rightAmount: bigint;
        rightWalletAddress: Address;
        fwdTonAmount?: bigint;
        customPayload?: Cell;
    }, value?: bigint) {
        await provider.internal(via, {
            value: value || DefaultValues.DEFAULT_MSG_VALUE,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginMessage(routerOpcodes.payTo)
                .storeAddress(opts.owner)
                .storeMaybeRef(opts.customPayload)
                .storeRef(
                    beginCell()
                        .storeCoins(opts.fwdTonAmount || 0)
                        .storeCoins(opts.leftAmount)
                        .storeAddress(opts.leftWalletAddress)
                        .storeCoins(opts.rightAmount)
                        .storeAddress(opts.rightWalletAddress)
                        .endCell()
                )
                .endCell(),
        });
    }

    async sendSwap(provider: ContractProvider, via: Sender, opts: {
        jettonAmount: bigint;
        fromAddress: Address;
        otherWalletAddress: Address;
        toAddress?: Address;
        minOut?: bigint;
        refAddress?: Address;
        fwdTonAmount?: bigint;
        refundAddress?: Address;
        customPayload?: Cell;
        refValue?: number;
        refundPayload?: Cell;
        refundFwdTonAmount?: bigint;
        excessesAddress?: Address;
        deadline: number
    }, value?: bigint) {
        await provider.internal(via, {
            value: value || DefaultValues.DEFAULT_MSG_VALUE,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginMessage(routerOpcodes.transferNotification)
                .storeCoins(opts.jettonAmount)
                .storeAddress(opts.fromAddress)
                .storeBit(true)
                .storeRef(swapPayload({
                    otherTokenWallet: opts.otherWalletAddress,
                    receiver: opts.toAddress || opts.fromAddress,
                    minOut: opts.minOut || 1n,
                    fwdGas: opts.fwdTonAmount || 0n,
                    refundAddress: opts.refundAddress || opts.fromAddress,
                    refAddress: opts.refAddress || undefined,
                    refFee: opts.refValue ? BigInt(opts.refValue as number) : 10n,
                    refundFwdGas: opts.refundFwdTonAmount || 0n,
                    refundPayload: opts.refundPayload,
                    excessesAddress: opts.excessesAddress || opts.fromAddress,
                    customPayload: opts.customPayload,
                    deadline: opts.deadline
                }))
                .endCell()
        });
    }

    async sendInvalidReq(provider: ContractProvider, via: Sender, opts: {
        jettonAmount: bigint;
        fromAddress: Address;
    }, value?: bigint) {
        await provider.internal(via, {
            value: value || DefaultValues.DEFAULT_MSG_VALUE,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginMessage(routerOpcodes.transferNotification)
                .storeCoins(opts.jettonAmount)
                .storeAddress(opts.fromAddress)
                .storeBit(false)
                .storeUint(0, 32)
                .endCell()
        });
    }

    async sendProvideLiquidity(provider: ContractProvider, via: Sender, opts: {
        jettonAmount: bigint;
        fromAddress: Address;
        otherWalletAddress: Address;
        minLPOut?: bigint;
        fwdAmount?: bigint;
        customPayload?: Cell;
        bothPositive?: boolean;
        toAddress?: Address;
        deadline: number
    }, value?: bigint) {
        await provider.internal(via, {
            value: value || DefaultValues.DEFAULT_MSG_VALUE,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginMessage(routerOpcodes.transferNotification)
                .storeCoins(opts.jettonAmount)
                .storeAddress(opts.fromAddress)
                .storeBit(true)
                .storeRef(provideLpPayload({
                    otherTokenAddress: opts.otherWalletAddress,
                    minLpOut: opts.minLPOut || 0n,
                    customPayload: opts.customPayload,
                    fwdAmount: opts.fwdAmount ?? 0n,
                    toAddress: opts.toAddress || via.address as Address,
                    refundAddress: opts.toAddress || via.address as Address,
                    excessesAddress: opts.toAddress || via.address as Address,
                    bothPositive: opts.bothPositive,
                    deadline: opts.deadline
                }))
                .endCell()
        });
    }

    async sendGetterPoolAddress(provider: ContractProvider, via: Sender, opts: {
        leftWalletAddress: Address;
        rightWalletAddress: Address;
    }, value?: bigint) {
        await provider.internal(via, {
            value: value || DefaultValues.DEFAULT_MSG_VALUE,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginMessage(routerOpcodes.getterPoolAddress)
                .storeAddress(opts.leftWalletAddress)
                .storeAddress(opts.rightWalletAddress)
                .endCell(),
        });
    }

    async getRouterData(provider: ContractProvider) {
        const result = await provider.get('get_router_data', []);

        let res1 = {
            id: result.stack.readNumber(),
            type: result.stack.readString(),
            isLocked: result.stack.readBoolean(),
            adminAddress: result.stack.readAddress(),
            tmpUpgradeCache: result.stack.readCell(),
            poolCode: result.stack.readCell(),
            jettonLPWalletCode: result.stack.readCell(),
            LPAccountCode: result.stack.readCell()
        };

        let sc = res1.tmpUpgradeCache.beginParse()
        let res2 = {
            endCode: sc.loadUintBig(64),
            endAdmin: sc.loadUintBig(64),
            endPool: sc.loadUintBig(64),
            pendingNewAdmin: sc.loadMaybeAddress(),
            pendingCode: sc.loadRef(),
            pendingPoolCode: sc.loadRef()
        }
        return {
            ...res1,
            ...res2
        }
    }

    async getPoolAddress(provider: ContractProvider, opts: {
        firstWalletAddress: Address;
        secondWalletAddress: Address;
    }) {
        const result = await provider.get('get_pool_address', [
            { type: 'slice', cell: beginCell().storeAddress(opts.firstWalletAddress).endCell() },
            { type: 'slice', cell: beginCell().storeAddress(opts.secondWalletAddress).endCell() },
        ]);
        return result.stack.readAddress();
    }

    async getVaultAddress(provider: ContractProvider, opts: {
        userAddress: Address;
        tokenWalletAddress: Address;
    }) {
        const result = await provider.get('get_vault_address', [
            { type: 'slice', cell: beginCell().storeAddress(opts.userAddress).endCell() },
            { type: 'slice', cell: beginCell().storeAddress(opts.tokenWalletAddress).endCell() },
        ]);
        return result.stack.readAddress();
    }

    async getUpgradedPoolCode(provider: ContractProvider) {
        const result = await provider.get('get_upgraded_pool_code', []);
        return result.stack.readCell()
    }
    async getRouterVersion(provider: ContractProvider) {
        const result = await provider.get('get_router_version', []);
        return {
            major: result.stack.readNumber(),
            minor: result.stack.readNumber(),
            dev: result.stack.readString(),
        };
    }
}


export class Router extends RouterBase {
    static createFromConfig(config: RouterConfig, code: Cell, workchain = 0) {
        return this.createFromConfigBase(config, routerConfigToCell, code, workchain)
    }
}


export class RouterCWSI extends RouterBase {
    static createFromConfig(config: RouterConfig, code: Cell, workchain = 0) {
        return this.createFromConfigBase(config, routerConfigToCell, code, workchain)
    }

    async sendSetParams(provider: ContractProvider, via: Sender, opts: {
        newAmp: bigint;
        newRate: bigint;
        newW: bigint;
        sideWalletAddress?: Address;
        leftWalletAddress: Address;
        rightWalletAddress: Address;
        setterAddress?: Address;
        excessesRecipient?: Address;
    }, value?: bigint) {
        await provider.internal(via, {
            value: value || DefaultValues.DEFAULT_MSG_VALUE,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginMessage(routerOpcodes.setParams)
                .storeUint(opts.newAmp, 128)
                .storeUint(opts.newRate, 128)
                .storeUint(opts.newW, 128)
                .storeAddress(opts.sideWalletAddress)
                .storeAddress(opts.setterAddress ?? null)
                .storeRef(beginCell()
                    .storeAddress(opts.leftWalletAddress)
                    .storeAddress(opts.rightWalletAddress)
                    .storeAddress(opts.excessesRecipient || null)
                    .endCell())
                .endCell(),
        });
    }
}

export class RouterWCPI extends RouterBase {
    static createFromConfig(config: RouterConfig, code: Cell, workchain = 0) {
        return this.createFromConfigBase(config, routerConfigToCell, code, workchain)
    }

    async sendSetParams(provider: ContractProvider, via: Sender, opts: {
        newW: bigint;
        leftWalletAddress: Address;
        rightWalletAddress: Address;
        sideWalletAddress?: Address;
        excessesRecipient?: Address;
    }, value?: bigint) {
        await provider.internal(via, {
            value: value || DefaultValues.DEFAULT_MSG_VALUE,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginMessage(routerOpcodes.setParams)
                .storeUint(opts.newW, 128)
                .storeAddress(opts.sideWalletAddress ?? null)
                .storeRef(beginCell()
                    .storeAddress(opts.leftWalletAddress)
                    .storeAddress(opts.rightWalletAddress)
                    .storeAddress(opts.excessesRecipient || null)
                    .endCell())
                .endCell(),
        });
    }
}

export class RouterSI extends RouterBase {
    static createFromConfig(config: RouterConfig, code: Cell, workchain = 0) {
        return this.createFromConfigBase(config, routerConfigToCell, code, workchain)
    }

    async sendSetParams(provider: ContractProvider, via: Sender, opts: {
        newAmp: bigint;
        leftWalletAddress: Address;
        rightWalletAddress: Address;
        excessesRecipient?: Address;
    }, value?: bigint) {
        await provider.internal(via, {
            value: value || DefaultValues.DEFAULT_MSG_VALUE,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginMessage(routerOpcodes.setParams)
                .storeUint(opts.newAmp, 32)
                .storeAddress(opts.leftWalletAddress)
                .storeAddress(opts.rightWalletAddress)
                .storeAddress(opts.excessesRecipient || null)
                .endCell(),
        });
    }
}
