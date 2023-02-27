export default class Parser {
    constructor(editor) {
        this.editor = editor;
    }

    parse_fileContents() {
        this.tokens = this.editor.sendTokens();
        return this.Program(true).value;
    }

    Program(isGlobal = false) {
        const expressions = [];
        while(true) {
            const nextTokenType = this.peek_nextToken()?.type;
            if(!nextTokenType || nextTokenType == "}") break;
            if(nextTokenType == "EOL") this.eat("EOL");
            else expressions.push(this.Expression());
        }
        
        if(isGlobal && this.tokens.length) this.throw(`Trailing content found outside of main program: ${this.tokens.reduce((acc, token) => acc + token.value, "")}`);

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
        const token = {
            type  : "PrintProc",
            value : this.StackExpr().value,
        };

        if(this.peek_nextToken()?.type == "specifier") {
            const keyword = this.eat("specifier").value;
            if(keyword != "with") this.throw(`Found unexpected specifier "${keyword}" in PrintProcedure, expected optional "with"`);
            this.eat("space");
            token.styleTag = this.parse_styleTag(this.eat("str").value);
        }
        return token;
    }

    parse_styleTag(styleTag) {
        const styles = styleTag.split(/, */);
        if(styles == "") return;
        if(styles.length > 3) this.throw("Too many styles (more than 3 selectors) applied in PrintProcedure.");

        const tagObj = {
            color: "",
            bold: false,
            italic: false,
        };

        for(const style of styles) {
            switch(style) {
                case "bold"   : tagObj.bold   = true; break;
                case "italic" : tagObj.italic = true; break;
                default       : {
                    if(style[0] != "#" || style.length != 7) this.throw(`Unrecognized style selector "${style}" in PrintProcedure. Color-type style selector must be hexadecimal (# followed by 6 digits 0-f).`);
                    tagObj.color = style;
                    break;
                }
            }
        }

        return tagObj;
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
                
                //add on bottom as well
                case "specifier" :
                case "EOL"       :
                case ")"         :
                case "]"         :
                case "}"         : break;
                
                default        : this.throw(`Unexpected token of type "${nextTokenType}" in Stack Expression.`);
            }
            
            if(["specifier", "EOL", ")", "]", "}"].includes(this.peek_nextToken()?.type)) break;
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