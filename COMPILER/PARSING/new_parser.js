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
        let foundSpace      = false;
        tokenize(this.editor.textContainer.value, (match, tokenType, tokens) => {
            if(tokenType in IGNORED_TOKEN_TYPES) {
                if(!insideStackExpr || foundSpace) return;
                foundSpace = true;
                return tokens.push({
                    type  : "space",
                    value : " ",
                });
            }
            
            if(foundSpace) foundSpace = false;

            switch(tokenType) {
                case "op" : tokenType = "stackOp"; break;
                case "["  : insideStackExpr++; break;
                case "]"  : insideStackExpr--; break;
            }

            tokens.push({
                type  : tokenType,
                value : tokenType == "num" ? Number(match) :
                        tokenType == "str" ? match.slice(1, -1) : match,
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
        const expressions = this.Program().value;
        this.eat("}");

        return {
            type  : "Block",
            value : expressions,
        };
    }

    Expression() { // Expression : (Procedure | Assignment) ";"?
        const token = this.Procedure(); // doesn't implement assignments yet.
        if(this.peek_nextToken()?.type != "}" && !token.block) this.eat(";");
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
            value : this.StackExpr(),
        };
    }

    WhenProc() { // WhenProc : "when" StackExpr "loop"? Block ElseProc?
        const token = {
            type  : "WhenProc",
            loops : false,
            value : this.StackExpr(),
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

    StackExpr(forceBrackets = false) { // StackExpr : StackItem | ("[" StackItem (SPACE StackItem)* "]")
        const token = {
            type    : "StackExpr",
            wrapped : false,
            value   : [],
        };

        if(this.peek_nextToken()?.type != "[") {
            if(forceBrackets) this.throw('Missing wrapper "[]" around StackExpression.');
            const item = this.StackItem();
            if(item == "finished") this.throw('Cannot find matching "[" for "]" in StackExpression.');
            token.value.push(item);
            return token;
        }

        this.eat("[");
        token.wrapped = true;
        this.eatOptionalSpace();
        
        while(true) {
            const item = this.StackItem();
            if(item == "finished") {
                if(forceBrackets || this.peek_nextToken()?.type != "[") return token;
                token.wrapped = false;
                const nextProps = this.CallChain(true); // if a "[" starts immediately, this was one CallChain item
                nextProps.value.unshift({               // we finish the CallChain and add our initial IDProp (StackExpr) to its value
                    type  : "IndexedProperty",
                    value : token.value
                });
                token.value = [nextProps];              // the StackExpr is interpreted as containing one CallChain item.
                return token;
            }
            token.value.push(item);
            if(this.peek_nextToken()?.type != "]") this.eat("space");
        }
    }

    StackItem() { // StackItem : StackValue | STACKOP | CallChain
        const nextToken = this.peek_nextToken();
        switch(nextToken?.type) {
            case "stackOp" : return this.eat("stackOp");
            case "["       : return this.CallChain();
            case "num"     :
            case "str"     : return this.Value();
            default        : this.throw(`Unexpected token "${nextToken.value}" of type "${nextToken.type}" in Stack Expression, expected LiteralValue, CallChain or StackOperator.`);
            case undefined : this.throw('Stack Expression must end with "]"');
        
            case "]" : this.eat("]"); return "finished";
        }
    }

    CallChain(alreadyProcessedFirstProperty = false) { // CallChain : Property (("." Property) | IDProp)*
        const properties = alreadyProcessedFirstProperty ? [] : [this.Property()];
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
            value : this.StackExpr(true).value,
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