import tokenize from "./tokenizer.js";

import iota from "../../UTILS/general.js";
const IGNORED_TOKEN_TYPES = {
    EOL     : iota(),
    comment : iota(),
};

export default class Parser {
    constructor(editor) {
        this.editor = editor;
    }

    parse_fileContents() {
        this.tokens = [];

        tokenize(this.editor.textContainer.value, (match, tokenType, tokens) => {
            if(tokenType in IGNORED_TOKEN_TYPES || (tokenType == "space" && this.tokens[this.tokens.length - 1]?.type != "]")) return;
            
            tokens.push({
                type  : tokenType == "op"  ? "stackOp" : tokenType,
                value : tokenType == "num" ? Number(match) :
                        tokenType == "str" ? match.slice(1, -1) : match,
            });
        }, this.tokens);
                
        //console.log(...this.tokens.map(t => t.type));
        return this.Program(true).value;
    }

    Program(isGlobal = false) { // Program : Expression*
        const expressions = [];
        
        while(this.peek_nextToken()?.type) {
            if(this.peek_nextToken()?.type == "}") break;
            expressions.push(this.Expression());
        }
        
        if(isGlobal && this.tokens.length) this.throw(`Trailing content found outside of main program: ${this.tokens.reduce((acc, token) => acc + token.value, "")}`);

        return {
            type  : "Program",
            value : expressions,
        };
    }

    Block(noThen = false) { // Block : ("{" Program "}") | ("then" Expression)
        const token = {
            type  : "Block",
            value : [],
        };

        const nextTokenValue = this.peek_nextToken()?.value;
        if(nextTokenValue == "then" || (noThen && nextTokenValue != "{")) { // no "and then?"!!
            if(!noThen || nextTokenValue == "then") this.eat("keyword");
            token.value.push(this.Expression(false));
            return token;
        }

        this.eat("{");
        token.value = this.Program().value;
        this.eat("}");

        return token;
    }

    Expression(needsTerminator = true) { // Expression : (Procedure | Assignment) ";"?
        const token = this.Procedure(needsTerminator); // doesn't implement assignments yet.
        if(this.peek_nextToken()?.type == ";") this.eat(";");
        return token;
    }

    Procedure(needsTerminator) { // Procedure : PrintProc | WhenProc | LoopProc
        const keyword = this.eat("keyword");

        switch(keyword.value) {
            case "print" : return this.PrintProc(needsTerminator);
            case "when"  : return this.WhenProc();
            case "loop"  : return this.LoopProc();
        }
    }

    PrintProc(needsTerminator) { // PrintProc : "print" StackExpr
        return {
            type  : "PrintProc",
            value : this.StackExpr(needsTerminator).value,
        };
    }

    WhenProc() { // WhenProc : "when" StackExpr "loop"? Block ElseProc?
        const token = {
            type  : "WhenProc",
            loops : false,
            value : this.StackExpr().value,
        };

        if(this.peek_nextToken()?.value == "loop") {
            this.eat("keyword");
            token.loops = true;
        }
        
        token.block = this.Block(token.loops).value;
        if(this.peek_nextToken()?.value == "else") token.else = this.ElseProc();
        return token;
    }

    ElseProc() { // ElseProc : "else" (WhenProc | Block)
        this.eat("keyword");
        if(this.peek_nextToken()?.value == "when") {
            this.eat("keyword");
            const token = this.WhenProc();
            if(token.loops) this.throw('"Else-When" procedures cannot loop.');
            return token;
        }
        
        return {
            type  : "ElseProc",
            block : this.Block(true).value,
        };
    }

    LoopProc() { // LoopProc : "loop" StackExpr Block
        return {
            type  : "LoopProc",
            value : this.StackExpr().value,
            block : this.Block().value,
        };
    }

    StackExpr(atLineEnd = false) { // StackExpr : (StackValue | STACKOP | CallChain)+
        const token = {
            type    : "StackExpr",
            value   : [],
        };

        while(true) {
            const nextToken = this.peek_nextToken();
            switch(nextToken?.type) {
                case "stackOp" : token.value.push(this.eat("stackOp")); break;
                case "["       : token.value.push(this.Property()); break;
                case "num"     :
                case "str"     : token.value.push(this.Value()); break;
                default        : if(atLineEnd) this.throw(`Unexpected token "${nextToken.value}" of type "${nextToken.type}" in Stack Expression, expected LiteralValue, CallChain or StackOperator.`);
                case "}"       :
                case ";"       :
                case undefined : return token;
            }
        }
    }

    Property() { // Property : IDProp
        this.eat("[");
        const token = {
            type  : "IndexedProperty",
            value : this.StackExpr().value,
        };
        this.eat("]");

        const nextTokenType = this.peek_nextToken()?.type;
        if(nextTokenType == ".") this.eat(".");
        else if(nextTokenType != "[") {
            this.eatOptionalSpace();
            return token;
        }
        token.next = this.Property();
        return token;
    }

    Value() { // Value : NUM | STR
        const token = {...this.grab_nextToken()};
        if(!["num", "str"].includes(token.type)) this.throw(`Unexpected token of type ${token.type}, expected: NUM or STR`);
        return token;
    }

    peek_nextToken() {
        return this.tokens[0];
    }

    grab_nextToken() {
        return this.tokens.shift() || null;
    }

    eatOptionalSpace() {
        if(this.peek_nextToken()?.type == "space") this.eat("space");
    }

    eat(tokenType) {
        const token = this.grab_nextToken();
        if(token === null) this.throw(`Unexpected end of input, expected ${tokenType}`);
        if(token.type !== tokenType) this.throw(`Unexpected token of type "${token.type}", expected "${tokenType}"`);
        return token;
    }

    throw(errorMsg) {
        errorMsg = "Syntax Error: " + errorMsg;
        this.editor.console.appendLog(errorMsg, "Error");
        throw new Error(errorMsg);
    }
}