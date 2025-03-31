import { compile } from '@ton/blueprint';
import { Cell } from "@ton/core";
import fs from 'fs';
import { buildLibFromCell } from './build-lib';

/**
 * @deprecated use `confirmBuilder` instead
 */
export const prompt = /*@__PURE__*/require('prompt-sync')({
    sigint: true
});

export function toHexStr(inp: number | bigint) {
    return "0x" + inp.toString(16)
}

export async function compileX(contract: string, params?: {
    noSave?: boolean,
    cells?: boolean,
    base64?: boolean,
    hex?: boolean,
    lib?: boolean
}): Promise<Cell> {
    const artifact = await compile(contract);

    if (!params?.noSave) {
        fs.mkdirSync("build", { recursive: true });
        let data: {
            hex?: string,
            base64?: string,
            lib?: string,
        } = {}
        if (params?.cells) {
            let cells = artifact.toString()
            fs.writeFileSync(`build/${contract}.cells.compiled.txt`, artifact.toString(), "utf-8");
        }
        if (params?.base64) {
            data.base64 = artifact.toBoc().toString("base64")
        }
        if (params?.hex ?? true) {
            data.hex = artifact.toBoc().toString('hex')
        }
        if (params?.lib) {
            const lib = buildLibFromCell(artifact)
            data.lib = lib.toBoc().toString('hex')
        }
        fs.writeFileSync(`build/${contract}.compiled.json`, JSON.stringify(data, null, 4));
    }
    return artifact;
}

export function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function toRevStr(str: any) {
    return String(str).split("").reverse().join("");
}

export function toSnakeCase(str: string) {
    // @ts-ignore
    return str && str
        .match(/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g)
        .map(x => x.toLowerCase())
        .join('_');
}

export function parseVersion(versionString?: string): [number, number, number, string] {
    try {
        let data: { version: string }
        if (versionString === undefined) {
            data = JSON.parse(fs.readFileSync("package.json", 'utf8'));
        } else {
            data = { version: versionString }
        }
        let num = data.version.split(".")
        num[2] = num[2].split("-")[0]

        let sub = data.version.split("-")
        let dev = sub.length > 1 
            ? sub[1] 
            : Number(num[2]) === 0 
                ? "release" 
                : `patch${num[2]}` 

        return [Number(num[0]), Number(num[1]), Number(num[2]), dev]
    } catch {
        throw new Error("Could not parse version, example: '1.0.0-beta1.0'")
    }
}

export function parseArg<K, T, V>(src: K, primary: (inp: K) => T, fallback?: (inp: K) => V) {
    try {
        return primary(src)
    } catch (err) {
        if (fallback) {
            return fallback(src)
        } else {
            throw err
        }
    }
}
