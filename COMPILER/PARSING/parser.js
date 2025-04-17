import { iota } from "../../UTILS/general.js";
import {ParsingError} from "../customErrors.js";

class Tokenizer {
    constructor() {
        this.states = {
            IDLE       : iota(0),
            COMMENT    : iota(),
            ML_COMMENT : iota(),
            STRING     : iota(),
        };

        this.specialSymbols = {
            STR     : "\"",
            STR2    : "'",
            EOL     : "\n",
            SPACE   : " ",
            COMMENT : "#",
        };

        this.specialSymbolsEnum = {
            "\"" : iota(0),
            "'"  : iota(),
            "\n" : iota(),
            " "  : iota(),
            "#"  : iota(),
        }

        this.keywords = {
            pi      : "num",
            inf     : "num",
            false   : "num",
            true    : "num",
            num     : "type",
            int     : "type",
            bin     : "type",
            str     : "type",
            char    : "type",
            list    : "type",
            obj     : "type",
            func    : "type",
            err     : "type",
            void    : "type",
            typ     : "type",
            dict    : "type",
            print   : "keyword",
            make    : "keyword",
            loop    : "keyword",
            if      : "keyword",
            else    : "keyword",
            free    : "keyword",
            fun     : "keyword",
            ret     : "keyword",
            exit    : "keyword",
            next    : "keyword",
            enum    : "keyword",
            use     : "keyword",
            match   : "keyword",
            with    : "keyword",
            const   : "keyword",
            global  : "keyword",
            dyn     : "keyword",
            ref     : "keyword",
            type    : "keyword",
            class   : "keyword",
            then    : "keyword",
            from    : "keyword",
            wait    : "keyword",
            and     : "stackOp",
            or      : "stackOp",
            not     : "stackOp",
            xor     : "stackOp",
            self    : "instance",
            parent  : "instance",
            time    : "instance",
        };

        this.prioritizedSymbols = {
            "==" : "stackOp",
            "!=" : "stackOp",
            "<=" : "stackOp",
            ">=" : "stackOp",
            "<<" : "stackOp",
            ">>" : "stackOp",
            "++" : "increment",
            "--" : "increment",
            "!!" : "increment",
            "+=" : "assignment",
            "-=" : "assignment",
            "*=" : "assignment",
            "/=" : "assignment",
            "&=" : "assignment",
            "|=" : "assignment",
        };

        this.symbols = {
            "(" : "(",
            ")" : ")",
            "[" : "[",
            "]" : "]",
            "{" : "{",
            "}" : "}",
            "." : ".",
            "," : ",",
            ";" : ";",
            ":" : ":",
            "|" : "|",
            "@" : "@",
            "+" : "stackOp",
            "-" : "stackOp",
            "*" : "stackOp",
            "/" : "stackOp",
            "%" : "stackOp",
            "^" : "stackOp",
            "<" : "stackOp",
            ">" : "stackOp",
            "!" : "stackOp",
            "=" : "assignment",
        };
    }

    init(programText) {
        this.programText = programText;
        this.line = 1;
        this.row  = 0;
    }

    consumeStream() {
        let nextToken = {
            type  : null,
            value : "",
        };
        
        let charID = -1;
        let currentState = this.states.IDLE;
        while(!nextToken.type) {
            charID++;
            this.row++;
            const c = this.programText[charID];
            if(!c) return null;

            switch(currentState) {
                case this.states.IDLE: {
                    if(c in this.specialSymbolsEnum) {
                        switch(c) {
                            case this.specialSymbols.STR     :
                            case this.specialSymbols.STR2    : currentState = this.states.STRING; break;
                            case this.specialSymbols.EOL     : this.incrementLine(); break;
                            case this.specialSymbols.COMMENT : {
                                currentState = this.startMatches(charID, "#%") ?
                                               this.states.ML_COMMENT     :
                                               this.states.COMMENT;
                                break;
                            }
                        }
                        continue;
                    }

                    if(this.startComparesToGroup(charID, this.keywords,           nextToken) ||
                       this.startComparesToGroup(charID, this.prioritizedSymbols, nextToken) ||
                       this.startComparesToGroup(charID, this.symbols,            nextToken))
                    {
                        this.programText = this.programText.substring(charID + nextToken.value.length);
                        return nextToken;
                    }
                    // handle numbers, binaries and words.

                    this.panic(`Unrecognized symbol "${c}"`);
                }
                
                case this.states.COMMENT: {
                    if(c === this.specialSymbols.EOL) {
                        this.incrementLine();
                        currentState = this.states.IDLE;
                    }
                    continue;
                }

                case this.states.ML_COMMENT: {
                    if(c === this.specialSymbols.EOL) this.incrementLine();
                    if(this.startMatches(charID, "%#")) {
                        charID++;
                        currentState = this.states.IDLE;
                    }
                    continue;
                }

                case this.states.STRING: {
                    switch(c) {
                        case this.specialSymbols.STR  :
                        case this.specialSymbols.STR2 : {
                            nextToken.type   = "string";
                            this.programText = this.programText.substring(charID + 1);
                            return nextToken;
                        }
                        case this.specialSymbols.EOL  : this.panic("Unterminated string literal");
                    }
                }
            }
            nextToken.value += c;
        }
    }

    incrementLine() {
        this.line++;
        this.row = 0;
    }

    startComparesToGroup(charID, group, token) {
        for(const symbol in group) {
            if(!this.startMatches(charID, symbol)) continue;
            token.type  = group[symbol];
            token.value = symbol;
            return true;
        }
    }

    startMatches(charID, subStr) {
        if(subStr.length == 1) return this.programText[charID] === subStr;
        if(this.programText.substring(charID, charID + subStr.length) !== subStr) return false;
        this.row += subStr.length - 1;
        return true;
    }

    panic(errorMsg) {
        throw new ParsingError(errorMsg, "", `line: ${this.line}, row: ${this.row}`);
    }
}

const tokenizer = new Tokenizer();
export default class Parser {
    constructor() {

    }

    parse(programText) {
        this.programText = programText;
        this.tokenStream = [];
        this.cfBlocks    = []; // control flow is currently limited to: "Loop" & "When-loop" procedures.
        this.depth       =  0;
        tokenizer.init(programText);
        this.updateNextToken();

        this.Program();
        return this.tokenStream;
    }

    Program() { // Program : Expression*
        
    }
    
    updateNextToken() {
        this.nextToken = tokenizer.consumeStream();
        console.log(this.nextToken);
    }
}

export const parser = new Parser();