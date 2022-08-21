import Tokenizer from "./tokenizer.js";
import { CompileTimeError } from "../COMPILER UTILS/errors.js";

export default class Parser {
    constructor(compilerRef) {
        this._string = "";
        this._tokenizer = new Tokenizer(compilerRef);
    }
    
    parse(string) { // Parses a string into a JSON object AST
        this._string = string;
        this._tokenizer.init(string);
        this._lookahead = this._tokenizer.getNextToken(); // used for predictive parsing
        this._lineID = 0;
        const program = this.Program();
        if(this._lookahead !== null) throw new CompileTimeError(this._lineID, "expected EOF but got trailing content outside of main program");
        return program;
    }

    Program() { // Parses the main entry point, Program ::= Expression | Program Expression
        const lines = [];
        while(this._lookahead !== null && this._lookahead.type !== "}") {
            if(this._lookahead.type === "NEWLINE") this._eat("NEWLINE");
            else if(this._lookahead !== null && this._lookahead.type === "SPACE") this._eat("SPACE");
            else if(this._lookahead !== null) lines.push(this.Expression());
        }
        if(!lines.length) console.warn("Empty <Program>");

        return {
            ID   : this._lineID,
            type : "Program",
            body : lines,
        };
    }

    Expression() { // Expression ::= Procedure LineEnder | Assignment LineEnder | FuncCall LineEnder
        let token;
        if(this._lookahead !== null && this._lookahead.type === "SPACE") this._eat("SPACE");
        switch(this._lookahead.type) {
            case "procKeyword" : token = this.Procedure();  break;
            case "WORD"        : token = this._lookahead.value.slice(-1) === "(" ? this.FuncCall() : this.Assignment(); break;
            default            : throw new CompileTimeError(this._lineID, `Unrecognized statement "${this._lookahead.value}" as any known <Expression> token type`);
        }

        return token;
    }

    Procedure() { // Procedure ::= PrintProc | MakeProc | ...
        let token = this._eat("procKeyword");
        const ID = this._lineID; // saved here otherwise we get the ID at the end of the block
        
        switch (token.value) {
            case "print"   : this._eat("SPACE"); token = this.PrintProc();   break;
            case "make"    : this._eat("SPACE"); token = this.MakeProc();    break;
            case "free"    : this._eat("SPACE"); token = this.FreeProc();    break;
            case "replace" : this._eat("SPACE"); token = this.ReplaceProc(); break;
            case "loop"    : this._eat("SPACE"); token = this.LoopProc();    break;
            case "use"     : this._eat("SPACE"); token = this.UseProc();     break;
            case "when"    : this._eat("SPACE"); token = this.WhenProc();    break;
            case "flag"    : this._eat("SPACE"); token = this.FlagProc();    break;
            case "def"     : this._eat("SPACE"); token = this.FuncProc();    break;
            case "next"    : token = this.NextProc(); break;
            case "exit"    : token = this.ExitProc(); break;
            default        : throw new CompileTimeError(this._lineID, `Unsupported <Procedure> token "${token.value}"`);
        }

        token.ID = ID;
        token.type = ["Procedure", token.type];
        return token;
    }

    PrintProc() { // PrintProc ::= "print" StackExpr
        return {
            type  : "print",
            value : this.StackExpr(),
        }
    }

    MakeProc() { // MakeProc ::= "make" Assignment | "make" TargetArg | "make" WORD Block
        return {
            type  : "make",
            value : this.Assignment(true),
        }
    }

    FreeProc() { // FreeProc ::= "free" WORD
        return {
            type : "free",
            value : this._eat("WORD"),
        }
    }

    ReplaceProc() { // ReplaceProc ::= "replace" WORD "=" StackExpr | "replace" WORD "with" StackExpr
        const token = this._eat("WORD");
        this._eat("SPACE");
        if(this._lookahead === null) throw new SyntaxError(`at line ${this._lineID}: <replace> procedure expected <assignment>`);
        
        if(this._lookahead.type == "ASSIGN") {
            if(this._lookahead.value !== "=") throw new SyntaxError("<replace> procedure only supports strict assignment");
            this._eat("ASSIGN");
        }
        else {
            if(this._lookahead.value !== "with") throw new SyntaxError("<replace> procedure expected <with> or \"=\"");
            this._eat("procKeyword");
        }
        this._eat("SPACE");

        return {
            type  : "replace",
            value : {
                ID     : this._lineID, // design consistency
                type   : "Assignment",
                target : token,
                value  : this.StackExpr(),
            }
        };
    }

    LoopProc() { // LoopProc ::= "loop" StackExpr Block | "loop" StackExpr "with" WORD Block
        const value = this.StackExpr();
        if(this._lookahead !== null && this._lookahead.type === "procKeyword") {
            if(this._eat("procKeyword").value !== "with") throw new SyntaxError("<loop> procedure expected optional keyword \"with\" after <StackExpr> and before <block> declaration");
            this._eat("SPACE");
            return this._handCraftLoop(this._eat("WORD"), value);
        }
        const block = this.Block();
        
        return {
            type  : "loop",
            value : value,
            block : block,
        }
    }

    _handCraftLoop(target, value) {
        target = {
            type  : "StackCall",
            value : target.value,
        };

        this._eat("SPACE");
        const token = {
            type  : "when",
            value : {
                type  : "StackExpr",
                value : [ { type  : "NumericLiteral", value : 1 } ],
            },
            block : {
                type  : "Block",
                value : [
                    {
                        ID    : this._lineID,
                        type  : ["Procedure", "make"],
                        value : {
                            ID     : this._lineID,
                            type   : "Assignment",
                            target : target,
                            value  : {
                                type : "StackExpr",
                                value : [ { type  : "NumericLiteral", value : -1 } ], // this init value allows to solve problems with the <next> procedure
                            },
                        },
                    },
                    {
                        ID    : this._lineID,
                        type  : ["Procedure", "loop"],
                        value : value,
                        block : this.Block(),
                    },
                ],
            },
        };

        token.block.value[1].block.value.unshift({
            ID     : this._lineID,
            type   : "Assignment",
            target : target,
            value  : {
                type  : "StackExpr",
                value : [ target, { type  : "NumericLiteral", value : 1 }, { type  : "StackOperand", value : "+" } ],
            },
        });

        return token;
    }

    UseProc() { // UseProc ::= "use" StringLiteral "with" WORD | "use" StringLiteral
        const token = {
            type: "use",
            value: this.StringLiteral(),
        }

        let label;
        if(this._lookahead !== null) {
            if(this._lookahead.type !== "NEWLINE") this._eat("SPACE");
            if(!["NEWLINE", "}"].includes(this._lookahead.type)) {
                if(this._eat("procKeyword").value !== "with") throw new SyntaxError("<use> procedure expected optional keyword \"with\" after target argument");
                this._eat("SPACE");
                label = this._eat("WORD");
            }
        }
        
        if(label) token.label = label.value;
        return token;
    }

    WhenProc(canLoop = true) { // WhenProc ::= "when" StackExpr Block | "when" StackExpr Block ElseProc
        const value = this.StackExpr();
        const loops = (this._lookahead !== null && this._lookahead.type === "procKeyword") ? this._eat("procKeyword").value : false;
        if(this._lookahead?.type === "SPACE") this._eat("SPACE");
        const block = this.Block();
        
        const token = {
            type  : "when",
            value : value,
            block : block,
        }
        if(loops) {
            if(!canLoop) throw new CompileTimeError(this._lineID, "using <else> blocks as looping conditionals is confusing and thus not allowed");
            if(loops !== "loop") throw new CompileTimeError(this._lineID, `invalid <procKeyword> token "${loops}" in this context, expected at most "loop"`);
            token.loops = true;
        }

        if(this._lookahead !== null) {
            if(!["NEWLINE", "}"].includes(this._lookahead.type)) {
                if(this._eat("procKeyword").value !== "else") throw new SyntaxError(`at line ${this._lineID}: tried pairing <when> procedure to a block owned by a procedure other than <else>`);
                token.else = this.ElseProc();
            }
        }

        return token;
    }

    ElseProc() { // ElseProc ::= "else" Block | "else" WhenProc
        this._eat("SPACE");
        if(this._lookahead !== null && this._lookahead.type === "procKeyword") {
            if(this._eat("procKeyword").value !== "when") throw new CompileTimeError(this._lineID, "<else> procedure token expected either block declaration or when statement");
            this._eat("SPACE");
            const token = this.WhenProc(false);
            token.ID = this._lineID;
            token.type = ["Procedure", token.type];
            return token;
        }    
        else return {
            ID    : this._lineID,
            type  : ["Procedure", "else"],
            block : this.Block(),
        };
    }

    NextProc() { // NextProc ::= "next"
        if(this._lookahead !== null && this._lookahead.type === "SPACE") this._eat("SPACE");
        return {
            type  : "next",
            value : null,  // useless
        }
    }

    ExitProc() { // ExitProc ::= "exit" | "exit" StackExpr
        let value = null;
        if(this._lookahead !== null && this._lookahead.type === "SPACE") {
            this._eat("SPACE");
            if(this._lookahead !== null && !["NEWLINE", "}"].includes(this._lookahead.type)) value = this.StackExpr();
        }

        return {
            type : "exit",
            value : value,
        }
    }

    FlagProc() { // FlagProc ::= "flag" StackExpr
        return {
            type  : "flag",
            value : this.StackExpr(),
        }
    }

    FuncProc() { // FuncProc ::= "def" WORD "with" InputList Block | "def" WORD "=>" InputList Block
        const name = this._eat("WORD");
        this._eat("SPACE");
        
        const argStream = [];
        if(this._lookahead !== null && this._lookahead.type !== "{") {
            const symbol = this._eat(this._lookahead?.type === "procKeyword" ? "procKeyword" : "WORD").value;
            if(!["with", "=>"].includes(symbol)) throw new CompileTimeError(this._lineID, `<def> procedure expected either "with" keyword or "=>" after the function's name`);  
            this._eat("SPACE");

            argStream.push(this._eat("WORD"));
            this._eat("SPACE");
            while(this._lookahead !== null && this._lookahead.type === "WORD") {
                argStream.push(this._eat("WORD"));
                this._eat("SPACE");
            }
        }
        
        const token = {
            type  : "def",
            name  : name,
            block : this.Block(),
        }

        if(argStream.length) token.args = argStream;
        return token;
    }

    Block() { // Block ::= "{" Program "}"
        if(this._lookahead !== null && this._lookahead.type === "NEWLINE") this._eat("NEWLINE");
        this._eat("{");
        if(this._lookahead !== null && this._lookahead.type === "NEWLINE") this._eat("NEWLINE");
        else this._eat("SPACE");

        const linesContainer = this.Program();
        this._eat("}");
        
        try { if(this._lookahead != null && this._lookahead.type !== "NEWLINE") this._eat("SPACE"); }
        catch(e) {
            throw new SyntaxError(`at line ${this._lineID}: <block> tokens expect either NEWLINE or SPACE after their closing bracket`);
        }
        
        return {
            type  : "Block",
            value : linesContainer.body,
        }
    }

    FuncCall() { // FuncCall ::= WORD"(" StackExpr ")" | WORD"(" Iterator ")"
        const name = this._eat("WORD");
        name.value = name.value.slice(0, -1);
        this._eat("SPACE");
        let value = null;
        if(this._lookahead !== null && this._lookahead.type === "@") { // Iterator ::= "@"WORD
            this._eat("@");
            value = this._eat("WORD");
            this._eat("SPACE");
        }
        else if(this._lookahead !== null && this._lookahead.type !== ")") value = this.StackExpr();
        this._eat(")");

        return {
            type  : "FuncCall",
            name  : name,
            value : value,
        };
    }

    Assignment(canOmit = false) { // Assignment ::= Target AssignmentSymbol StackExpr | Target
        const target = this.Target();
        let value;
        if(this._lookahead === null || this._lookahead.type === "NEWLINE") {
            if(!canOmit) throw new SyntaxError(`at line ${this._lineID}: lazy assignment is only valid inside of a <make> procedure`);
            value = {
                type: "StackExpr",
                value: [{ type: "NumericLiteral", value: 0, }],
            };
        }
        else {
            const symbol = this._eat("ASSIGN").value;
            this._eat("SPACE");
            value = this.StackExpr();
            if(symbol !== "=") {
                const injectedOps = [
                    { type: "StackCall"   , value: target.value instanceof Array ? [...target.value] : target.value },
                    { type: "StackOperand", value: "rot>"       },
                    { type: "StackOperand", value: symbol[0]    }
                ];
                value.value.push(...injectedOps);
            }
        }

        return {
            ID     : this._lineID,
            type   : "Assignment",
            target : target,
            value  : value,
        };
    }

    StackExpr() { // StackExpr ::= StackElement | StackExpr StackElement
        const StackElementList = [];
        while(this._lookahead !== null && !["]", "{", "}", "NEWLINE", "procKeyword", ")"].includes(this._lookahead.type)) {
            StackElementList.push(this.StackElement());
            if(this._lookahead !== null && this._lookahead.type !== "NEWLINE") this._eat("SPACE");
        }
        if(!StackElementList.length) throw new SyntaxError("Empty <StackExpr>");
        return { type: "StackExpr", value: StackElementList };
    }

    StackElement() { // StackElement ::= StackOp | Literal | StackCall | FuncCall
        switch(this._lookahead.type) {
            case "StackOp" : return this.StackOp();
            case "WORD"    : return this._lookahead.value.slice(-1) === "(" ? this.FuncCall() : this.StackCall();
            default        : return this.Literal();
        }
    }

    StackOp() {
        const token = this._eat("StackOp");
        return {
            type  : 'StackOperand',
            value : token.value,
        };
    }

    Target() { // Target ::= StackCall " "
        const token = this.StackCall();
        if(this._lookahead !== null && this._lookahead.type !== "NEWLINE") {
            try { this._eat("SPACE"); }
            catch(e) { throw new SyntaxError("Expected <DOT> or <StackExpr> to access <StackCall> property, or space to end this token"); }
        }
        return token;
    }

    StackCall() {
        const token = this._eat("WORD");
        if(this._checkPropertyAhead()) {
            token.value = [token.value];
            while(this._checkPropertyAhead()) token.value.push(this.Property());    
        }

        return {
            type  : 'StackCall',
            value : token.value,
        };
    }

    _checkPropertyAhead() {
        return this._lookahead !== null && ["DOT", "["].includes(this._lookahead.type);
    }

    Property() { // Property ::= "." ValidName | "[" " " StackExpr "]"
        let res;
        if(this._lookahead.type === "DOT") {
            this._eat("DOT");
            res = this._eat("WORD");
        }
        else {
            this._eat("[");
            this._eat("SPACE");
            res = this.StackExpr();
            this._eat("]");
        }
        return res;
    }

    Literal() { // Literal ::= NumericLiteral | StringLiteral
        switch(this._lookahead.type) {
            case "NUMBER" : return this.NumericLiteral();
            case "STRING" : return this.StringLiteral();
            default       : throw new CompileTimeError(this._lineID, `Invalid literal token type <${this._lookahead.type}>`);
        }
    }

    NumericLiteral() { // NumericLiteral ::= NUMBER
        const token = this._eat("NUMBER");
        return {
            type  : 'NumericLiteral',
            value : Number(token.value),
        };
    }

    StringLiteral() { // StringLiteral ::= STRING
        const token = this._eat("STRING");
        return {
            type  : 'StringLiteral',
            value : token.value.slice(1, -1), // strip quotes
        };
    }

    _eat(tokenType) {
        const token = this._lookahead;
        if(token === null) throw new CompileTimeError(this._lineID, `Unexpected end of input, expected: <${tokenType}>`);
        if(token.type !== tokenType) throw new CompileTimeError(this._lineID, `Unexpected token of type ${token.type}, expected: <${tokenType}>`);
        
        if(tokenType == "NEWLINE") this._lineID += token.value.split("\n").length - 1;
        this._lookahead = this._tokenizer.getNextToken();

        return token;
    }
}