import { Address, beginCell, Cell, ContractProvider } from '@ton/core';
import { NftContent, parseMeta } from '../../meta';
import { CommonContractBase } from './abcCommon';

export type ContentConfig = {
    collectionContent: Cell,
    commonContent: Cell;
};

export function contentConfigToCell(config: ContentConfig) {
    return beginCell()
        .storeRef(config.collectionContent)
        .storeRef(config.commonContent)
        .endCell();
}

export type NftMinterOpcodesType = {}


export abstract class NftMinterContractBase<T extends NftMinterOpcodesType> extends CommonContractBase {
    constructor(readonly opCodes: T, readonly address: Address, readonly init?: { code: Cell; data: Cell; }) { 
        super(address, init)
    }
    
    async getCollectionData(provider: ContractProvider) {
        const result = await provider.get('get_collection_data', []);
        const res = {
            index: result.stack.readBigNumber(),
            content: parseMeta<NftContent>(result.stack.readCell()),
            owner:result.stack.readAddress()
        }
        return res
    }

    async getCollectionDataRaw(provider: ContractProvider) {
        const result = await provider.get('get_collection_data', []);
        const res = {
            index: result.stack.readBigNumber(),
            content: result.stack.readCell(),
            owner:result.stack.readAddress()
        }
        return res
    }

    async getNftAddress(provider: ContractProvider, index: bigint | number) {
        const getArgs = {
            type: 'int',
            value: BigInt(index)
        } as const;
        const result = await provider.get('get_nft_address_by_index', [getArgs]);
        return result.stack.readAddress();
    }

    async getNftContent(provider: ContractProvider, opts: {
        index: bigint | number,
        individualContent: Cell;
    }) {

        const result = await provider.get('get_nft_content', [{
            type: 'int',
            value: BigInt(opts.index)
        },
        {
            type: 'cell',
            cell: opts.individualContent
        }]);

        return parseMeta<NftContent>(result.stack.readCell())
    }
}
