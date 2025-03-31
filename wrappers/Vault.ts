import { Address, beginCell, Cell, ContractProvider, Sender, SendMode } from '@ton/core';
import { beginMessage, CommonContractBase } from '../libs';
import { DefaultValues } from '../helpers/helpers';

export type VaultConfig = {
    ownerAddress: Address,
    tokenAddress: Address,
    routerAddress: Address,
    depositedAmount?: bigint,
};

export function vaultConfigToCell(config: VaultConfig): Cell {
    return beginCell()
        .storeAddress(config.ownerAddress)
        .storeAddress(config.tokenAddress)
        .storeAddress(config.routerAddress)
        .storeCoins(config.depositedAmount ?? 0n)
        .endCell();
}

export function vaultStorageParser(src: Cell) {
    let ds = src.beginParse()
    return {
        owner: ds.loadAddress(),
        token: ds.loadAddress(),
        router: ds.loadAddress(),
        deposit: ds.loadCoins(),
    }
}

export const vaultOpcodes = {
    vaultPayTo: 0x2100c922,
    depositRefFee: 0x490f09b,
    withdrawFee: 0x354bcdf4
} as const;

export class Vault extends CommonContractBase {

    static createFromConfig(config: VaultConfig, code: Cell, workchain = 0) {
        return this.createFromConfigBase(config, vaultConfigToCell, code, workchain)
    }

    async sendWithdrawFee(provider: ContractProvider, via: Sender, value?: bigint) {
        await provider.internal(via, {
            value: value || DefaultValues.DEFAULT_MSG_VALUE,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginMessage(vaultOpcodes.withdrawFee)
                .endCell(),
        });
    }

    async getVaultData(provider: ContractProvider) {
        const result = await provider.get('get_vault_data', []);
        return {
            ownerAddress: result.stack.readAddress(),
            tokenAddress: result.stack.readAddress(),
            routerAddress: result.stack.readAddress(),
            depositedAmount: result.stack.readBigNumber(),
        };
    }
}
