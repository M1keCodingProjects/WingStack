import tokenize from "./tokenizer.js";

import iota from "../../UTILS/general.js";
const IGNORED_TOKEN_TYPES = {
    space   : iota(),
    EOL     : iota(),
    comment : iota(),
};

export default class Parser {
    constructor(editor) {
        this.editor = editor;
    }

    parse_fileContents() {
        this.tokens = [];

        let insideStackExpr = 0;
        tokenize(this.editor.textContainer.value, (match, tokenType, tokens) => {
            if(tokenType in IGNORED_TOKEN_TYPES && (tokenType != "space" || !insideStackExpr)) return;

            switch(tokenType) {
                case "op" : tokenType = "stackOp"; break;
                
                case "[" :
                case "(" : insideStackExpr++; break;
                
                case "]" :
                case ")" : insideStackExpr--; break;
            }

            tokens.push({
                type  : tokenType,
                value : tokenType == "num" ? Number(match) : match,
            });
        }, this.tokens);
        
        if(insideStackExpr) this.throw("Uneven amount of parentheses detected.");
        
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

    Block() { // Block : "{" Program "}"
        this.eat("{");
        if(this.peek_nextToken()?.type == "space") this.eat("space");
        const expressions = this.Program().value;
        this.eat("}");

        return {
            type  : "Block",
            value : expressions,
        };
    }

    Expression() { // Expression : (Procedure | Assignment) ";"?
        const token = this.Procedure(); // doesn't implement assignments yet.
        this.eat(";");
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

    StackExpr(delimiterTokens = "()") { // StackExpr : "(" StackItem (SPACE StackItem)* ")"
        const token = {
            type  : "StackExpr",
            value : [],
        };

        this.eat(delimiterTokens[0]);
        this.eatOptionalSpace();
        
        while(true) {
            const nextToken = this.peek_nextToken();
            switch(nextToken?.type) {
                case "stackOp" : token.value.push(this.eat("stackOp")); break;
                case "["       : token.value.push(this.CallChain()); break;
                case "num"     :
                case "str"     : token.value.push(this.Value()); break;
                default        : this.throw(`Unexpected token "${nextToken.value}" of type "${nextToken.type}" in Stack Expression, expected LiteralValue, CallChain or StackOperator.`);
                case undefined : this.throw('Stack Expression must end with ")"');
            
                case delimiterTokens[1] : this.eat(delimiterTokens[1]); return token;
            }
            
            if(this.peek_nextToken()?.type != delimiterTokens[1]) this.eat("space");
        }
    }

    CallChain() { // CallChain : Property (("." Property) | IDProp)*
        const properties = [this.Property()];
        while(true) {
            const nextTokenType = this.peek_nextToken()?.type;
            if(nextTokenType == ".") this.eat(".");
            else if(nextTokenType != "[") break; // This doesn't really work, fix for WORD tokens.
            properties.push(this.Property());
        }

        return {
            type  : "CallChain",
            value : properties,
        };
    }

    Property() { // Property : IDProp
        return {
            type  : "IndexedProperty",
            value : this.StackExpr("[]").value,
        };
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