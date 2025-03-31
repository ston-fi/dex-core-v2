import util from "util";

export type MdHighlightType = null | "bold" | "italic"
export type ColorType = null | "cyan" | "red" | "green" | "blue" | "yellow" | "purple" | string

export type StyleType = { highlight?: MdHighlightType } 
    & { splitLength?: number | null } 
    & ({ 
        isCode?: boolean,
        color?: never | null,
    } | {
        isCode?: never | false,
        color?: ColorType,
    })
type NameType = { text: string }
export type MdEntryFull = StyleType & NameType
export type MdColumnFull = MdEntryFull & { defaultEntryStyle?: StyleType }
export type MdColumn = string | MdColumnFull
export type MdEntry = string | MdEntryFull

type EntryTuple<T> = { [K in keyof T]: MdEntry };
type EntryTupleFull<T> = { [K in keyof T]: MdEntryFull };

export type TableTitle = {
    text: string,
    level?: number
}

export class MdTable<T extends MdColumn[]> {
    private columns: MdColumnFull[] = []
    private entries: EntryTupleFull<T>[] = []

    private _lineLen: number | null = null
    private _minLineLen = 10
    private _title = ""

    setTitle(title: string | TableTitle, info?: string) {
        let level = 1
        let text = ""
        info = info ? `${info}\n\n` : ""
        if (typeof title === "string") {
            text = title
        } else {
            level = title.level ?? level
            text = title.text
        }
        this._title = `${"#".repeat(level)} ${text}\n\n` + info
    }

    get title() {
        return this._title
    }

    get minLineLen() {
        return this._minLineLen
    }

    get lineLen() {
        return this._lineLen
    }

    set lineLen(len: number | null) {
        if (len?.toString().includes(".")) {
            throw new Error("only whole numbers allowed")
        }
        if (len !== null && len < this._minLineLen) {
            throw new Error(`min len is ${this._minLineLen}`)
        }
        this._lineLen = len
    }

    constructor(...column: T) {
        for (let entry of column) {
            if (typeof entry === "string") {
                this.columns.push({
                    text: entry,
                    highlight: null,
                    isCode: false,
                    color: null
                })
            } else {
                this.columns.push(entry)
            }
        }

    }

    private renderStyle<K extends MdEntryFull | MdColumnFull>(src: K, suppressStyle?: boolean) {
        let splitLen = src.splitLength === undefined ? this.lineLen : src.splitLength
        let res = this.splitLine(src.text, splitLen)
        
        if (src.isCode && !suppressStyle) res = '`' + res.replace("<br>", "") + '`'
        if (src.highlight === "italic" && !suppressStyle) res = '*' + res + '*'
        if (src.highlight === "bold" && !suppressStyle) res = '**' + res + '**'
        if (src.color && !suppressStyle) res = `<span style="color:${src.color}">` + res + '</span>'
        return res
    }
    
    private renderEntry<K extends EntryTupleFull<T> | MdColumnFull[]>(src: K, suppressStyle?: boolean) {
        return '| ' + src.map((e) => { return this.renderStyle(e, suppressStyle) }).join(" | ") + ' |'
    }
    private renderEntries(suppressStyle?: boolean) {
        if (this.entries.length > 0) {
            return this.entries.map((e) => { return this.renderEntry(e, suppressStyle) }).join("\n") + "\n"
        } else {
            return "NO DATA\n"
        }
    }
    private renderHeader(suppressStyle?: boolean) {
        let divider = '| ' + this.columns.map((e) => { return '---' }).join(" | ") + ' |'
        if (this.entries.length > 0) {
            return this.renderEntry(this.columns, suppressStyle) + "\n" + divider + "\n"
        } else {
            return ""
        }
    }
    private splitLine(src: string, splitLen?: number | null) {
        splitLen = splitLen === undefined ? this.lineLen : splitLen
        if (splitLen) {
            return (src.match(new RegExp(`.{1,${splitLen}}`, "g")) as RegExpMatchArray).join("<br>")
        } else {
            return src
        }
    }

    addEntry(...entry: EntryTuple<T>) {
        let internalEntry = []
        let i = 0
        for (let el of entry) {
            const defaultStyle = this.columns[i].defaultEntryStyle
            if (typeof el === "string" && !defaultStyle) {
                internalEntry.push({
                    text: el,
                    highlight: null,
                    isCode: false,
                    color: null,
                })
            } else if(typeof el === "string" && defaultStyle) {
                internalEntry.push({
                    text: el,
                    highlight: defaultStyle.highlight ?? null,
                    isCode: defaultStyle.isCode ?? false,
                    color: defaultStyle.color ?? null,
                    splitLength: defaultStyle.splitLength
                })
            } else if(typeof el !== "string" && defaultStyle) {
                internalEntry.push({
                    text: el.text,
                    highlight: el.highlight === null 
                        ? null 
                        : (el.highlight ?? defaultStyle.highlight) ?? null,
                    isCode: el.isCode === false 
                        ? false 
                        : !el.color 
                            ? ((el.isCode ?? defaultStyle.isCode) ?? false) 
                            : false,
                    color: el.color === null ? null 
                        : !el.isCode 
                            ? ((el.color ?? defaultStyle.color) ?? null) 
                            : null,
                    splitLength: el.splitLength === undefined 
                        ? defaultStyle.splitLength
                        : el.splitLength
                })
            } else {
                if (typeof el === "string") {
                    internalEntry.push(el)
                } else {
                    internalEntry.push({
                        ...el,
                        text: el.text
                    })
                }
            }
            i++
        }
        this.entries.push(internalEntry as EntryTupleFull<T>)
    }

    private renderInternal(suppressStyle?: boolean) {
        return this.title + this.renderHeader(suppressStyle) + this.renderEntries(suppressStyle)
    }
    render() {
        return this.renderInternal()
    }
    toString() {
        return this.renderInternal(true)
    }

    [util.inspect.custom]() {
        return this.toString();
    }

    get length() {
        return this.entries.length
    }
}
