import { Address, beginCell, Cell, ContractProvider, Sender, SendMode } from '@ton/core';
import { beginMessage, JettonWalletContractBase, jWalletOpcodes } from '../libs';
import { DefaultValues } from '../helpers/helpers';

export type LPWalletConfig = {
    balance?: bigint;
    ownerAddress: Address | null;
    minterAddress: Address;
    walletCode: Cell;
};


export function lPWalletConfigToCell(config: LPWalletConfig): Cell {
    return beginCell()
        .storeCoins(config.balance ?? 0n)
        .storeAddress(config.ownerAddress)
        .storeAddress(config.minterAddress)
        .storeRef(config.walletCode)
        .endCell();
}

export function lpWalletStorageParser(src: Cell) {
    let ds = src.beginParse()
    return {
        balance: ds.loadCoins(),
        owner: ds.loadAddress(),
        master: ds.loadAddress(),
        lpWalletCode: ds.loadRef().toString(),
    }
}


export const lpWalletOpcodes = {
    ...jWalletOpcodes,
    burnExt: 0x595f07bc
} as const;

export class LPWallet extends JettonWalletContractBase<typeof lpWalletOpcodes> {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell; }) { 
        super(lpWalletOpcodes, address, init)
    }
    static createFromConfig(config: LPWalletConfig, code: Cell, workchain = 0) {
        return this.createFromConfigBase(config, lPWalletConfigToCell, code, workchain)
    }

    async sendBurnExt(provider: ContractProvider, via: Sender, opts: {
        jettonAmount: bigint;
        responseAddress?: Address;
        customPayload?: {
            leftPayload?: Cell;
            rightPayload?: Cell;
        };
    }, value?: bigint) {
        let customPayloadCell;
        if (opts.customPayload)
            customPayloadCell = beginCell()
                .storeMaybeRef(opts.customPayload.leftPayload)
                .storeMaybeRef(opts.customPayload.rightPayload)
                .endCell()

        await provider.internal(via, {
            value: value || DefaultValues.DEFAULT_MSG_VALUE,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginMessage(this.opCodes.burnExt)
                .storeCoins(opts.jettonAmount)
                .storeAddress(opts.responseAddress || null)
                .storeMaybeRef(opts.customPayload ? customPayloadCell : null)
                .endCell(),
        });
    }


}
