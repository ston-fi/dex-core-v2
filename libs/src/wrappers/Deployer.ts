import { Cell, OpenedContract, beginCell } from "@ton/core";
import { CommonContractBase } from "./abstract/abcCommon";
import { codeFromString } from "../cell";
import { NetworkProvider } from "@ton/blueprint";
import { AccountState, getAccountState } from "../onchain-helper";

export async function getLatestDeployer(provider: NetworkProvider, params: {
    deployerCode?: Cell,
    publib: Cell,
    forceId?: number
}) {
    params.deployerCode = params.deployerCode ?? DEFAULT_DEPLOYER_CODE
    let id = params.forceId ?? 0
    let contract: OpenedContract<Deployer>
    let status: AccountState
    while (true) {
        if (id > 0xffffffff) throw new Error("id exhausted uint32")
        contract = provider.open(Deployer.createFromConfig({ publib: params.publib, id: id }, params.deployerCode))
        status = await getAccountState(provider, contract)
        if (params.forceId !== undefined) break
        if (status !== "frozen") break
        id++
    }   
    return {
        id: id,
        contract: contract,
        status: status,
    }
}

export type DeployerConfig = {
    publib: Cell,
    id?: number
};

export function deployerConfigToCell(config: DeployerConfig): Cell {
    return beginCell()
        .storeUint(1, 1)
        .storeUint(config.id ?? 0, 32)
        .storeRef(config.publib)
        .endCell();
}

export class Deployer extends CommonContractBase {
    static createFromConfig(config: DeployerConfig, code?: Cell, workchain = -1) {
        return this.createFromConfigBase(config, deployerConfigToCell, code ?? DEFAULT_DEPLOYER_CODE, workchain)
    }
}


// =======================================
export const DEFAULT_DEPLOYER_CODE = codeFromString("b5ee9c72410103010027000114ff00f4a413f4bcf2c80b010128d3ed44d0d300018e88d43072fb0688ed549130e20200014013d4e9d2")
/*
#pragma version >=0.2.0;

#include "../node_modules/@ston-fi/funcbox/contracts/stdlib.fc";

() set_lib(cell code, int mode) impure asm "SETLIBCODE";
cell empty_storage() asm "<b 0 1 u, b> PUSHREF";

() recv_internal() impure {    
    slice ds = get_data().begin_parse();
    if ds~load_uint(1) {
        set_lib(ds~load_ref(), 2);
        set_data(empty_storage());
    }
    return ();
}
*/
// =======================================