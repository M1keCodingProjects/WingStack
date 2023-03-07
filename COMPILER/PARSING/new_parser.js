export default class Parser {
    constructor(editor) {
        this.editor = editor;

        this.stackExpr_validTokenTypes = ["stackOp", "[", "num", "str"];
    }

    parse_fileContents() {
        this.tokens = [];
        let currentlyAfterEOL = true;
        for(const token of this.editor.sendTokens()) {
            if(token.type == "EOL") {
                if(!currentlyAfterEOL) {
                    currentlyAfterEOL = true;
                    this.tokens.push(token);
                }
                continue;
            }

            if(token.type == "space" && currentlyAfterEOL) continue;
            
            this.tokens.push(token);
            currentlyAfterEOL = false;
        }
        return this.Program(true).value;
    }

    Program(isGlobal = false) { // Program : (Expression SPACE? EOL)*
        const expressions = [];
        while(this.peek_nextToken()?.type) {
            if(expressions.length) this.eat("EOL");
            expressions.push(this.Expression());
        }
        
        if(isGlobal && this.tokens.length) this.throw(`Trailing content found outside of main program: ${this.tokens.reduce((acc, token) => acc + token.value, "")}`);

        return {
            type  : "Program",
            value : expressions,
        };
    }

    Expression() { // Expression : Procedure
        const token = this.Procedure();
        return token;
    }

    Procedure() { // Procedure : PrintProc
        const keyword = this.eat("keyword");
        this.eat("space");
        switch(keyword.value) {
            case "print" : return this.PrintProc();
        }
    }

    PrintProc() { // PrintProc : "print" SPACE StackExpr (SPACE "with" ERROR)?
        const token = {
            type  : "PrintProc",
            value : this.StackExpr().value,
        };
        if(!token.value.length) this.throw("Invalid empty StackExpression argument in PrintProcedure.");
        if(this.peek_nextToken()?.type == "space") this.eat("space");
        if(this.peek_nextToken()?.type == "specifier") {
            const keyword = this.eat("specifier").value;
            if(keyword != "with") this.throw(`Found unexpected specifier "${keyword}" in PrintProcedure, expected optional "with"`);
            this.eat("space");
            token.styleTag = this.eat("errorClass").value;
        }
        return token;
    }

    StackExpr() { // StackExpr : ((StackValue | STACKOP | CallChain) SPACE)*        
        const token = {
            type  : "StackExpr",
            value : [],
        };

        while(true) {
            switch(this.peek_nextToken()?.type) {
                case "stackOp" : token.value.push(this.eat("stackOp")); break;
                case "["       : token.value.push(this.CallChain()); break;
                case "num"     :
                case "str"     : token.value.push(this.Value()); break;
                default        : return token;
            }
            
            const nextToken = this.peek_nextToken();
            if(this.stackExpr_validTokenTypes.includes(nextToken?.type)) this.throw(`Missing space between elements "${token.value.pop().value}" and "${nextToken.value}" in StackExpression.`);
            if(this.stackExpr_validTokenTypes.includes(this.tokens[1]?.type)) this.eat("space");
        }
    }

    CallChain() { // CallChain : Property (("." Property) | IDProp)?*
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

    Property() { // IDProp
        this.eat("[");
        if(this.peek_nextToken()?.type == "space") this.eat("space");
        const token = {
            type  : "IndexedProperty",
            value : this.StackExpr().value, // only works for indexed properties
        };
        if(this.peek_nextToken()?.type == "space") this.eat("space");
        this.eat("]");
        return token;
    }

    Value() { // NUM | STR
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