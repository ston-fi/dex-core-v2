import {
    Address,
    beginCell,
    Cell,
    ContractProvider,
    Sender,
    SendMode,
    Slice,
    toNano
} from '@ton/core';
import { parseAddress } from '../address';
import { beginMessage, codeFromString } from "../cell";
import { stdFtOpCodes } from '../codes';
import { fetchJettonData } from '../onchain-helper';
import { AsyncReturnType } from '../types';
import { JettonMinterContractBase, JettonMinterOpcodesType } from './abstract/abcJettonMinter';
import { JettonWalletContractBase, WalletOpcodesType } from './abstract/abcJettonWallet';
import { metadataCell } from '../meta';

export const PTON_MAINNET_ADDRESS_v1 = parseAddress("EQCM3B12QK1e4yZSf8GtBRT0aLMNyEsBc_DhVfRRtOEffLez")
export const PTON_MINTER_CODE_v1 = codeFromString("b5ee9c7241020a010001f4000114ff00f4a413f4bcf2c80b01020162020302c2d03322c700925f03e0d0d3030171b0925f03e0ed44d0d401f863d1fa4001f86170f841805401fa443058baf2f4fa4031fa003171d721fa0031fa003073a9b400f86201d31fd33f2282106cc43573bae3020282102c76b973bae3025f03840ff2f0040502037a60080902ae6c2182103d648d80f842a012bef2e053fa40307021805401fa443058baf2f47020f8284130c85003fa0201cf1601cf16c9f84322c8cb01f400f400cb00c920f9007074c8cb02ca07cbffc9d082103b9aca00881371db3c060700f2f8428208989680a013bcf2e04bfa40d3003095c821cf16c9916de28210d1735400708018c8cb05f841cf1621fa02cb6acb1f13cb3f21fa4430c0008e2f017020f8284130c85003fa0201cf1601cf16c9f84322c8cb01f400f400cb00c9f9007074c8cb02ca07cbffc9d0cf16947032cb01e2f400c98040fb000000002e778018c8cb055005cf165005fa0213cb6bccccc901fb00006dadbcf6a2686a00fc31e8b8107c142098642801fd0100e78b00e78b64fc2191646580fa007a00658064fc80383a6465816503e5ffe4e8400095af16f6a2686a00fc31e8b8e46583c6858d0e8e8e0e6745e5ee6e8c2e8d2c65ce6e8dedc5cccd25ed4cae8e8dedc5ee8dedc5ae0e4def0f25cd4e6dedd0678b64b83fc5817c21881a209840af77807b")
export const PTON_WALLET_CODE_v1 = codeFromString("b5ee9c7241020b010001e1000114ff00f4a413f4bcf2c80b01020162020302b6d020c700925f04e001d0d3030171b0925f04e0ed44d0fa0001f863fa4001f864fa4001f865d1fa4001f86270f842805401fa443058baf2f4fa4031fa003171d721fa0031fa003073a9b400f861d31fd33ff842f844c705e302443004050139a0f605da89a1f40003f0c7f48003f0c9f48003f0cba3f087f089f08b110a026244302482100f8a7ea5ba8ea35f04821042a0fb43ba8e93f84382103b9aca00a070fb0270f8448306db3ce0840ff2f0e30d060702fc0482100f8a7ea5ba8eec03fa0031fa4031fa4031f40431fa0024c20022c200b0f2e0575341bcf841aa008209312d00a05230bcb0f2e0535121a170fb0213a1f84321a0f86382107362d09cc8cb1f12cb3f01fa02f842cf1601cf1670f84402c9128306db3cc8f843fa02f844cf16f845cf16c9ed547f935f0470e2dc840f08090028708018c8cb055003cf165003fa02cb6ac901fb0001c434f841aa008209312d00a05210bcf2e05303fa00fa40fa4031f40431fa00315152a013a170fb02f84321a1f863f843c2fff2e05582107362d09cc8cb1f13cb3f58fa02f842cf1658cf167001c9128306db3cc8f843fa02f844cf16f845cf16c9ed5408002c718018c8cb055004cf165004fa0212cb6accc901fb000004f2f00000e34071b1")

export const PTON_MAINNET_ADDRESS_v2 = parseAddress("EQBnGWMCf3-FZZq1W4IWcWiGAc3PHuZ0_H-7sad2oY00o83S")
export const PTON_TESTNET_ADDRESS_v2 = parseAddress("EQACS30DNoUQ7NfApPvzh7eBmSZ9L4ygJ-lkNWtba8TQT1h7") 
export const PTON_MINTER_CODE_v2 = codeFromString("b5ee9c7241022501000a0e000114ff00f4a413f4bcf2c80b0102016202200202c9030a01cbd8831c02497c138087434c0dc009c6c260c5fc0a00835c85677be903e900c7e800c5c75c87e800c7e800c1cea6d0000f4c7f4cfc412040dc415914110c4dbc27e187e105bc4373e105bc45c007e910c006ebcb8157b513434c7c07e18b5007e18f5007e1934604024ef8416f17f8416f1382104f5f4313ba8e8ff8416f1382102c76b973bae3023070e30ddc840ff2f0050701fefa40d200d195c821cf16c9916de2f82822c870fa0201cf1601cf16c9f843016d6d6f04027001fa443001ba8e480170216f24206e8e345b036f24216e8e12317020c8cb015240f4005230f400cb00c901de433052306f04013120f90074c8cb0214ca0713cbffc9d04013923434e25502236f04013193318b02e28208989680060096f8416f15f82ca0f8416f16a101b60970fb0270f8416f1150238210d1735400f8416f1401c8cb1fcb3f58cf16f40012810090708018c8cb055004cf165004fa0212cb6a01cf17c901fb007f01daf8416f16f8416f12a7038208989680a08208989680a08208989680a08208989680a0bcf2e053fa40fa40d1217001fa443001ba217001fa443001bab0f2e055f82858c870fa0201cf1601cf16c9f843016d6d6f048208989680f8416f15f82ca0f8416f16a101b60970fb0270660801fe216f24206e8e345b036f24216e8e12317020c8cb015240f4005230f400cb00c901de433052306f04013120f90074c8cb0214ca0713cbffc9d04013923434e25502236f0401016f24216e8e12317020c8cb015240f4005230f400cb00c901de433052306f0401310382106540cf85f8416f1401c8cb1fcb3f01cf1641308306090034768018c8cb055005cf165005fa0213cb6bcc01cf17c901fb007f0201480b150145a610411806f05b59d3b200005cc708c11806f05b59d3b20000290154c2782651f187400c01fe702182b05803bcc5cb9634ba4cfb2213f784019318ed4dcb6017880faa35be8e23308288195e54c5dd42177f53a27172fa9ec630262827aa23a904821b782dace9d9aa18de2182708bcc0026baae9e45e470190267a230cfaa18be8e1c0182501425982cf597cd205cef7380a90401821b782dace9d9aa17a0dea76401a7640d01f2208261855144814a7ff805980ff0084000be8e2a8238056bc75e2d631000008261855144814a7ff805980ff0084000a98401822056bc75e2d631aa18a001de20824adf0ab5a80a22c61ab5a700be8e278238056bc75e2d63100000824adf0ab5a80a22c61ab5a700a98401822056bc75e2d631aa17a001de200e02f882403f1fce3da636ea5cf850be8e268238056bc75e2d6310000082403f1fce3da636ea5cf850a98401822056bc75e2d631aa16a001de20823927fa27722cc06cc5e2be8e268238056bc75e2d63100000823927fa27722cc06cc5e2a98401823815af1d78b58c400000a001de208238280e60114edb805d03bee300200f10004c8238056bc75e2d631000008238280e60114edb805d03a9840182380ad78ebc5ac6200000a00102f482380ebc5fb41746121110be8e268238056bc75e2d6310000082380ebc5fb41746121110a984018238056bc75e2d63100000a001de20823808f00f760a4b2db55dbe8e258238056bc75e2d63100000823808f00f760a4b2db55da984018232b5e3af16b1880000a001de20823806f5f1775788937937bee300201112004a8238056bc75e2d63100000823806f5f1775788937937a9840182315af1d78b58c40000a00101ec823806248f33704b286603be8e258238056bc75e2d63100000823806248f33704b286603a984018230ad78ebc5ac620000a001de20823805c548670b9510e7acbe8e258238056bc75e2d63100000823805c548670b9510e7aca98401823056bc75e2d6310000a001de208238056bc75e2d63100000a11301fe8238056bc75e2d631000005122a012a98453008238056bc75e2d63100000a9845c8238056bc75e2d63100000a9842073a90413a051218238056bc75e2d63100000a9842075a90413a051218238056bc75e2d63100000a9842077a90413a051218238056bc75e2d63100000a9842079a90413a0598238056bc75e2d6310000014001ca984800ba904a0aa00a08064a9040137a410411806f05b59d3b200005d4d98411812dca375e059b0b9f187401602fc8200c354218235c702bd3a30fc0000be228238070c1cc73b00c80000bbb0f2f420c1008e1282300de0b6b3a76400005202a3f05812a984e020821b782dace9d9aa18be8e2820821b782dace9d9aa17be8e18821b782dace9d9aa17a182501425982cf597cd205cef73809171e2e30d01a7648238056bc75e2d631000002117180042821b782dace9d9aa18a18288195e54c5dd42177f53a27172fa9ec630262827aa2303fc822056bc75e2d631aa18be8e1c30822056bc75e2d631aa18a18261855144814a7ff805980ff0084000de21822056bc75e2d631aa17be8e2701822056bc75e2d631aa17a101824adf0ab5a80a22c61ab5a7008238056bc75e2d63100000a984de21822056bc75e2d631aa16bee30021823815af1d78b58c400000bee30021191a1b004c01822056bc75e2d631aa16a10182403f1fce3da636ea5cf8508238056bc75e2d63100000a984004c01823815af1d78b58c400000a101823927fa27722cc06cc5e28238056bc75e2d63100000a98402f482380ad78ebc5ac6200000be8e260182380ad78ebc5ac6200000a1018238280e60114edb805d038238056bc75e2d63100000a984de218238056bc75e2d63100000be8e26018238056bc75e2d63100000a10182380ebc5fb417461211108238056bc75e2d63100000a984de218232b5e3af16b1880000bee300211c1d004a018232b5e3af16b1880000a101823808f00f760a4b2db55d8238056bc75e2d63100000a98401ec82315af1d78b58c40000be8e250182315af1d78b58c40000a101823806f5f17757889379378238056bc75e2d63100000a984de218238056bc75e2d6310000021a0511382380ad78ebc5ac6200000a98466a0511382381043561a8829300000a98466a05113823815af1d78b58c400000a98466a051131e01ea82381b1ae4d6e2ef500000a98466a0511382382086ac351052600000a98466a05113823825f273933db5700000a98466a05113822056bc75e2d631aa16a98466a05113823830ca024f987b900000a98466a0511382383635c9adc5dea00000a98466a0511382383ba1910bf341b00000a98466a0031f00428238410d586a20a4c00000a98412a08238056bc75e2d63100000a984018064a9840201202122001bbe0c83938c5bb932b632b0b9b2c4020271232400f5adbcf6a268698f80fc316a00fc31ea00fc3268903800fd221800dd79702afc1400e4387d0100e78b00e78b64fc2180b6b6b7823810b7921037471a2d81b79210b7470918b810646580a9207a0029187a0065806480ef2198291837820098907c803a6465810a650389e5ffe4e82009c91a1a712a8111b7820098c00037af16f6a268698f80fc316a00fc31ea00fc3268b83fc5817c227c21c0b2125f94") 
export const PTON_WALLET_CODE_v2 = codeFromString("b5ee9c7241022301000a35000114ff00f4a413f4bcf2c80b0102016202220202c9030c03f1dbb68bb7ec87434c0dc009c6c260c5fc0a00835c85677be903e900c7e800c5c75c87e800c7e800c1cea6d0000f4c7f4cfc412040dc415914110c4dbc27e187e105bc4373e105bc45c007e910c006ebcb8157b51343e80007e18be90007e18fe90007e19347e105bc47e1131c178c03e105bc47e10f1c178c0204050800bcf8416f17f8416f1382106540cf85ba8e45fa40308208989680f8416f15f82ca0f8416f16a101b60970fb02700183068210d53276db59f8416f14708010c8cb055004cf165005fa0212cb6a12cb1f12cb3fc901fb007f923070e292db31e001bcf8416f17f8416f1382100f8a7ea5ba8e4730f8416f13821029d22935ba8e37f8428208989680a070fb0270f84383068210d53276db59f8416f14708010c8cb055004cf165005fa0212cb6a12cb1f12cb3fc901fb007fe070e30d92db31e00602e4fa00fa40fa40f40431fa00f84225a1f862f842c2fff2e058db3cf82c5250a1800cfb02227201d70b0101bab35334c705b18e3c6c2170f8416f1144048209f3835df8416f1401c8cb1fcb3f5003fa0201cf1601cf16c9810090718010c8cb055004cf165004fa0212cb6accc901fb00e30e7f0b0700ca5242a05424258209f3835df8416f1401c8cb1fcb3f5003fa0201cf1601cf16c943308011718010c8cb055004cf165004fa0212cb6accc901fb0070018100828210d53276db59f8416f14708010c8cb055004cf165005fa0212cb6a12cb1f12cb3fc901fb0001388e93f8416f17f8416f138209f3835dba923070e30ddb00dc840ff2f00901e6fa00fa4022c200f2e057217201d70b0101baf2e05401ed44ed45ed478e425b8208989680f8416f15f82ca0f8416f16a101b60970fb02708210ae25d79e58810082f8416f14708010c8cb055004cf165005fa0212cb6a12cb1f12cb3fc901fb00ed67ed65ed64717fed118aed41edf101f2ff7f0a01cef8416f1622bcf2e05320d749c200f2e05af84222a0f862db3cf8416f15f8416f16a1f82ca022a070fb0270f843f8416f11440382107362d09cf8416f1401c8cb1fcb3f5003fa0201cf1601cf16c9810090718018c8cb055004cf165004fa0212cb6accc901fb000b0020c8f842fa02f843cf16f844cf16c9ed540201480d170145a610411806f05b59d3b200005cc708c11806f05b59d3b20000290154c2782651f187400e01fe702182b05803bcc5cb9634ba4cfb2213f784019318ed4dcb6017880faa35be8e23308288195e54c5dd42177f53a27172fa9ec630262827aa23a904821b782dace9d9aa18de2182708bcc0026baae9e45e470190267a230cfaa18be8e1c0182501425982cf597cd205cef7380a90401821b782dace9d9aa17a0dea76401a7640f01f2208261855144814a7ff805980ff0084000be8e2a8238056bc75e2d631000008261855144814a7ff805980ff0084000a98401822056bc75e2d631aa18a001de20824adf0ab5a80a22c61ab5a700be8e278238056bc75e2d63100000824adf0ab5a80a22c61ab5a700a98401822056bc75e2d631aa17a001de201002f882403f1fce3da636ea5cf850be8e268238056bc75e2d6310000082403f1fce3da636ea5cf850a98401822056bc75e2d631aa16a001de20823927fa27722cc06cc5e2be8e268238056bc75e2d63100000823927fa27722cc06cc5e2a98401823815af1d78b58c400000a001de208238280e60114edb805d03bee300201112004c8238056bc75e2d631000008238280e60114edb805d03a9840182380ad78ebc5ac6200000a00102f482380ebc5fb41746121110be8e268238056bc75e2d6310000082380ebc5fb41746121110a984018238056bc75e2d63100000a001de20823808f00f760a4b2db55dbe8e258238056bc75e2d63100000823808f00f760a4b2db55da984018232b5e3af16b1880000a001de20823806f5f1775788937937bee300201314004a8238056bc75e2d63100000823806f5f1775788937937a9840182315af1d78b58c40000a00101ec823806248f33704b286603be8e258238056bc75e2d63100000823806248f33704b286603a984018230ad78ebc5ac620000a001de20823805c548670b9510e7acbe8e258238056bc75e2d63100000823805c548670b9510e7aca98401823056bc75e2d6310000a001de208238056bc75e2d63100000a11501fe8238056bc75e2d631000005122a012a98453008238056bc75e2d63100000a9845c8238056bc75e2d63100000a9842073a90413a051218238056bc75e2d63100000a9842075a90413a051218238056bc75e2d63100000a9842077a90413a051218238056bc75e2d63100000a9842079a90413a0598238056bc75e2d6310000016001ca984800ba904a0aa00a08064a9040137a410411806f05b59d3b200005d4d98411812dca375e059b0b9f187401802fc8200c354218235c702bd3a30fc0000be228238070c1cc73b00c80000bbb0f2f420c1008e1282300de0b6b3a76400005202a3f05812a984e020821b782dace9d9aa18be8e2820821b782dace9d9aa17be8e18821b782dace9d9aa17a182501425982cf597cd205cef73809171e2e30d01a7648238056bc75e2d6310000021191a0042821b782dace9d9aa18a18288195e54c5dd42177f53a27172fa9ec630262827aa2303fc822056bc75e2d631aa18be8e1c30822056bc75e2d631aa18a18261855144814a7ff805980ff0084000de21822056bc75e2d631aa17be8e2701822056bc75e2d631aa17a101824adf0ab5a80a22c61ab5a7008238056bc75e2d63100000a984de21822056bc75e2d631aa16bee30021823815af1d78b58c400000bee300211b1c1d004c01822056bc75e2d631aa16a10182403f1fce3da636ea5cf8508238056bc75e2d63100000a984004c01823815af1d78b58c400000a101823927fa27722cc06cc5e28238056bc75e2d63100000a98402f482380ad78ebc5ac6200000be8e260182380ad78ebc5ac6200000a1018238280e60114edb805d038238056bc75e2d63100000a984de218238056bc75e2d63100000be8e26018238056bc75e2d63100000a10182380ebc5fb417461211108238056bc75e2d63100000a984de218232b5e3af16b1880000bee300211e1f004a018232b5e3af16b1880000a101823808f00f760a4b2db55d8238056bc75e2d63100000a98401ec82315af1d78b58c40000be8e250182315af1d78b58c40000a101823806f5f17757889379378238056bc75e2d63100000a984de218238056bc75e2d6310000021a0511382380ad78ebc5ac6200000a98466a0511382381043561a8829300000a98466a05113823815af1d78b58c400000a98466a051132001ea82381b1ae4d6e2ef500000a98466a0511382382086ac351052600000a98466a05113823825f273933db5700000a98466a05113822056bc75e2d631aa16a98466a05113823830ca024f987b900000a98466a0511382383635c9adc5dea00000a98466a0511382383ba1910bf341b00000a98466a0032100428238410d586a20a4c00000a98412a08238056bc75e2d63100000a984018064a984003ba0f605da89a1f40003f0c5f48003f0c7f48003f0c9a3f085f087f089f05597693bf2")

export const DEFAULT_PTON_MAINNET_ADDRESS = PTON_MAINNET_ADDRESS_v2

export function isPton(data: AsyncReturnType<typeof fetchJettonData>) {
    return data.symbol?.toLowerCase() === "pton"
}

export const pTonMinterOpCodesCommon= {
    burnNotification: 0,
    mint: 0,
    changeAdmin: 0,
    changeContent: 0,
    internalTransfer: 0,
};

export const pTonWalletOpcodesCommon = {
    internalTransfer: 0,
    burn: 0,
    resetGas: 0
};

export abstract class PTonMinterAbc<T extends JettonMinterOpcodesType> extends JettonMinterContractBase<T> {
    protected version: { major: number, minor: number, dev: string } = undefined as unknown as { major: number, minor: number, dev: string }

    abstract sendDeployWallet(provider: ContractProvider, via: Sender, opts: any, value: bigint): Promise<void>

    async getVersion(provider: ContractProvider) {
        if (!this.version) {
            try {
                const result = await provider.get('get_version', []);
                this.version = {
                    major: result.stack.readNumber(),
                    minor: result.stack.readNumber(),
                    dev: result.stack.readString(),
                }
            } catch {
                this.version = {
                    major: 1,
                    minor: 0,
                    dev: "release",
                }
            }
        }
        return this.version
    }

}

export abstract class PTonWalletAbc<T extends WalletOpcodesType & typeof pTonWalletOpcodesCommon> extends JettonWalletContractBase<T> {
    
    async sendResetGas(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value: value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginMessage(this.opCodes.resetGas)
                .endCell(),
        });
    }
}

// ====================================================================================================
// ================================================ v1 ================================================
// ====================================================================================================

export const pTonMinterOpCodesV1 = {
    ...pTonMinterOpCodesCommon,
    deployWallet: 0x6cc43573
} as const;
export const pTonWalletOpcodesV1 = {
    ...pTonWalletOpcodesCommon,
    transfer: stdFtOpCodes.ftTransfer,
    tonTransfer: 0,
    resetGas: 0x42a0fb43,
} as const;

// ====================================================================================================

export type PTonMinterConfigV1 = {
    walletCode?: Cell,
};
export type PTonWalletConfigV1 = {
    balance?: bigint,
    ownerAddress: Address,
    minterAddress: Address,
};

// ====================================================================================================

export function pTonMinterConfigToCellV1(config?: PTonMinterConfigV1): Cell {
    return beginCell()
    .storeRef(config?.walletCode ?? PTON_WALLET_CODE_v1)
    .endCell();
}
export function pTonWalletConfigToCellV1(config: PTonWalletConfigV1): Cell {
    return beginCell()
        .storeCoins(config.balance ?? 0)
        .storeAddress(config.ownerAddress)
        .storeAddress(config.minterAddress)
        .endCell();
}

// ====================================================================================================

export class PTonMinterV1 extends PTonMinterAbc<typeof pTonMinterOpCodesV1> {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell; }) { 
        super(pTonMinterOpCodesV1, address, init)
    }

    static createFromConfig(config?: PTonMinterConfigV1, code?: Cell, workchain = 0) {
        return this.createFromConfigBase(config ?? {}, pTonMinterConfigToCellV1, code ?? PTON_MINTER_CODE_v1, workchain)
    }

    async sendDeployWallet(provider: ContractProvider, via: Sender, opts: {
        ownerAddress: Address,
    }, value?: bigint) {
        await provider.internal(via, {
            value: value ?? toNano("1"),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginMessage(this.opCodes.deployWallet)
                .storeAddress(opts.ownerAddress)
                .endCell()
        });
    }

    async getVersion(provider: ContractProvider) {
        let ver = await super.getVersion(provider)
        if (ver.major !== 1) throw new Error("this minter is not v1")
        return this.version
    }
}

export class PTonWalletV1 extends PTonWalletAbc<typeof pTonWalletOpcodesV1> {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell; }) { 
        super(pTonWalletOpcodesV1, address, init)
    }

    static createFromConfig(config: PTonWalletConfigV1, code?: Cell, workchain = 0) {
        return this.createFromConfigBase(config, pTonWalletConfigToCellV1, code ?? PTON_WALLET_CODE_v1, workchain)
    }
}

// ====================================================================================================
// ================================================ v2 ================================================
// ====================================================================================================
export const pTonMinterOpCodesV2 = {
    ...pTonMinterOpCodesCommon,
    deployWallet: 0x4f5f4313
} as const;
export const pTonWalletOpcodesV2 = {
    ...pTonWalletOpcodesCommon,
    transfer: stdFtOpCodes.ftTransfer,
    tonTransfer: 0x01f3835d,
    resetGas: 0x29d22935,
} as const;

// ====================================================================================================

export type PTonMinterConfigV2 = {
    id?: number,
    walletCode: Cell,
    content: Cell,
};
export type PTonWalletConfigV2 = {
    balance: bigint,
    ownerAddress: Address,
    minterAddress: Address,
};

// ====================================================================================================

export function pTonMinterConfigToCellV2(config?: PTonMinterConfigV2): Cell {
    return beginCell()
        .storeUint(config?.id ?? 0, 32)
        .storeRef(config?.walletCode ?? PTON_WALLET_CODE_v2)
        .storeRef(config?.content ?? metadataCell("undefined"))
    .endCell();
}
export function pTonWalletConfigToCellV2(config: PTonWalletConfigV2): Cell {
    return beginCell()
        .storeCoins(config.balance ?? 0)
        .storeAddress(config.ownerAddress)
        .storeAddress(config.minterAddress)
        .endCell();
}

// ====================================================================================================

export class PTonMinterV2 extends PTonMinterAbc<typeof pTonMinterOpCodesV2> {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell; }) {
        super(pTonMinterOpCodesV2, address, init)
    }

    static createFromConfig(config?: PTonMinterConfigV2, code?: Cell, workchain = 0) {
        return this.createFromConfigBase(config, pTonMinterConfigToCellV2, code ?? PTON_MINTER_CODE_v2, workchain)
    }

    async sendDeployWallet(provider: ContractProvider, via: Sender, opts: {
        ownerAddress: Address,
        excessesAddress?: Address
    }, value?: bigint) {
        await provider.internal(via, {
            value: value ?? toNano("1"),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginMessage(this.opCodes.deployWallet)
                .storeAddress(opts.ownerAddress)
                .storeAddress(opts.excessesAddress || via.address)
                .endCell()
        });
    }
    
    async getVersion(provider: ContractProvider) {
        let ver = await super.getVersion(provider)
        if (ver.major !== 2) throw new Error("this minter is not v2")
        return this.version
    }
}

export class PTonWalletV2 extends PTonWalletAbc<typeof pTonWalletOpcodesV2> {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell; }) {
        super(pTonWalletOpcodesV2, address, init)
    }

    static createFromConfig(config: PTonWalletConfigV2, code?: Cell, workchain = 0) {
        return this.createFromConfigBase(config, pTonWalletConfigToCellV2, code ?? PTON_WALLET_CODE_v2, workchain)
    }

    async sendTonTransfer(provider: ContractProvider, via: Sender, opts: {
        tonAmount: bigint,
        refundAddress: Address,
        fwdPayload: Cell | Slice,
        gas: bigint,
    }) {
        if (!opts.gas) throw new Error("gas is 0")

        let msg_builder = beginMessage(this.opCodes.tonTransfer)
            .storeCoins(opts.tonAmount)
            .storeAddress(opts.refundAddress)

        let msg: Cell;
        if (opts.fwdPayload instanceof Cell) {
            msg = msg_builder
                .storeUint(1, 1)
                .storeRef(opts.fwdPayload)
                .endCell();
        } else {
            msg = msg_builder
                .storeUint(0, 1)
                .storeSlice(opts.fwdPayload)
                .endCell();
        }
        

        await provider.internal(via, {
            value: opts.tonAmount + opts.gas,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: msg,
        });
    }
}
