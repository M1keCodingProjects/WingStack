const Specs = [  // a series of RegExp rules to be mapped to specific token types
    [/^#.*/, null],
    [/^\s*(\n|$)/, "NEWLINE"],
    [/^\s+/, "SPACE"],
    [/^\./, "DOT"],
    [/^\[/, "["],
    [/^\]/, "]"],
    [/^\{/, "{"],
    [/^\}/, "}"],
    [/^\(/, "("],
    [/^\)/, ")"],
    [/^\@/, "@"],
    [/^"[^"]*"/, "STRING"],
];

export default class Tokenizer { // lazily pulls tokens from a stream of characters
    constructor(compilerRef) {
        this.procKeywords      = Object.keys(compilerRef.procKeywords);
        this.stackOps          = Object.keys(compilerRef.stackOps);
        this.assignmentSymbols = compilerRef.assignmentSymbols;
    }
    
    init(string) {
        this._string = string;//.replace(/#.*(\n|$)/g, "$1");
        this._cursor = 0; // character position tracker
    }

    isEOF() {
        return this._cursor === this._string.length;
    }

    hasMoreTokens() {
        return this._cursor < this._string.length;
    }

    getNextToken() {
        if(!this.hasMoreTokens()) return null;
    
        const string = this._string.slice(this._cursor);
        let match;

        for(let [regexp, tokenType] of Specs) {
            let tokenValue = this._match(regexp, string);
            if(tokenValue === null) continue;
            if(tokenType === null) return this.getNextToken(); //skipped token, not really used

            return {
                type  : tokenType,
                value : tokenValue,
            };
        }

        let manualToken = string.split("\n")[0].split(/(\[| )/)[0];
        let type = "";
        if(!isNaN(manualToken)) type = "NUMBER";
        else if(manualToken[0] !== ".") manualToken = manualToken.split(".")[0];
        this._cursor += manualToken.length;

        if(type === "NUMBER") return { type: "NUMBER", value: Number(manualToken) };
        
        if(this.procKeywords.includes(manualToken)) type = "procKeyword";
        else if(this.assignmentSymbols.includes(manualToken)) type = "ASSIGN";
        else if(this.stackOps.includes(manualToken)) type = "StackOp";
        else type = "WORD";

        return {
            type  : type,
            value : manualToken,
        };
    }

    _match(regexp, string) {
        let match = regexp.exec(string);
        if(match === null) return null;
        this._cursor += match[0].length;    
        return match[0];
    }
}