import fs from 'fs';
import path from 'path';
import util from "util"
import { NullableObj } from "./types";
import { parseAddress } from './address';
import { JettonContent, NftContent, processPublicKeys } from './meta';
import { Address } from '@ton/core';

function resolveString(val: string | undefined) {
    if (typeof val === "undefined") {
        return null;
    }

    return String(val);
}

function resolveAddress(val: string | undefined) {
    if (typeof val === "undefined") {
        return null;
    }

    return parseAddress(val);
}

function resolveBigint(val: string | undefined) {
    const strVal = String(val);
    if (typeof val === "undefined" || (strVal === "0")) {
        return null;
    }

    return BigInt(strVal.replace(/_| /g, ""));
}

function resolveNumber(val: string | undefined) {
    const strVal = String(val);
    if ((typeof val === "undefined") || (strVal === "0")) {
        return null;
    }

    return Number(strVal.replace(/_| /g, ""));
}

function resolveAddressArray(val: string[] | undefined) {
    if (typeof val === "undefined") {
        return null;
    }

    return val.map((item) => parseAddress(item));
}


function resolveBnArray(val: string[] | undefined) {
    if (typeof val === "undefined") {
        return null;
    }

    return val.map((item) => {
        return BigInt(String(item).replace(/_| /g, ""))
    });
}

function resolveMeta(val: JettonContent | NftContent | string | undefined) {
    if (typeof val === "undefined") {
        return null;
    } else {
        if (typeof val !== "string") {
            if (val.imageData && val.image) {
                throw new Error("'image' and 'imageData' are both defined; can only use 1")
            }
            (val as NftContent).publicKeys = processPublicKeys((val as NftContent).publicKeys)
        }

        return val;
    }
}

export const resolvers = {
    string: resolveString,
    address: resolveAddress,
    bigint: resolveBigint,
    number: resolveNumber,
    addressAr: resolveAddressArray,
    bigintAr: resolveBnArray,
    meta: resolveMeta,
};

type ConfigMap = Record<string, (val: NonNullable<any> | undefined) => NonNullable<any> | null>;
type ResolveTypesNonNull<A extends ConfigMap> = { [K in keyof A]: NonNullable<ReturnType<A[K]>> };
type ReadonlyParam<A extends ConfigMap> = { [K in keyof A]?: boolean | undefined };
type ExtractInpType<A extends ConfigMap> = { [K in keyof A]: Parameters<A[K]>[0] };

// @ts-ignore
BigInt.prototype.toJSON = function () { return this.toString(); };
// @ts-ignore
Address.prototype.toJSON = function () { return this.toString(); };
export class CliConfig<T extends ConfigMap> {
    private readonly resolvers: T;
    private readonly isReadOnly?: ReadonlyParam<T>;
    private readonly configOrig: ExtractInpType<T> = {} as ExtractInpType<T>;
    filePath: string = "";
    values: NullableObj<ResolveTypesNonNull<T>> = {} as NullableObj<ResolveTypesNonNull<T>>;

    constructor(resolvers: T, isReadOnly?: ReadonlyParam<T>, defaultPath = "build/deploy.config.json") {
        this.resolvers = resolvers;
        this.isReadOnly = isReadOnly;
        this.filePath = defaultPath;

        for (let key of Object.keys(this.resolvers) as Array<keyof T>) {
            this.values[key] = null;
            this.configOrig[key] = undefined;
        }
    }

    parseData(data: ExtractInpType<T>): NullableObj<ResolveTypesNonNull<T>> {
        const res = {} as NullableObj<ResolveTypesNonNull<T>>;

        for (let key of Object.keys(this.resolvers) as Array<keyof T>) {
            res[key] = this.resolvers[key](data[key]);
        }

        return res;
    }

    parseJSONString(src: string | null) {
        let data: ExtractInpType<T>;
        if (src === null) {
            for (let key of Object.keys(this.resolvers) as Array<keyof T>) {
                this.values[key] = null;
                this.configOrig[key] = undefined;
            }
        } else {
            data = JSON.parse(src);
            for (let key of Object.keys(this.resolvers) as Array<keyof T>) {
                this.configOrig[key] = data[key];
                // console.log(key, data[key])
                this.values[key] = this.resolvers[key](data[key]);
            }
        }
    }

    fromObject(src: Object) {
        const srcStr = JSON.stringify(src, null, 4)
        try {
            this.parseJSONString(srcStr);
        } catch (e) {
            this.parseJSONString(null);
        }
    }

    readConfig(src?: string) {
        this.filePath = src ?? this.filePath;
        if (!this.filePath) {
            throw new Error("path undefined");
        }
        if (fs.existsSync(this.filePath)) {
            this.parseJSONString(fs.readFileSync(this.filePath, 'utf8'));

        } else {
            this.parseJSONString(null);
        }

    }

    updateConfig(filePath?: string | null) {
        const serialize = (src: any) => {
            let res = src.toString()
            if (res === "[object Object]") {
                res = src
            }
            return src
        }
        if (!this.values) {
            throw new Error("config undefined");
        }
        filePath = filePath === undefined ? this.filePath : filePath;
        
        if (filePath === undefined) {
            throw new Error("path undefined");
        }
        let strObj: ExtractInpType<T> = {} as ExtractInpType<T>;

        for (let key of Object.keys(this.values) as Array<keyof T>) {
            if (this.isReadOnly && this.isReadOnly[key]) {
                strObj[key] = this.configOrig[key] !== null ? this.configOrig[key] : undefined;
            } else if (Array.isArray(this.values[key] as any)) {
                strObj[key] = this.values[key].map((val: any) => { return serialize(val) }) as string[];
            } else {
                strObj[key] = this.values[key] !== null ? serialize(this.values[key]) : undefined;
            }
        }
        const src = JSON.stringify(strObj, null, 4)
        if (filePath !== null) {
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            fs.writeFileSync(filePath, src, "utf-8");
        }
        return src
    }

    toString() {
        return this.values
    }

    [util.inspect.custom]() {
        return this.toString();
    }
}

