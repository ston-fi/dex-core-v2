import { NetworkProvider } from '@ton/blueprint';
import { Address, Contract, OpenedContract, TupleReader } from "@ton/core";
import { TonClient, TonClient4 } from "@ton/ton";
import * as color from "./color";
import { JettonContent } from "./meta";
import { Optional } from "./types";
import { sleep } from "./utils";
import { JettonMinterContract } from "./wrappers/JettonMinter";
import { JettonData } from "./wrappers/abstract/abcJettonMinter";
import { tvmErrorCodes } from './codes';

export type Explorer = "tonscan" | "tonviewer" | "toncx" | "dton";

export type RunWithRetryOptions<T> = {
    maxAttempts?: number;
    startSleepTimeout?: number;
    sleepTimeout?: number;
    onError?: (error: unknown, attempt: number) => void;
}

export async function runWithRetry<T>(fn: () => Promise<T>, {startSleepTimeout, sleepTimeout, maxAttempts = 3, onError}: RunWithRetryOptions<T> = {}): Promise<T>  {
    if (maxAttempts < 1) {
        throw new Error('maxAttempts must be greater than 0');
    }

    if (startSleepTimeout) {
        await sleep(startSleepTimeout);
    }

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            onError?.(error, attempt + 1);

            if (attempt === maxAttempts - 1) {
                throw error;
            }

            if (sleepTimeout) {
                await sleep(sleepTimeout);
            }
        }
    }

    throw new Error('never');
}

export function getExpLink(provider: NetworkProvider, address: Address | null | undefined, explorer?: Explorer) {
    if ((address === undefined) || (address === null)) {
        return null;
    } else {
        const networkPrefix = provider.network() === "testnet" ? "testnet." : "";

        switch (explorer) {
            case "tonscan":
                return `https://${networkPrefix}tonscan.org/address/${address}`;
            case "tonviewer":
                return `https://${networkPrefix}tonviewer.com/${address}`;
            case "toncx":
                return `https://${networkPrefix}ton.cx/address/${address}`;
            case "dton":
                return `https://${networkPrefix}dton.io/a/${address}`;
            default:
                return `https://${networkPrefix}tonviewer.com/${address}`;
        }
    }
}

export async function getSeqNo(provider: NetworkProvider, address: Address, tries = 4) {
    const logger = color.loggerBuilder(provider);

    return await runWithRetry(async () => {
        if (await provider.isContractDeployed(address)) {
            let client = provider.api();
            let runGetMethod: (method: string) => Promise<[TupleReader, number]>
            if (client instanceof TonClient4) {
                runGetMethod = async (method: string) => { 
                    const res = await client.runMethod((await client.getLastBlock()).last.seqno, address, method)
                    return [res.reader, res.exitCode] as const
                }
            } else {
                runGetMethod = async (method: string) => { 
                    const res = await client.runMethod(address, method)
                    return [res.stack, 0] as const
                }
            }
            let seqno: number

            const res = await runGetMethod("seqno")
            seqno = res[0].readNumber()
            if ((seqno === 85143 && client instanceof TonClient) || (res[1] === tvmErrorCodes.getMethodNotFound11)) {
                const res = await runGetMethod("get_multisig_data")
                if (res[1] !== 0) {
                    throw new Error("method not found")
                }
                seqno = res[0].readNumber()
            }

            return seqno
        }

        return 0;
    }, {
        maxAttempts: tries,
        sleepTimeout: 100,
        onError(error, attempt) {
            logger(` - <r>Failed to call 'getSeqNo', retrying (${attempt}/${tries})...`);
        },
    });
}

export async function waitSeqNoChange(provider: NetworkProvider, target: Address, previousSeqno: number, maxAttempts: number = 75) {
    const logger = color.loggerBuilder(provider);
    logger(` - <y>Waiting up to <b>${maxAttempts} <y>seconds to confirm transaction`);
    try {
        await runWithRetry(async () => {
            const seqnoAfter = await getSeqNo(provider, target, 1);

            if (seqnoAfter > previousSeqno) {
                return true;
            }

            throw new Error("seqno isn't changed");
        }, {
            maxAttempts,
            sleepTimeout: 1000,
            startSleepTimeout: 1000,
        });

        logger(` - <g>Sent transaction done successfully`);
        return true;
    } catch (error) {
        logger(` - <r>Failed to confirm transaction was sent successfully`);
        return false;
    }
}

export async function awaitConfirmation(fn: () => Promise<boolean>, maxAttempts: number = 75) {
    color.log(` - <y>Waiting up to <b>${maxAttempts} <y>seconds to confirm operation`);

    try {
        return await runWithRetry(async () => {
            const res = await fn();

            if (!res) {
                throw new Error("state isn't changed");
            }

            return res;
        }, {
            maxAttempts,
            sleepTimeout: 1000,
            startSleepTimeout: 1000,
        });
    } catch (error) {
        color.log(` - <r>Error confirming operation`);
        return false;
    }
}

export async function getAccountBalance(provider: NetworkProvider, target: Address | OpenedContract<Contract>) {
    const targetAddress = target instanceof Address ? target : target.address;

    let client = provider.api();
    let data: string | bigint;

    if (client instanceof TonClient4) {
        data = (await client.getAccountLite((await client.getLastBlock()).last.seqno, targetAddress)).account.balance.coins;
    } else {
        data = await client.getBalance(targetAddress);
    }

    return BigInt(data);
}

export async function fetchJettonData(jetton: OpenedContract<JettonMinterContract>, removeRaw= true): Promise<Optional<JettonContent & JettonData & { decimals : number }, "contentRaw" | "jettonWalletCode" | "content">> {
    const fetchDataNoFail = async (url: string) => {
        try { 
            return (await fetch(url)).json();
        } catch (error) {
            color.log(` - <y><bld>WARNING: failed to fetch <b>${url}`);
            return {};
        }
    }
    
    let res: Optional<JettonContent & JettonData, "contentRaw" | "jettonWalletCode" | "content">
    
    let jData;
    try {
        jData = await jetton.getJettonData();
    } catch (error) {
        color.log(` - <r>ERROR: could not parse jetton data`);
        throw error;
    }
    res = {...jData}
    try {
        if (typeof jData.content === "string") {
            res = {
                ...(await fetchDataNoFail(jData.content)), 
                ...jData 
            } 
        } else {
            res = { 
                ...jData.content, 
                ...jData 
            }
            delete res["content"]
            if (res.uri) {
                res = { 
                    ...(await fetchDataNoFail(res.uri)), 
                    ...res 
                }
            }
        }
    } catch (error) {
        // noop
    }

    if (removeRaw) {
        delete res["contentRaw"];
        delete res["jettonWalletCode"];
    } 
    if (typeof res.decimals === "undefined") {
        color.log(` - <y><bld>WARNING: using default 9 decimals`);
        res.decimals = 9;
    }
    res.decimals = Number(res.decimals);
    // @ts-ignore
    return res
}

export type AccountState = "active" | "uninit" | "frozen";

export async function getAccountState(provider: NetworkProvider, target: Address | OpenedContract<Contract>) {
    const targetAddress = target instanceof Address ? target : target.address;

    let client = provider.api();
    let state: AccountState;
    if (client instanceof TonClient4) {
        state = (await client.getAccountLite((await client.getLastBlock()).last.seqno, targetAddress)).account.state.type;
    } else {
        const resState = (await client.getContractState(targetAddress)).state;
        state = resState === "uninitialized" ? "uninit" : resState;
    }

    return state;
} 

export async function waitForDeploy(provider: NetworkProvider, target: Address | OpenedContract<Contract> , maxAttempts: number = 75) {
    const logger = color.loggerBuilder(provider);
    const targetAddress = target instanceof Address ? target : target.address;

    logger(` - <y>Waiting up to <b>${maxAttempts} <y>seconds for deploy: <b>${getExpLink(provider, targetAddress)}`);

    try {
        await runWithRetry(async () => {
            const state = await getAccountState(provider, targetAddress)

            if (state === "active") {
                return true;
            }

            throw new Error("Account state isn't active");
        }, {
            maxAttempts,
            sleepTimeout: 1000,
            startSleepTimeout: 1000,
        });

        logger(` - <g>Deploy successful`);

        return true;
    } catch (error) {
        logger(` - <r>Failed to confirm deploy`);
        return false;
    }
}

export async function getAccount(provider: NetworkProvider, target: Address | OpenedContract<Contract>) {
    const targetAddress = target instanceof Address ? target : target.address;
    let client = provider.api();
    if (client instanceof TonClient) {
        throw new Error("TonClient does not support this method")
    }
    let data = await client.getAccount((await client.getLastBlock()).last.seqno, targetAddress)

    return {
        workchain: data.block.workchain,
        shard: data.block.shard,
        seqno: data.block.seqno,
        state: data.account.state.type,
        balance: BigInt(data.account.balance.coins),
        storage: {
            lastPaid: data.account.storageStat?.lastPaid ? data.account.storageStat.lastPaid : null,
            duePayment: data.account.storageStat?.duePayment ? BigInt(data.account.storageStat.duePayment) : null,
            bits: data.account.storageStat?.used.bits ? data.account.storageStat.used.bits : null,
            cells: data.account.storageStat?.used.cells ? data.account.storageStat.used.cells : null,
            publicCells: data.account.storageStat?.used.publicCells ? data.account.storageStat.used.publicCells : null,
        }

    }
} 