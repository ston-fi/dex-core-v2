import { type NetworkProvider } from '@ton/blueprint';
import { prompt } from "./utils";

/**
 * @deprecated use `run(provider: NetworkProvider, args: string[])` cli signature instead
 */
export function findArgs(processArgs: string[], searchArgs: string[] | string, strict = true) {
    const searchArgsList = (typeof searchArgs === 'string' ? [searchArgs] : searchArgs).map((val) => val.toLowerCase());

    if (strict) {
        // strict O(n) complexity
        const processArgsMap = new Map<string, number>(processArgs.map((val, ind) => {
            return [val.toLowerCase(), ind];
        }));

        for (let current of searchArgsList) {
            if (processArgsMap.has(current)) {
                return processArgsMap.get(current)!;
            }
        }
    } else {
        // unstrict O(n^2) complexity
        const processArgsList = processArgs.map((val) => val.toLowerCase());

        for (let current of searchArgsList) {
            const pos = processArgsList.findIndex((val) => val.includes(current));

            if (pos !== -1) {
                return pos;
            }
        }
    }

    throw new Error('Cannot find specified args in array');
}

export function isArgPresent(array: string[], arg: string) {
    try {
        findArgs(array, arg);
    } catch {
        return false;
    }

    return true;
}

/**
 * @deprecated use `confirmBuilder` instead
 */
export function waitConfirm(msg?: string) {
    prompt(msg ?? "> Press Enter to confirm (^C for cancel)");
}

/**
 * @example ```ts
 * async function run(provider: NetworkProvider) {
 *     const confirm = confirmBuilder(provider);
 *     // ...prepare payload
 *     await confirm();
 *     // ...do something
 *     await confirm('Are you sure?');
 *     // ...do something again
 * }
 * ```
 */
export function confirmBuilder(provider: Pick<NetworkProvider, 'ui'>) {
    return async function confirm(message?: string) {
        if (!(await provider.ui().prompt(message ?? "Continue?"))) {
            throw new Error('Manually stopped');
        }
    }
}