import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';

import { compile } from '@ton/blueprint';
import { Cell, toNano } from '@ton/core';
import '@ton/test-utils';
import { randomAddress } from '@ton/test-utils';
import 'dotenv/config';
import { preprocBuildContractsLocal } from '../helpers/helpers';
import { Router } from '../wrappers/Router';
import { SLIM_CONFIG_LEGACY } from '../libs/src/test-helpers';

type SBCtrTreasury = SandboxContract<TreasuryContract>;
type SBCtrRouter = SandboxContract<Router>;
const HOUR_IN_SECONDS = 3600;

describe('Router', () => {
    let code: { router: Cell; lpWallet: Cell; lpAccount: Cell; pool: Cell; vault: Cell; },
        bc: Blockchain,
        initTimestamp = Math.floor(Date.now() / 1000),
        admin: SBCtrTreasury,
        router: SBCtrRouter,
        user: SBCtrTreasury;

    const setFromInitTimestamp = (amount: number) => {
        bc.now = initTimestamp + amount;
    };

    const advanceFromCurrentTS = (amount: number) => {
        if (typeof bc.now === "undefined") {
            throw new Error("blockchain time not manually set");
        }
        bc.now = bc.now + amount;
    };

    beforeAll(async () => {
        preprocBuildContractsLocal({
            defaultProtocolFee: null,
            defaultIsLocked: null,
            defaultLPFee: null,
            dexType: "constant_product"
        });

        bc = await Blockchain.create({ config: SLIM_CONFIG_LEGACY });
        setFromInitTimestamp(0);
        code = {
            router: await compile('Router'),
            lpAccount: await compile('LPAccount'),
            lpWallet: await compile('LPWallet'),
            pool: await compile('Pool'),
            vault: await compile('Vault')
        };
        admin = await bc.treasury('admin');
        user = await bc.treasury('user');

        router = bc.openContract(Router.createFromConfig({
            id: 0,
            isLocked: false,
            adminAddress: admin.address,
            lpAccountCode: code.lpAccount,
            lpWalletCode: code.lpWallet,
            poolCode: code.pool,
            vaultCode: code.vault
        }, code.router));

        const deployRouterResult = await router.sendDeploy(admin.getSender(), toNano('0.05'));
        expect(deployRouterResult.transactions).toHaveTransaction({
            from: admin.address,
            to: router.address,
            deploy: true,
        });
    });

    describe('Governance', () => {
        it('should handle lock & unlock', async () => {
            const sendLockResult = await router.sendUpdateStatus(admin.getSender());
            expect(sendLockResult.transactions).toHaveTransaction({
                from: admin.address,
                to: router.address,
                success: true
            });

            const sendSwapResult = await router.sendSwap(user.getSender(), {
                jettonAmount: 1n,
                fromAddress: admin.address,
                otherWalletAddress: randomAddress(),
                deadline: initTimestamp + HOUR_IN_SECONDS,
            });

            expect(sendSwapResult.transactions).toHaveTransaction({
                from: router.address,
                to: user.address,
                success: true,
                body: (val) => {
                    let body = val?.asSlice().skip(32 + 64);
                    body?.loadCoins();
                    body?.loadAddress();
                    body?.loadAddress();
                    body?.skip(1);
                    body?.loadCoins();
                    body?.skip(1);
                    return body?.loadUint(32) == 0xa0dbdcb;
                }
            });
            const sendUnlockResult = await router.sendUpdateStatus(admin.getSender());
            expect(sendUnlockResult.transactions).toHaveTransaction({
                from: admin.address,
                to: router.address,
                success: true
            });
        });

        it('should handle upgrades', async () => {
            bc.now = Math.floor(Date.now() / 1000);
            const sendInitAdminUpgradeResult = await router.sendInitAdminUpgrade(admin.getSender(), {
                newAdmin: user.address
            });
            expect(sendInitAdminUpgradeResult.transactions).toHaveTransaction({
                from: admin.address,
                to: router.address,
                success: true
            });
            bc.now = Math.floor(Date.now() / 1000) + (2 * 24 * 60 * 60) + 1; // two days

            const sendFinalizeUpgradesResult = await router.sendFinalizeUpgrades(admin.getSender());
            expect(sendFinalizeUpgradesResult.transactions).toHaveTransaction({
                from: admin.address,
                to: router.address,
                success: true
            });
            expect((await router.getRouterData()).adminAddress.toRawString()).toBe(user.address.toRawString());
        });

    });

    describe('Getters', () => {
        it('should return valid pool address', async () => {
            const leftAddr = randomAddress(), rightAddr = randomAddress();
            const getPoolAddr = await router.getPoolAddress({
                firstWalletAddress: leftAddr,
                secondWalletAddress: rightAddr
            });
            const sendResetPoolGasResult = await router.sendGetterPoolAddress(admin.getSender(), {
                leftWalletAddress: leftAddr,
                rightWalletAddress: rightAddr
            });
            expect(sendResetPoolGasResult.transactions).toHaveTransaction({
                from: router.address,
                to: admin.address,
                body: (val) => {
                    return val?.asSlice().skip(32 + 64).loadAddress().toRawString() == getPoolAddr.toRawString();
                },
            });
        });

        it('should return correct dex version', async () => {
            const getRouterVersion = await router.getRouterVersion();
            expect(getRouterVersion.major).toBe(2);
            expect(getRouterVersion.minor).toBe(2);
        });
    });
});
