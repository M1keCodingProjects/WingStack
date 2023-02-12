export default class Parser {
    constructor(editor) {
        this.editor = editor;
    }

    parse_fileContents() {
        this.tokens = this.editor.sendTokens();
        return this.Program().value;
    }

    Program() {
        this.eat("{");
        const expressions = [];
        while(this.peek_nextToken()?.type != "}") {
            if(this.peek_nextToken()?.type == "EOL") {
                this.eat("EOL");
                continue;
            }
            expressions.push(this.Expression());
        }
        this.eat("}");
        return {
            type  : "Program",
            value : expressions,
        };
    }

    Expression() {
        const token = this.Procedure();
        if(this.peek_nextToken()?.type != "}") this.eat("EOL");
        return token;
    }

    Procedure() {
        const keyword = this.eat("keyword");
        this.eat("space");
        switch(keyword.value) {
            case "print" : return this.PrintProc();
        }
    }

    PrintProc() {
        return {
            type  : "PrintProc",
            value : this.StackExpr().value,
        }
    }

    StackExpr() {
        if(this.peek_nextToken()?.type == "space") this.eat("space");
        const values = [];
        while(true) {
            const nextTokenType = this.peek_nextToken()?.type;
            switch(nextTokenType) {
                case "stackOp" : values.push(this.eat("stackOp")); break;
                case "["       : values.push(this.CallChain()); break;
                
                case "num"     :
                case "str"     : values.push(this.Value()); break;
                
                case "EOL"     :
                case ")"       :
                case "]"       :
                case "}"       : break;
                
                default        : this.throw(`Unexpected token of type "${nextTokenType}" in Stack Expression.`);
            }
            
            if(["EOL", ")", "]", "}"].includes(this.peek_nextToken()?.type)) break;
            else this.eat("space");
        }

        return {
            type  : "StackExpr",
            value : values,
        };
    }

    CallChain() {
        const properties = [this.Property()];
        while(true) {
            const nextTokenType = this.peek_nextToken()?.type;
            if(nextTokenType == ".") this.eat(".");
            else if(nextTokenType != "[") break;
            properties.push(this.Property());
        }

        return {
            type  : "CallChain",
            value : properties,
        };
    }

    Property() {
        this.eat("[");
        const token = {
            type  : "IndexedProperty",
            value : this.StackExpr().value, // only works for indexed properties
        };
        this.eat("]");
        return token;
    }

    Value() {
        const token = this.grab_nextToken();
        if(!["num", "str"].includes(token.type)) this.throw(`Unexpected token of type ${token.type}, expected: NUM or STR`);
        if(token.type == "str") token.value = token.value.slice(1, -1);
        return token;
    }

    peek_nextToken() {
        return this.tokens[0];
    }

    grab_nextToken() {
        return this.tokens.shift();
    }

    eat(tokenType) {
        const token = this.grab_nextToken();
        if(token === null) this.throw(`Unexpected end of input, expected ${tokenType}`);
        if(token.type !== tokenType) this.throw(`Unexpected token of type ${token.type}, expected ${tokenType}`);
        return token;
    }

    throw(errorMsg) {
        errorMsg = "Syntax Error: " + errorMsg;
        this.editor.console.appendLog(errorMsg, "Error");
        throw new Error(errorMsg);
    }
}