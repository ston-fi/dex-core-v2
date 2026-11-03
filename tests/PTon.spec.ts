import { Address, beginCell, Sender, SendMode, toNano } from '@ton/core';
import { PTonMinterV2 } from '../libs/src/wrappers/PTon';

const DEPLOY_WALLET_OP = 0x4f5f4313;

function parseDeployWalletBody(body: import("@ton/core").Cell) {
    const sc = body.beginParse();
    return {
        op: sc.loadUint(32),
        queryId: sc.loadUintBig(64),
        ownerAddress: sc.loadAddress(),
        excessesAddress: sc.loadAddress(),
    };
}

describe('PTonMinterV2.sendDeployWallet (issue #4)', () => {
    let minter: PTonMinterV2;
    let captured: { via: Sender; args: { value: bigint; sendMode: number; body: unknown } } | null;

    const provider = {
        internal: async (via: Sender, args: { value: bigint; sendMode: number; body: unknown }) => {
            captured = { via, args };
        },
    } as never;

    const ownerAddress = Address.parseRaw('0:0000000000000000000000000000000000000000000000000000000000000000');

    beforeEach(() => {
        minter = new PTonMinterV2(Address.parseRaw('0:0000000000000000000000000000000000000000000000000000000000000000'));
        captured = null;
    });

    const senderWithAddress: Sender = {
        address: Address.parseRaw('0:1111111111111111111111111111111111111111111111111111111111111111'),
        send: async () => {},
    };

    const senderWithoutAddress: Sender = {
        send: async () => {},
    } as never;

    it('throws when neither excessesAddress nor via.address is available', async () => {
        await expect(
            minter.sendDeployWallet(provider, senderWithoutAddress, { ownerAddress })
        ).rejects.toThrow(/excessesAddress is required/);

        expect(captured).toBeNull();
    });

    it('uses explicit excessesAddress when the Sender has no address', async () => {
        const excessesAddress = Address.parseRaw('0:2222222222222222222222222222222222222222222222222222222222222222');
        await minter.sendDeployWallet(provider, senderWithoutAddress, { ownerAddress, excessesAddress });

        expect(captured).not.toBeNull();
        const parsed = parseDeployWalletBody(captured!.args.body as never);
        expect(parsed.op).toBe(DEPLOY_WALLET_OP);
        expect(parsed.ownerAddress.equals(ownerAddress)).toBe(true);
        expect(parsed.excessesAddress.equals(excessesAddress)).toBe(true);
        expect(captured!.args.sendMode).toBe(SendMode.PAY_GAS_SEPARATELY);
    });

    it('falls back to via.address when excessesAddress is not provided', async () => {
        await minter.sendDeployWallet(provider, senderWithAddress, { ownerAddress });

        expect(captured).not.toBeNull();
        const parsed = parseDeployWalletBody(captured!.args.body as never);
        expect(parsed.op).toBe(DEPLOY_WALLET_OP);
        expect(parsed.ownerAddress.equals(ownerAddress)).toBe(true);
        expect(parsed.excessesAddress.equals(senderWithAddress.address!)).toBe(true);
    });

    it('prefers explicit excessesAddress over via.address', async () => {
        const excessesAddress = Address.parseRaw('0:2222222222222222222222222222222222222222222222222222222222222222');
        await minter.sendDeployWallet(provider, senderWithAddress, { ownerAddress, excessesAddress });

        const parsed = parseDeployWalletBody(captured!.args.body as never);
        expect(parsed.excessesAddress.equals(excessesAddress)).toBe(true);
    });

    it('defaults value to 1 TON', async () => {
        await minter.sendDeployWallet(provider, senderWithAddress, { ownerAddress });
        expect(captured!.args.value).toBe(toNano('1'));
    });
});
