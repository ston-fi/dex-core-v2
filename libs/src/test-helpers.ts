import '@ton/test-utils';

import {
    Blockchain,
    Event,
    SandboxContract,
    TreasuryContract,
} from '@ton/sandbox';

import {
    Address,
    Cell,
    Contract
} from '@ton/core';
import { JettonMinterContract } from './wrappers/JettonMinter';
import { JettonWalletContract } from './wrappers/JettonWallet';

export function expectEqAddress(received: Address | SandboxContract<Contract> | null, compare: Address | SandboxContract<Contract> | null) {
    if (received === null || compare === null) {
        expect(compare).toEqual(null);
        expect(received).toEqual(null);
        return;
    }
    if (!(received instanceof Address)) {
        // @ts-ignore
        received = received.address;
    }
    if (!(compare instanceof Address)) {
        // @ts-ignore
        compare = compare.address;
    }
    expect(received.toString()).toEqual(compare.toString());
}
export function expectNullAddress(received: Address | null) {
    expect(received).toEqual(null);
}

export function expectNotBounced(eventOrEvents: Event[] | Event) {
    if (Array.isArray(eventOrEvents)) {
        for (let event of eventOrEvents) {
            if (event.type === "message_sent") {
                expect(event.bounced).toBeFalsy();
            }
        }
    } else if (eventOrEvents.type === "message_sent") {
        expect(eventOrEvents.bounced).toBeFalsy();
    }
}

export function expectBounced(eventOrEvents: Event[] | Event) {
    if (Array.isArray(eventOrEvents)) {
        let flag = 0;
        for (let event of eventOrEvents) {
            if (event.type === "message_sent") {
                flag += Number(event.bounced);

            }
        }
        expect(flag).toBeTruthy();

    } else if (eventOrEvents.type === "message_sent") {
        expect(eventOrEvents.bounced).toBeTruthy();
    }
}

export function firstCreatedAddress(events: Event[]): Address | null {
    for (let event of events) {
        if (event.type === "account_created") {
            return event.account as Address;
        }
    }
    return null;
}

export function expectContainsAddress(addressList: Address[], address: Address) {
    let res = false;
    for (let addr of addressList) {
        res = addr.toString() === address.toString() ? true : res;
    }
    expect(res).toBeTruthy();
}

export function expectNotContainsAddress(addressList: Address[], address: Address) {
    let res = false;
    for (let addr of addressList) {
        res = addr.toString() === address.toString() ? true : res;
    }
    expect(res).toBeFalsy();
}


export async function getWalletContract(blockchain: Blockchain, token: SandboxContract<JettonMinterContract>, user: Address | SandboxContract<TreasuryContract>) {
    if (!(user instanceof Address)) {
        user = user.address;
    }
    const walletAddress = await token.getWalletAddress(user);
    return blockchain.openContract(JettonWalletContract.createFromAddress(walletAddress));
}

export function expectEqualCell(cell1: Cell, cell2: Cell) {
    let res = cell1.equals(cell2)
    expect(res).toBeTruthy();
}

export function checkEqKeys<T extends Object>(source: T, target: T, exceptKeys?: Array<keyof T>) {
    for (let key in source) {
        if (exceptKeys?.includes(key)) continue

        if (source[key] === target[key]) {
            expect(source[key]).toEqual(target[key])
        } else if (source[key]?.toString() === target[key]?.toString()) {
            expect(source[key]?.toString()).toEqual(target[key]?.toString())
        } else {
            expect(`${key}: ${source[key]}`).toEqual(`${key}: ${target[key]}`)
        }
    }
}

// config with old gas values
export const SLIM_CONFIG_SEQNO_LEGACY = 36964449;
export const SLIM_CONFIG_LEGACY = Cell.fromBase64(`te6cckECeAEABZwAAgPNwC8BAgEgGwICASAWAwIBIBEEAQFYBQEBwAYCASAIBwBDv+6SYlD5XEfFuCmona5jYtGN4iWVOW5abGAZxXh4ab9iwAIBIAoJAEK/jVwCELNdrdqiGfrEWdug/e+x+uTpeg0Hl3Of4FDWlMoCASAOCwIBWA0MAEG+3N3+hWqZxcuAeEGZwHcL6jHyjg1zOPc3hEgN70TNkBQAQb7ZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZnAIBSBAPAEG+9ev/zlOHA3TxFUSRetc6kI1OtRpUBKdHCsPbA17dsxQAA99wAgEgFBIBASATAErZAQMAAAfQAAA+gAAAAAMAAAAIAAAABAAgAAAAIAAAAAIAACcQAQEgFQAkwgEAAAD6AAAA+gAAA+gAAAAXAgFIGRcBASAYAELqAAAAAAAPQkAAAAAAA+gAAAAAAAGGoAAAAAGAAFVVVVUBASAaAELqAAAAAACYloAAAAAAJxAAAAAAAA9CQAAAAAGAAFVVVVUCASAnHAIBICIdAgEgIB4BASAfAFBdwwACAAAACAAAABAAAMMAHoSAAJiWgAExLQDDAAAD6AAAE4gAACcQAQEgIQBQXcMAAgAAAAgAAAAQAADDAAMNQAAPQkAAJiWgwwAAA+gAABOIAAAnEAIBICUjAQEgJACU0QAAAAAAAABkAAAAAAABhqDeAAAAAAPoAAAAAAAAAA9CQAAAAAAAD0JAAAAAAAAAJxAAAAAAAJiWgAAAAAAF9eEAAAAAADuaygABASAmAJTRAAAAAAAAAGQAAAAAAA9CQN4AAAAAJxAAAAAAAAAAD0JAAAAAAAIWDsAAAAAAAAAnEAAAAAAAJiWgAAAAAAX14QAAAAAAO5rKAAIBICooAQFIKQBN0GYAAAAAAAAAAAAAAACAAAAAAAAA+gAAAAAAAAH0AAAAAAAD0JBAAgEgLSsBASAsADdwEQ2TFuwAByOG8m/BAACAEKdBpGJ4AAAAMAAIAQEgLgAMAZAAZABLAgEgZDACASA9MQIBIDcyAgEgNTMBASA0ACAAAQAAAACAAAAAIAAAAIAAAQEgNgAUa0ZVPxAEO5rKAAIBIDo4AQEgOQATGkO5rKABASAfSAEBIDsBAcA8ALfQUy7nTs8AAAJwACrYn7aHDoYaZOELB7fIx0lsFfzu58bxcmSlH++c6KojdwX2/yWZOw/Zr08OxAx1OQZWjQc9ppdrOeJEc5dIgaEAAAAAD/////gAAAAAAAAABAIBIE0+AgEgQz8BASBAAgKRQkEAKjYEBwMFAExLQAExLQAAAAACAAAD6AAqNgIGAgUAD0JAAJiWgAAAAAEAAAH0AQEgRAIBIEhFAgm3///wYEdGAAHcAAH8AgLZS0kCAWJKVAIBIF5eAgEgWUwCAc5hYQIBIGJOAQEgTwIDzUBRUAADqKACASBZUgIBIFZTAgEgVVQAAdQCAUhhYQIBIFhXAgEgXFwCASBcXgIBIGBaAgEgXVsCASBeXAIBIGFhAgEgX14AAUgAAVgCAdRhYQABIAEBIGMAGsQAAAAGAAAAAAAAAC4CASBwZQIBIGtmAQFYZwEBwGgCASBqaQAVv////7y9GpSiABAAFb4AAAO8s2cNwVVQAgEgbmwBASBtAFMB//////////////////////////////////////////+AAAAAgAAAAUABASBvAEDlZ1T4NCb2mwkme9h2rJfESCE0W34ma9lWp7+/uY3zXAIBIHNxAQFIcgBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACASB2dAEBIHUAQDMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzAQEgdwBAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVvyxj8`)