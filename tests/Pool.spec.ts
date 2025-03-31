import { compile } from '@ton/blueprint';
import { Address, Cell, toNano } from '@ton/core';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import '@ton/test-utils';
import { randomAddress } from '@ton/test-utils';
import 'dotenv/config';
import { preprocBuildContractsLocal } from '../helpers/helpers';
import { Pool } from '../wrappers/Pool';
import { kMaxLength } from 'buffer';
import { exit } from 'process';
import { buffer } from 'stream/consumers';
import { SLIM_CONFIG_LEGACY } from '../libs/src/test-helpers';

type SBCtrTreasury = SandboxContract<TreasuryContract>;
type SBCtrPool = SandboxContract<Pool>;
const HOUR_IN_SECONDS = 3600;

describe('Pool', () => {
    let code: { lpWallet: Cell; lpAccount: Cell; pool: Cell; },
        bc: Blockchain,
        router: SBCtrTreasury,
        leftJetton: SBCtrTreasury,
        rightJetton: SBCtrTreasury,
        pool: SBCtrPool,
        initTimestamp = Math.floor(Date.now() / 1000),
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
            lpAccount: await compile('LPAccount'),
            lpWallet: await compile('LPWallet'),
            pool: await compile('Pool')
        };
        router = await bc.treasury('router');
        user = await bc.treasury('user');
        leftJetton = await bc.treasury('leftJetton');
        rightJetton = await bc.treasury('rightJetton');

        pool = bc.openContract(Pool.createFromConfig({
            routerAddress: router.address,
            lpFee: 10n,
            protocolFee: 10n,
            protocolFeeAddress: randomAddress(),
            collectedLeftJettonProtocolFees: 0n,
            collectedRightJettonProtocolFees: 0n,
            leftReserve: 10000n,
            rightReserve: 10000n,
            leftWalletAddress: leftJetton.address,
            rightWalletAddress: rightJetton.address,
            totalSupplyLP: 10000n,
            LPAccountCode: code.lpAccount,
            LPWalletCode: code.lpWallet
        }, code.pool));

        const deployPoolResult = await pool.sendDeploy(router.getSender(), toNano('0.05'));
        expect(deployPoolResult.transactions).toHaveTransaction({
            from: router.address,
            to: pool.address,
            deploy: true,
        });
    });

    describe('Router calls', () => {
        it('should refund swap if tx is expired', async () => {
            const expiredTs = initTimestamp + 60 * 10;

            advanceFromCurrentTS(60 * 15);
            
            const sendSwapResult = await pool.sendSwap(router.getSender(), {
                leftAmount: toNano("100"),
                rightAmount: toNano("0"),
                fromAddress: user.address,
                deadline: expiredTs,
            }, toNano('0.3'));

            expect(sendSwapResult.transactions).toHaveTransaction({
                from: pool.address,
                to: router.address,
                body: (x) => {
                    const body = x?.asSlice();
                    body?.skip(32 + 64);
                    const toAddress = body?.loadAddress();
                    const excessesAddress = body?.loadAddress();
                    const originalAddress = body?.loadAddress();
                    const exitCode = body?.loadUint(32);
                    const _ = body?.loadMaybeRef();
                    const dexPayload = body?.loadRef().asSlice();
                    const tonFwdAmount = dexPayload?.loadCoins();
                    const leftAmount = dexPayload?.loadCoins();

                    return Boolean(toAddress?.equals(user.address) 
                        && excessesAddress?.equals(user.address)
                        && originalAddress?.equals(user.address)
                        && exitCode == 0x1ec28412
                        && tonFwdAmount == 0n
                        && leftAmount == toNano("100"));
                },
                exitCode: 0
            });
        });

        it('should refund provide lp if tx is expired', async () => {
            const expiredTs = initTimestamp + 60 * 10;

            advanceFromCurrentTS(60 * 15);
            
            const sendProvideLpResult = await pool.sendProvideLiquidity(router.getSender(), {
                leftAmount: toNano("100"),
                rightAmount: toNano("0"),
                fromAddress: user.address,
                deadline: expiredTs,
            }, toNano('0.3'));

            expect(sendProvideLpResult.transactions).toHaveTransaction({
                from: pool.address,
                to: router.address,
                body: (x) => {
                    const body = x?.asSlice();

                    body?.skip(32 + 64);
                    const toAddress = body?.loadAddress();
                    const excessesAddress = body?.loadAddress();
                    const originalAddress = body?.loadAddress();
                    const exitCode = body?.loadUint(32);
                    const _ = body?.loadMaybeRef();
                    const dexPayload = body?.loadRef().asSlice();
                    const tonFwdAmount = dexPayload?.loadCoins();
                    const leftAmount = dexPayload?.loadCoins();

                    return Boolean(toAddress?.equals(user.address) 
                        && excessesAddress?.equals(user.address)
                        && originalAddress?.equals(user.address)
                        && exitCode == 0xd6a53fd8
                        && tonFwdAmount == 0n
                        && leftAmount == toNano("100"));
                },
                exitCode: 0
            });
        });

        it('should bounce if tokens are the same', async () => {
            pool = bc.openContract(Pool.createFromConfig({
                routerAddress: router.address,
                lpFee: 10n,
                protocolFee: 10n,
                protocolFeeAddress: randomAddress(),
                collectedLeftJettonProtocolFees: 0n,
                collectedRightJettonProtocolFees: 0n,
                leftReserve: 10000n,
                rightReserve: 10000n,
                leftWalletAddress: rightJetton.address,
                rightWalletAddress: rightJetton.address,
                totalSupplyLP: 10000n,
                LPAccountCode: code.lpAccount,
                LPWalletCode: code.lpWallet
            }, code.pool));

            const deployPoolResult = await pool.sendGetterPoolData(router.getSender(), toNano('0.05'));
            expect(deployPoolResult.transactions).toHaveTransaction({
                from: router.address,
                to: pool.address,
                deploy: true,
                exitCode: 95
            });
        });
    });

    describe('Getters', () => {
        it('should generate valid URI', async () => {
            const getJettonData = await pool.getJettonData();
            expect(typeof getJettonData.content).toBe("string");
        });
    });
});
