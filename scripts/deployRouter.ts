import { NetworkProvider, compile } from '@ton/blueprint';
import { Address, OpenedContract, toNano } from '@ton/core';
import fs from 'fs';
import { POOL_TYPES, cliConfig, configParams, getIdColor, preprocBuildContractsLocal } from '../helpers/helpers';
import { CliConfig, buildLibFromCell, color, getLatestDeployer, isArgPresent, prettyFees, prettyState, waitConfirm, waitForDeploy } from '../libs';
import { Router } from '../wrappers/Router';

function readLibHex(ctr: string) {
    return JSON.parse(fs.readFileSync(`build/lib.${ctr}.json`, 'utf8')).hex
}

export async function run(provider: NetworkProvider, args: string[]) {
    cliConfig.readConfig()
    let config = cliConfig.values
    for (let pt of POOL_TYPES) {
        if (isArgPresent(args, pt)) {
            config.dexType = pt
            break
        }
    }
    if (config.dexType === null) {
        throw new Error('dexType is not defined');
    }
    const senderAddress = provider.sender().address as Address;
    const adminAddress = config.adminAddress ? config.adminAddress : senderAddress

    let noLib = isArgPresent(args, "nolibs") || isArgPresent(args, "nolib")
    let onlyLibs = isArgPresent(args, "libs")

    config.routerId = config.routerId ? config.routerId : Math.floor(Math.random() * Math.pow(2, 31))

    if (onlyLibs) {
        color.log(` - <y>Deploy libs only, type: <b>${config.dexType}`)
    } else {
        color.log(` - <y>Deploy router <b><bld>${noLib ? "WITHOUT" : "WITH"} <clr><y>using libs, type: <b>${config.dexType}`)
    }
    color.log(` - <y>Preprocessor config:`)
    color.log(`\t<y>defaultIsLocked: <b>${Boolean(config.defaultIsLocked)}`)
    color.log(`\t<y>defaultProtocolFee: <b>${config.defaultProtocolFee === null ? prettyFees(10) : prettyFees(config.defaultProtocolFee)}`)
    color.log(`\t<y>defaultLPFee: <b>${config.defaultLPFee === null ? prettyFees(20) : prettyFees(config.defaultLPFee)}`)

    waitConfirm()
    preprocBuildContractsLocal({
        dexType: config.dexType,
        defaultIsLocked: config.defaultIsLocked,
        defaultLPFee: config.defaultLPFee,
        defaultProtocolFee: config.defaultProtocolFee
    });

    const lpWalletCode = await compile("LPWallet")
    const poolCode = await compile("Pool")
    const lpAccountCode = await compile("LPAccount")
    const routerCode = await compile("Router")
    const vaultCode = await compile("Vault")

    let storageLpWalletCode = lpWalletCode
    let storagePoolCode = poolCode
    let storageLpAccountCode = lpAccountCode
    let storageRouterCode = routerCode
    let storageVaultCode = vaultCode

    if (!noLib) {
        const deployerCode = await compile('Deployer')
        let libRouter = await getLatestDeployer(provider, {
            deployerCode: deployerCode,
            publib: routerCode
        })
        let libPool = await getLatestDeployer(provider, {
            deployerCode: deployerCode,
            publib: poolCode
        })
        let libLpWallet = await getLatestDeployer(provider, {
            deployerCode: deployerCode,
            publib: lpWalletCode
        })
        let libLpAccount = await getLatestDeployer(provider, {
            deployerCode: deployerCode,
            publib: lpAccountCode
        })
        let libVault = await getLatestDeployer(provider, {
            deployerCode: deployerCode,
            publib: vaultCode
        })

        let routerStatus = libRouter.status
        let poolStatus = libPool.status
        let lpWalletStatus = libLpWallet.status
        let lpAccountStatus = libLpAccount.status
        let vaultStatus = libVault.status

        color.log(` - <y>Lib status:`)
        color.log(`\t<y>Router status: <bld>${prettyState(routerStatus)}<clr>, <y>id = ${getIdColor(libRouter.id)}${libRouter.id}`)
        color.log(`\t<y>Pool status: <bld>${prettyState(poolStatus)}<clr>, <y>id = ${getIdColor(libPool.id)}${libPool.id}`)
        color.log(`\t<y>LpWallet status: <bld>${prettyState(lpWalletStatus)}<clr>, <y>id = ${getIdColor(libLpWallet.id)}${libLpWallet.id}`)
        color.log(`\t<y>LpAccount status: <bld>${prettyState(lpAccountStatus)}<clr>, <y>id = ${getIdColor(libLpAccount.id)}${libLpAccount.id}`)
        color.log(`\t<y>Vault status: <bld>${prettyState(vaultStatus)}<clr>, <y>id = ${getIdColor(libVault.id)}${libVault.id}`)
            color.log(` - <y><bld>WARNING: <clr><y>deposit enough ton on masterchain contracts for prod`)
        color.log(` - <y>Continue?`)
        waitConfirm()

        config.libRouterAddress = libRouter.contract.address
        config.libLpWalletAddress = libLpWallet.contract.address
        config.libLpAccountAddress = libLpAccount.contract.address
        config.libVaultAddress = libVault.contract.address
        config.libPoolAddress = libPool.contract.address

        if (routerStatus !== "active") {
            color.log(` - <y>Deploying lib <b>Router (${config.dexType})<y>...`)
            await libRouter.contract.sendDeploy(provider.sender(), toNano('0.5'));
            await waitForDeploy(provider, libRouter.contract.address, 100);
        }

        if (poolStatus !== "active") {
            color.log(` - <y>Deploying lib <b>Pool (${config.dexType})<y>...`)
            await libPool.contract.sendDeploy(provider.sender(), toNano('0.5'));
            await waitForDeploy(provider, libPool.contract.address, 100);
        }

        if (lpWalletStatus !== "active") {
            color.log(` - <y>Deploying lib <b>LPWallet<y>...`)
            await libLpWallet.contract.sendDeploy(provider.sender(), toNano('0.5'));
            await waitForDeploy(provider, libLpWallet.contract.address, 100);
        }

        if (lpAccountStatus !== "active") {
            color.log(` - <y>Deploying lib <b>LPAccount<y>...`)
            await libLpAccount.contract.sendDeploy(provider.sender(), toNano('0.5'));
            await waitForDeploy(provider, libLpAccount.contract.address, 100);
        }

        if (vaultStatus !== "active") {
            color.log(` - <y>Deploying lib <b>Vault<y>...`)
            await libVault.contract.sendDeploy(provider.sender(), toNano('0.5'));
            await waitForDeploy(provider, libVault.contract.address, 100);
        }

        storageLpWalletCode = buildLibFromCell(lpWalletCode, "build/libLpWallet.json")
        storageLpAccountCode = buildLibFromCell(lpAccountCode, "build/libLpAccount.json")
        storageRouterCode = buildLibFromCell(routerCode, "build/libRouter.json")
        storagePoolCode = buildLibFromCell(poolCode, "build/libPool.json")
        storageVaultCode = buildLibFromCell(vaultCode, "build/libVault.json")

        config.libLpWalletHex = readLibHex("libLpWallet")
        config.libLpAccountHex = readLibHex("libLpAccount")
        config.libRouterHex = readLibHex("libRouter")
        config.libVaultHex = readLibHex("libVault")
        config.libPoolHex = readLibHex("libPool")

        let libConfig = new CliConfig(configParams, {})
        libConfig.values.libRouterAddress = config.libRouterAddress
        libConfig.values.libLpWalletAddress = config.libLpWalletAddress
        libConfig.values.libLpAccountAddress = config.libLpAccountAddress
        libConfig.values.libVaultAddress = config.libVaultAddress
        libConfig.values.libPoolAddress = config.libPoolAddress
        libConfig.values.libLpWalletHex = config.libLpWalletHex
        libConfig.values.libLpAccountHex = config.libLpAccountHex
        libConfig.values.libRouterHex = config.libRouterHex
        libConfig.values.libVaultHex = config.libVaultHex
        libConfig.values.libPoolHex = config.libPoolHex
        libConfig.updateConfig("build/lib.config.json")

    }

    if (!onlyLibs) {
        color.log(` - <y>Deploying <b>Router (${config.dexType})<y>...`)

        let router: OpenedContract<Router>
        while (true) {
            router = provider.open(Router.createFromConfig({
                id: config.routerId,
                isLocked: false,
                adminAddress: adminAddress,
                lpWalletCode: storageLpWalletCode,
                poolCode: storagePoolCode,
                lpAccountCode: storageLpAccountCode,
                vaultCode: storageVaultCode
            }, storageRouterCode))
            if (await provider.isContractDeployed(router.address)) {
                color.log(` - <r>This router is already deployed!`)
                config.routerId = Math.floor(Math.random() * Math.pow(2, 31))
                color.log(` - <y>New router id: <b>${config.routerId}`)
                color.log(` - <y>Continue?`)
                waitConfirm()
                continue
            }
            await router.sendDeploy(provider.sender(), toNano('0.05'));
            await waitForDeploy(provider, router.address, 100);
            color.log(` - <g>Router deployed with id: <b>${config.routerId}`)
            break
        }

        config.routerAddress = router.address;
        config.adminAddress = adminAddress
        cliConfig.updateConfig()
    }
}
