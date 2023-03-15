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
                type  : tokenType,
                value : tokenType == "num" ? Number(match) :
                        tokenType == "str" ? match.slice(1, -1) : match,
            });
        }, this.tokens);
                
        console.log(...this.tokens.map(t => t.type));
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

    Block() { // Block : "{" Program "}"
        this.eat("{");
        const expressions = this.Program().value;
        this.eat("}");

        return {
            type  : "Block",
            value : expressions,
        };
    }

    Expression() { // Expression : (Procedure | Assignment) ";"?
        const token = this.Procedure(); // doesn't implement assignments yet.
        if(this.peek_nextToken()?.type == ";") this.eat(";");
        return token;
    }

    Procedure() { // Procedure : PrintProc | WhenProc
        const keyword = this.eat("keyword");

        switch(keyword.value) {
            case "print" : return this.PrintProc();
            case "when"  : return this.WhenProc();
        }
    }

    PrintProc() { // PrintProc : "print" StackExpr
        return {
            type  : "PrintProc",
            value : this.StackExpr().value,
        };
    }

    WhenProc() { // WhenProc : "when" StackExpr "loop"? Block ElseProc?
        const token = {
            type  : "WhenProc",
            loops : false,
            value : this.StackExpr().value,
        };

        if(this.peek_nextToken()?.type == "keyword") {
            const keyword = this.eat("keyword").value;
            if(keyword != "loop") this.throw(`Found unexpected specifier "${keyword}" in "When" procedure, expected optional "loop".`);
            token.loops = true;
        }
        
        token.block = this.Block().value;
        if(this.peek_nextToken()?.value == "else") token.else = this.ElseProc();
        return token;
    }

    ElseProc() { // ElseProc : "else" (WhenProc | Block)
        this.eat("keyword");
        if(this.peek_nextToken()?.type == "keyword") {
            const keyword = this.eat("keyword").value;
            if(keyword != "when") this.throw(`Found unexpected specifier "${keyword}" in "Else" procedure, expected optional "when".`);
            const token = this.WhenProc();
            if(token.loops) this.throw('"Else-When" procedures cannot loop.');
            return token;
        }
        
        return {
            type  : "ElseProc",
            block : this.Block().value,
        };
    }

    StackExpr() { // StackExpr : (StackValue | STACKOP | CallChain)+
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
                default        : this.throw(`Unexpected token "${nextToken.value}" of type "${nextToken.type}" in Stack Expression, expected LiteralValue, CallChain or StackOperator.`);
                case ";"       :
                case "]"       :
                case undefined : return token;
            }
        }
    }

    Property() { // Property : IDProp
        this.eat("[");
        const token = {
            type  : "IndexedProperty",
            value : this.StackExpr(true).value,
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