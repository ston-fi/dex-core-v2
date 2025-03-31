import { compile } from '@ton/blueprint';
import { beginCell, Cell, toNano } from '@ton/core';
import { Blockchain, createShardAccount, SandboxContract, TreasuryContract } from '@ton/sandbox';
import '@ton/test-utils';
import 'dotenv/config';
import { AddressMap, buildLibFromCell, buildLibs, stdNftOpCodes } from '../libs';
import { createMdGraphLocal, getLpAccDataNoFail, preprocBuildContractsLocal } from '../helpers/helpers';
import { expectNotBounced, SLIM_CONFIG_LEGACY } from '../libs/src/test-helpers';
import { LPAccount } from '../wrappers/LPAccount';
import { LPWallet } from '../wrappers/LPWallet';
import { Pool, poolConfigToCell } from '../wrappers/Pool';
import { crossSwapPayload, Router } from '../wrappers/Router';

type SBCtrTreasury = SandboxContract<TreasuryContract>;
type SBCtrRouter = SandboxContract<Router>;
type SBCtrPool = SandboxContract<Pool>;
const HOUR_IN_SECONDS = 3600;

describe('System', () => {
    let code: { router: Cell; lpWallet: Cell; lpAccount: Cell; pool: Cell; vault: Cell; },
        myLibs: Cell | undefined,
        bc: Blockchain,
        initTimestamp = Math.floor(Date.now() / 1000),
        admin: SBCtrTreasury,
        firstJettonWallet: SBCtrTreasury,
        secondJettonWallet: SBCtrTreasury,
        router: SBCtrRouter,
        pool: SBCtrPool;

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

        const _code = {
            router: await compile('Router'),
            lpAccount: await compile('LPAccount'),
            lpWallet: await compile('LPWallet'),
            pool: await compile('Pool'),
            vault: await compile('Vault')
        };

        myLibs = buildLibs(_code);

        code = {
            router: buildLibFromCell(_code.router, "build/router.json"),
            lpWallet: buildLibFromCell(_code.lpWallet, "build/lpWallet.json"),
            lpAccount: buildLibFromCell(_code.lpAccount, "build/lpAccount.json"),
            pool: buildLibFromCell(_code.pool, "build/pool.json"),
            vault: buildLibFromCell(_code.vault, "build/vault.json")
        };
    });

    beforeEach(async () => {
        bc = await Blockchain.create({ config: SLIM_CONFIG_LEGACY });
        bc.libs = myLibs;
        setFromInitTimestamp(0);

        admin = await bc.treasury('admin');
        firstJettonWallet = await bc.treasury('firstJettonWallet');
        secondJettonWallet = await bc.treasury('secondJettonWallet');

        router = bc.openContract(Router.createFromConfig({
            id: 0,
            isLocked: false,
            adminAddress: admin.address,
            lpAccountCode: code.lpAccount,
            lpWalletCode: code.lpWallet,
            poolCode: code.pool,
            vaultCode: code.vault
        }, code.router));

        const deployRouterResult = await router.sendDeploy(admin.getSender(), toNano('5'));
        expect(deployRouterResult.transactions).toHaveTransaction({
            from: admin.address,
            to: router.address,
            deploy: true,
        });
    });

    describe('Dex', () => {
        beforeEach(async () => {
            // initialize pair
            const sendFirstLPOk = await router.sendProvideLiquidity(firstJettonWallet.getSender(), {
                jettonAmount: 1000n,
                fromAddress: admin.address,
                otherWalletAddress: secondJettonWallet.address,
                deadline: initTimestamp + HOUR_IN_SECONDS,
            });

            pool = bc.openContract(Pool.createFromAddress(await router.getPoolAddress({
                firstWalletAddress: firstJettonWallet.address,
                secondWalletAddress: secondJettonWallet.address
            })));
            await pool.sendDeploy(admin.getSender(), toNano('1.1'));
            const sendSecondLPOk = await router.sendProvideLiquidity(secondJettonWallet.getSender(), {
                jettonAmount: 2000n,
                minLPOut: 1n,
                fromAddress: admin.address,
                otherWalletAddress: firstJettonWallet.address,
                deadline: initTimestamp + HOUR_IN_SECONDS,
            });

            createMdGraphLocal({
                msgResult: sendFirstLPOk,
                output: "sendFirstLPOk",
                folderPath: "build/graph_system/"
            });

            createMdGraphLocal({
                msgResult: sendSecondLPOk,
                output: "sendSecondLPOk",
                folderPath: "build/graph_system/"

            });
        });

        it('should handle mint & burn liquidity', async () => {
            // provide for user
            await router.sendProvideLiquidity(firstJettonWallet.getSender(), {
                jettonAmount: toNano('1'),
                fromAddress: admin.address,
                otherWalletAddress: secondJettonWallet.address,
                minLPOut: 0n,
                bothPositive: true,
                deadline: initTimestamp + HOUR_IN_SECONDS,
            });

            const lpAccAddress = await pool.getLPAccountAddress({ userAddress: admin.address });
            const lpAccount = bc.openContract(LPAccount.createFromAddress(lpAccAddress));

            let lpAccountData = await lpAccount.getLPAccountData();
            expect(lpAccountData.leftAmount).toBe(toNano(0));
            expect(lpAccountData.rightAmount).toBe(toNano(1));

            const sendProvideLPResult = await router.sendProvideLiquidity(secondJettonWallet.getSender(), {
                jettonAmount: toNano('2'),
                fromAddress: admin.address,
                otherWalletAddress: firstJettonWallet.address,
                minLPOut: 1n,
                bothPositive: true,
                toAddress: admin.address,
                deadline: initTimestamp + HOUR_IN_SECONDS,
            });
            createMdGraphLocal({
                msgResult: sendProvideLPResult,
                output: "sendProvideLPResult",
                chartType: "LR",
                folderPath: "build/graph_system/"
            });
            expect((await getLpAccDataNoFail(lpAccount)).leftAmount).toBe(toNano(0));
            expect((await getLpAccDataNoFail(lpAccount)).rightAmount).toBe(toNano(0));

            const lpWalAddress = await pool.getWalletAddress(admin.address);
            const lpWallet = bc.openContract(LPWallet.createFromAddress(lpWalAddress));
            expect(sendProvideLPResult.transactions).toHaveTransaction({
                from: pool.address,
                to: lpWallet.address,
            });

            const sendBurnLPResult = await lpWallet.sendBurnExt(admin.getSender(), {
                jettonAmount: (await lpWallet.getWalletData()).balance,
                customPayload: {
                    leftPayload: beginCell().storeUint(10, 16).endCell(),
                    rightPayload: beginCell().storeUint(12, 16).endCell()
                }
            });

            expect(sendBurnLPResult.transactions).toHaveTransaction({
                from: router.address,
                to: firstJettonWallet.address,
                body: (val) => {
                    const body = val?.asSlice();
                    const jettonAmount = body?.skip(32 + 64).loadCoins() as bigint;
                    const payload = body?.loadRef().asSlice().loadUint(16);
                    return jettonAmount > 1n && payload == 12;
                }
            });
            expect(sendBurnLPResult.transactions).toHaveTransaction({
                from: router.address,
                to: secondJettonWallet.address,
                body: (val) => {
                    const body = val?.asSlice();
                    const jettonAmount = body?.skip(32 + 64).loadCoins() as bigint;
                    const payload = body?.loadRef().asSlice().loadUint(16);
                    return jettonAmount > 1n && payload == 10;
                }
            });
        });

        it('should handle refund partial liquidity', async () => {
            await router.sendProvideLiquidity(firstJettonWallet.getSender(), {
                jettonAmount: toNano('1'),
                fromAddress: admin.address,
                otherWalletAddress: secondJettonWallet.address,
                deadline: initTimestamp + HOUR_IN_SECONDS,
            });

            const lpAccAddress = await pool.getLPAccountAddress({ userAddress: admin.address });
            const lpAccount = bc.openContract(LPAccount.createFromAddress(lpAccAddress));

            let lpAccountData = await lpAccount.getLPAccountData();
            expect(lpAccountData.leftAmount).toBe(toNano(0));
            expect(lpAccountData.rightAmount).toBe(toNano(1));

            const sendRefundResult = await lpAccount.sendRefundMe(admin.getSender(), {
                rightMaybePayload: beginCell()
                    .storeUint(10, 16)
                    .endCell()
            });

            expect(sendRefundResult.transactions).toHaveTransaction({
                from: router.address,
                to: firstJettonWallet.address,
                body: (val) => {
                    const body = val?.asSlice();
                    return body?.skip(32 + 64).loadCoins() == toNano(1n) &&
                        body?.loadRef().asSlice().loadUint(16) == 10;
                },
            });
        });

        it('should handle swaps', async () => {
            const sendSwapResult = await router.sendSwap(secondJettonWallet.getSender(), {
                jettonAmount: 100n,
                fromAddress: admin.address,
                otherWalletAddress: firstJettonWallet.address,
                deadline: initTimestamp + HOUR_IN_SECONDS,
            });

            expect(sendSwapResult.transactions).toHaveTransaction({
                from: router.address,
                to: firstJettonWallet.address,
            });
        });

        it('should handle invalid transfers', async () => {
            const sendInvalidResult = await router.sendInvalidReq(secondJettonWallet.getSender(), {
                jettonAmount: 100n,
                fromAddress: admin.address,
            });

            expect(sendInvalidResult.transactions).toHaveTransaction({
                from: router.address,
                to: secondJettonWallet.address,
            });
        });

        it('should handle cross swap', async () => {
            const thirdJettonWallet = await bc.treasury('thirdJettonWallet');
            // initialize second pair
            await router.sendProvideLiquidity(secondJettonWallet.getSender(), {
                jettonAmount: 1004n,
                fromAddress: admin.address,
                otherWalletAddress: thirdJettonWallet.address,
                deadline: initTimestamp + HOUR_IN_SECONDS,
            });
            const pool2 = bc.openContract(Pool.createFromAddress(await router.getPoolAddress({
                firstWalletAddress: secondJettonWallet.address,
                secondWalletAddress: thirdJettonWallet.address
            })));
            let r = await pool2.sendDeploy(admin.getSender(), toNano('1.1'));
            let addressMap = new AddressMap<string>();
            addressMap.set(admin, "admin");
            addressMap.set(pool2, "pool2");
            createMdGraphLocal({
                msgResult: r,
                addressMap: addressMap,
                output: "pool",
                folderPath: "build/graph_system/"
            });
            expectNotBounced(r.events);
            await router.sendProvideLiquidity(thirdJettonWallet.getSender(), {
                jettonAmount: 1001n,
                minLPOut: 1n,
                fromAddress: admin.address,
                otherWalletAddress: secondJettonWallet.address,
                deadline: initTimestamp + HOUR_IN_SECONDS,
            });

            // send first -> second -> third
            const sendCrossSwapResult = await router.sendSwap(firstJettonWallet.getSender(), {
                jettonAmount: 10n,
                fromAddress: admin.address,
                otherWalletAddress: secondJettonWallet.address,
                deadline: initTimestamp + HOUR_IN_SECONDS,
                customPayload: crossSwapPayload({
                    otherTokenWallet: thirdJettonWallet.address,
                    receiver: admin.address,
                    refundAddress: admin.address,
                    excessesAddress: admin.address,
                    deadline: initTimestamp + HOUR_IN_SECONDS,
                })
            });

            createMdGraphLocal({
                msgResult: sendCrossSwapResult,
                addressMap: addressMap,
                output: "cross_swap_system",
                folderPath: "build/graph_system/"
            });
            expect(sendCrossSwapResult.transactions).toHaveTransaction({
                from: pool.address,
                to: router.address,
            });
            expect(sendCrossSwapResult.transactions).toHaveTransaction({
                from: router.address,
                to: pool2.address
            });
            expect(sendCrossSwapResult.transactions).toHaveTransaction({
                from: pool2.address,
                to: router.address,
                success: true
            });
            expect(sendCrossSwapResult.transactions).toHaveTransaction({
                from: router.address,
                to: thirdJettonWallet.address,
            });
        });
    });

    describe('Governance', () => {
        beforeEach(async () => {
            // initialize pool
            await router.sendProvideLiquidity(firstJettonWallet.getSender(), {
                jettonAmount: 1001n,
                fromAddress: admin.address,
                otherWalletAddress: secondJettonWallet.address,
                deadline: initTimestamp + HOUR_IN_SECONDS,
            });
            pool = bc.openContract(Pool.createFromAddress(await router.getPoolAddress({
                firstWalletAddress: firstJettonWallet.address,
                secondWalletAddress: secondJettonWallet.address
            })));
            await pool.sendDeploy(admin.getSender(), toNano('1.1'));
        });

        it('should reset pool gas', async () => {
            const sendResetPoolGasResult = await router.sendResetPoolGas(admin.getSender(), {
                firstWalletAddress: firstJettonWallet.address,
                secondWalletAddress: secondJettonWallet.address
            });
            expect(sendResetPoolGasResult.transactions).toHaveTransaction({
                from: pool.address,
                to: admin.address,
                op: stdNftOpCodes.excesses
            });

            expect((await bc.getContract(pool.address)).balance).toBe(10000000n);
        });

        it('should reset pool gas (different address)', async () => {
            const balanceBefore = (await bc.getContract(router.address)).balance;
            const sendResetPoolGasResult = await router.sendResetPoolGas(admin.getSender(), {
                firstWalletAddress: firstJettonWallet.address,
                secondWalletAddress: secondJettonWallet.address,
                excessesAddress: router.address
            });
            expect(sendResetPoolGasResult.transactions).toHaveTransaction({
                from: pool.address,
                to: router.address,
                op: stdNftOpCodes.excesses
            });
            const balanceAfter = (await bc.getContract(router.address)).balance;

            expect((await bc.getContract(pool.address)).balance).toBe(10000000n);
            expect(balanceBefore).toBeLessThan(balanceAfter);
        });

        it('should reset router gas', async () => {
            await router.sendDeploy(admin.getSender(), toNano('10'));
            const sendResetGasResult = await router.sendResetGas(admin.getSender());
            expect(sendResetGasResult.transactions).toHaveTransaction({
                from: router.address,
                to: admin.address,
            });
            expect((await bc.getContract(router.address)).balance).toBe(10000000n);
        });

        it('should lock & unlock pool', async () => {
            let poolData = await pool.getPoolData();
            expect(poolData.isLocked).toBe(false);

            const sendUpdatePoolStatusResult = await router.sendUpdatePoolStatus(admin.getSender(), {
                firstWalletAddress: firstJettonWallet.address,
                secondWalletAddress: secondJettonWallet.address
            });
            expect(sendUpdatePoolStatusResult.transactions).toHaveTransaction({
                from: router.address,
                to: pool.address,
                exitCode: 0
            });

            poolData = await pool.getPoolData();
            expect(poolData.isLocked).toBe(true);

            const _ = await router.sendUpdatePoolStatus(admin.getSender(), {
                firstWalletAddress: firstJettonWallet.address,
                secondWalletAddress: secondJettonWallet.address
            });

            poolData = await pool.getPoolData();
            expect(poolData.isLocked).toBe(false);
        });

        it('should set fees', async () => {
            const sendSetFeesResult = await router.sendSetFees(admin.getSender(), {
                newLPFee: 10n,
                newProtocolFee: 11n,
                newProtocolFeeAddress: admin.address,
                leftWalletAddress: firstJettonWallet.address,
                rightWalletAddress: secondJettonWallet.address,
            });

            expect(sendSetFeesResult.transactions).toHaveTransaction({
                from: router.address,
                to: pool.address,
            });
            expect(sendSetFeesResult.transactions).toHaveTransaction({
                from: pool.address,
                to: admin.address,
                op: stdNftOpCodes.excesses
            });
            let poolData = await pool.getPoolData();
            expect(poolData.lpFee).toBe(10n);
            expect(poolData.protocolFee).toBe(11n);
        });

        it('should collect fees', async () => {
            await bc.setShardAccount(pool.address, createShardAccount({
                address: pool.address,
                code: code.pool,
                balance: toNano(10),
                workchain: 0,
                data: poolConfigToCell({
                    routerAddress: router.address,
                    lpFee: 10n,
                    protocolFee: 10n,
                    protocolFeeAddress: admin.address,
                    collectedLeftJettonProtocolFees: toNano(11),
                    collectedRightJettonProtocolFees: toNano(10),
                    leftReserve: toNano(100000),
                    rightReserve: toNano(100000),
                    leftWalletAddress: (await pool.getPoolData()).leftJettonAddress,
                    rightWalletAddress: (await pool.getPoolData()).rightJettonAddress,
                    totalSupplyLP: 10000n,
                    LPWalletCode: code.lpWallet,
                    LPAccountCode: code.lpAccount
                })
            }));

            const sendCollectFeesResult = await pool.sendCollectFees(admin.getSender(), {
                leftCustomPayload: crossSwapPayload({
                    otherTokenWallet: (await pool.getPoolData()).rightJettonAddress,
                    receiver: admin.address,
                    refundAddress: admin.address,
                    excessesAddress: admin.address,
                    minOut: 1n,
                    deadline: initTimestamp + HOUR_IN_SECONDS,
                })
            }, toNano('1.1'));

            expect(sendCollectFeesResult.transactions).toHaveTransaction({
                from: router.address,
                to: firstJettonWallet.address,
                body: (val) => {
                    return val?.asSlice().skip(32 + 64).loadCoins() == toNano(10);
                },
            });

            expect(sendCollectFeesResult.transactions).toHaveTransaction({
                from: router.address,
                to: firstJettonWallet.address,
                body: (val) => {
                    return (val as Cell).asSlice().skip(32 + 64).loadCoins() > 0n;
                },
            });

            let poolData = await pool.getPoolData();
            expect(poolData.collectedLeftJettonProtocolFees).toBe(0n);
            expect(poolData.collectedRightJettonProtocolFees).toBe(10987793n);; // collected during swap
        });
    });
});