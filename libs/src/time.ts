
export const DAY_IN_SECONDS = 3600 * 24;
export const MONTH_IN_SECONDS = 2629800;

export function dateFromSec(seconds: number | bigint | null | undefined): Date | null {
    if (seconds === undefined || seconds === null) {
        return null;
    } else {
        return new Date(Number(seconds) * 1000);
    }
}

export function nowSec(): number {
    return Math.floor(Date.now() / 1000);
}

export function fromNowSec(seconds: number | bigint): number {
    return nowSec() + Number(seconds);
}

export function dateFromNowSec(seconds: number | bigint): Date {
    return new Date(Date.now() + Number(seconds) * 1000);
}
