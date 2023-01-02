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
        const values = [];
        while(!["EOL", "}"].includes(this.peek_nextToken()?.type)) {
            const nextTokenType = this.peek_nextToken()?.type;
            values.push(nextTokenType == "stackOp" ? this.eat("stackOp") : this.Value());
            if(this.peek_nextToken()?.type == "space") this.eat("space");
        }

        return {
            type  : "StackExpr",
            value : values,
        };
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