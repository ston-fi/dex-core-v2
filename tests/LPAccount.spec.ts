import { compile } from '@ton/blueprint';
import { Cell, toNano } from '@ton/core';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import '@ton/test-utils';
import 'dotenv/config';
import { preprocBuildContractsLocal } from '../helpers/helpers';
import { LPAccount } from '../wrappers/LPAccount';
import { SLIM_CONFIG_LEGACY } from '../libs/src/test-helpers';
type SBCtrTreasury = SandboxContract<TreasuryContract>;
type SBCtrLPAccount = SandboxContract<LPAccount>;

describe('LPAccount', () => {
    let code: { lpAccount: Cell; },
        bc: Blockchain,
        pool: SBCtrTreasury,
        lpAcc: SBCtrLPAccount,
        user: SBCtrTreasury,
        owner: SBCtrTreasury;

    beforeAll(async () => {
        preprocBuildContractsLocal({
            defaultProtocolFee: null,
            defaultIsLocked: null,
            defaultLPFee: null,
            dexType: "constant_product"
        });

        bc = await Blockchain.create({ config: SLIM_CONFIG_LEGACY });
        code = {
            lpAccount: await compile('LPAccount'),
        };
        pool = await bc.treasury('pool');
        user = await bc.treasury('user');
        owner = await bc.treasury('owner');

        lpAcc = bc.openContract(LPAccount.createFromConfig({
            user: owner.address,
            pool: pool.address,
            storedLeft: 100n,
            storedRight: 100n,
        }, code.lpAccount));

        const deployLPAccResult = await lpAcc.sendDeploy(pool.getSender(), toNano('0.05'));
        expect(deployLPAccResult.transactions).toHaveTransaction({
            from: pool.address,
            to: lpAcc.address,
            deploy: true,
        });
    });

    describe('Getters', () => {
        it('should return valid data', async () => {
            const getLPData = await lpAcc.getLPAccountData();
            const sendGetterLPAccData = await lpAcc.sendGetterLPAccountData(user.getSender());
            expect(sendGetterLPAccData.transactions).toHaveTransaction({
                from: lpAcc.address,
                to: user.address,
                body: (val) => {
                    let body = val?.asSlice().skip(32 + 64);
                    return body?.loadAddress().toRawString() == getLPData.userAddress.toRawString() &&
                        body.loadAddress().toRawString() == getLPData.poolAddress.toRawString() &&
                        body.loadCoins() == getLPData.leftAmount &&
                        body.loadCoins() == getLPData.rightAmount;
                },
            });
        });
    });
});
