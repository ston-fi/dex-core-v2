import { Address, beginCell, Cell, ContractProvider, Sender, SendMode } from '@ton/core';
import { beginMessage, CommonContractBase } from '../libs';
import { DefaultValues } from '../helpers/helpers';

export type LPAccountConfig = {
    user: Address;
    pool: Address;
    storedLeft: bigint;
    storedRight: bigint;
};

export function lPAccountConfigToCell(config: LPAccountConfig): Cell {
    return beginCell()
        .storeAddress(config.user)
        .storeAddress(config.pool)
        .storeCoins(config.storedLeft)
        .storeCoins(config.storedRight)
        .endCell();
}

export function lpAccStorageParser(src: Cell) {
    let ds = src.beginParse()
    return {
        user: ds.loadAddress(),
        pool: ds.loadAddress(),
        amount0: ds.loadCoins(),
        amount1: ds.loadCoins(),
    }
}

export const lpAccOpcodes = {
    resetGas: 0x29d22935,
    directAddLiquidity: 0xff8bfc6,
    refundMe: 0x132b9a2c,
    getterLpAccountData: 0x24cfc100,
} as const;

export class LPAccount extends CommonContractBase {

    static createFromConfig(config: LPAccountConfig, code: Cell, workchain = 0) {
        return this.createFromConfigBase(config, lPAccountConfigToCell, code, workchain)
    }

    async sendResetGas(provider: ContractProvider, via: Sender, value?: bigint) {
        await provider.internal(via, {
            value: value || DefaultValues.DEFAULT_MSG_VALUE,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginMessage(lpAccOpcodes.resetGas)
                .endCell(),
        });
    }

    async sendDirectAddLiquidity(provider: ContractProvider, via: Sender, opts: {
        amount1?: bigint,
        amount2?: bigint,
        minOut?: bigint,
        fwdAmount?: bigint,
        fwdPayload?: Cell,
        toAddress?: Address,
        refundAddress?: Address,
        excessesAddress?: Address
    }, value?: bigint) {
        await provider.internal(via, {
            value: value || DefaultValues.DEFAULT_MSG_VALUE,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginMessage(lpAccOpcodes.directAddLiquidity)
                .storeCoins(opts.amount1 ?? 0n)
                .storeCoins(opts.amount2 ?? 0n)
                .storeCoins(opts.minOut ?? 1n)
                .storeCoins(opts.fwdAmount ?? 0n)
                .storeAddress(opts.toAddress || via.address)
                .storeMaybeRef(opts.fwdPayload)
                .storeRef(beginCell()
                    .storeAddress(opts.refundAddress || via.address)
                    .storeAddress(opts.excessesAddress || via.address)
                    .endCell())
                .endCell(),
        });
    }

    async sendRefundMe(provider: ContractProvider, via: Sender, opts: {
        leftMaybePayload?: Cell;
        rightMaybePayload?: Cell;
    }, value?: bigint) {
        await provider.internal(via, {
            value: value || DefaultValues.DEFAULT_MSG_VALUE,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginMessage(lpAccOpcodes.refundMe)
                .storeMaybeRef(opts.leftMaybePayload)
                .storeMaybeRef(opts.rightMaybePayload)
                .endCell(),
        });
    }

    async sendGetterLPAccountData(provider: ContractProvider, via: Sender, value?: bigint) {
        await provider.internal(via, {
            value: value || DefaultValues.DEFAULT_MSG_VALUE,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginMessage(lpAccOpcodes.getterLpAccountData)
                .endCell(),
        });
    }

    async getLPAccountData(provider: ContractProvider) {
        const result = await provider.get('get_lp_account_data', []);
        return {
            userAddress: result.stack.readAddress(),
            poolAddress: result.stack.readAddress(),
            leftAmount: result.stack.readBigNumber(),
            rightAmount: result.stack.readBigNumber(),
        };
    }
}
