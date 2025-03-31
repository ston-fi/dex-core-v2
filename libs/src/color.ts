import {type NetworkProvider} from "@ton/blueprint";

/* Examples of colored strings:
    "<r>Red <g>green"
    "<bld><r>Red and bold <g>green and bold"
    "<bld><r>Red and bold <clr><g>green"
*/
const styles: Record<string, string> = {
    clr     : '\x1b[0m', // clear
    clear   : '\x1b[0m',

    bold    : '\x1b[1m', // bold
    bld     : '\x1b[1m',

    fdd     : '\x1b[2m', // faded

    italic  : '\x1b[3m', // italic
    itl     : '\x1b[3m', 

    line    : '\x1b[4m', // underscore
    und     : '\x1b[4m', 

    s_flash : '\x1b[5m', // slow flash
    sfl     : '\x1b[5m', 

    f_flash : '\x1b[6m', // fast flash
    ffl     : '\x1b[6m', 

    inversion : '\x1b[7m', // invert text and background color
    inv       : '\x1b[7m',

    // Text styles
    blk   : '\x1b[30m', // black
    black : '\x1b[30m',
    k     : '\x1b[30m',

    red   : '\x1b[31m', // red
    r     : '\x1b[31m',

    grn   : '\x1b[32m', // green
    green : '\x1b[32m', 
    g     : '\x1b[32m',

    yel   : '\x1b[33m', // yellow
    yellow: '\x1b[33m',
    y     : '\x1b[33m',

    blue  : '\x1b[34m', // blue
    b     : '\x1b[34m',

    prp    : '\x1b[35m', // magenta
    purple : '\x1b[35m',
    mgt    : '\x1b[35m', 
    magenta: '\x1b[35m',
    m      : '\x1b[35m',

    trq   : '\x1b[36m', // cyan
    cyan  : '\x1b[36m',
    c     : '\x1b[36m',

    wht   : '\x1b[37m', // white
    white : '\x1b[37m', 
    w     : '\x1b[37m',

    // Background styles
    blk_f : '\x1b[40m', // black
    kf    : '\x1b[40m',

    red_f : '\x1b[41m', // red
    rf    : '\x1b[41m',

    grn_f : '\x1b[42m', // green
    gf    : '\x1b[42m',

    yel_f : '\x1b[43m', // yellow
    yf    : '\x1b[43m',

    blue_f: '\x1b[44m', // blue
    bf    : '\x1b[44m',

    prp_f : '\x1b[45m', // magenta
    mgt_f : '\x1b[45m', 
    mf    : '\x1b[45m',

    trq_f : '\x1b[46m', // cyan
    cf    : '\x1b[46m',

    wht_f : '\x1b[47m', // white
    wf    : '\x1b[47m',
}

// returns array of strings without color tags
export function decolorText(...text: any[]): string[] {
    return text.map((str) => {
        const colorRegExp = new RegExp('<(' + Object.keys(styles).join('|') + ')>', 'g');
        return String(str).replace(colorRegExp, '');
    });
}

// returns array of strings with color keys as in styles
export function colorText(...text: any[]): string[] {
    return text.map((str) => {
        const colorRegExp = new RegExp('<(' + Object.keys(styles).join('|') + ')>', 'g');
        return String(str).replace(colorRegExp, (_, name) => styles[name] || '') + styles.clr;
    });
}

/**
 * prints color strings to console, returns plain text array of strings
 * @deprecated use `loggerBuilder` instead
 */
export function log(...text: any[]): string[] {
    if (process.env.STON_CONTRACTS_LOGGER_DISABLED !== 'true') {
        console.log(...colorText(...text))
    }

    return decolorText(...text)
}

export function expr(expression: any, tClr = "<g>", fClr = "<r>") {
    return Boolean(expression) ? tClr : fClr;
}

/**
 * @example ```ts
 * async function run(provider: NetworkProvider) {
 *     const logger = loggerBuilder(provider);
 *     // ...some logic here
 *     logger(` - <y>Deploy minter <b><bld>${noLib ? "WITHOUT" : "WITH"} <clr><y>libs?`);
 *     logger(`\t<y>uri type: <bld>${color.expr(!config.staticUri)}${config.staticUri ? "STATIC" : "DYNAMIC"}`);
 * }
 * ```
 */
export function loggerBuilder(provider: Pick<NetworkProvider, 'ui'>) {
    return function logger(...text: Array<any>) {
        for (const line of text) {
            if (typeof line === 'string') {
                if (process.env.STON_CONTRACTS_LOGGER_DISABLED === 'true') {
                    provider.ui().write(decolorText(line)[0]);
                } else {
                    provider.ui().write(colorText(line)[0]);
                }
            } else {
                if (process.env.STON_CONTRACTS_LOGGER_DISABLED === 'true') {
                    provider.ui().write(JSON.stringify(line, null, 4));
                } else {
                    console.log(line);
                }
            }
        }

        return text.map((line) => {
            if (typeof line === 'string') {
                return decolorText(line)[0];
            }

            return line;
        });
    }
}
