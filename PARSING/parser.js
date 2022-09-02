import Tokenizer from "./tokenizer.js";
import { CompileTimeError } from "../COMPILER UTILS/errors.js";

export default class Parser {
    constructor(compilerRef) {
        this._string = "";
        this._tokenizer = new Tokenizer(compilerRef);
    }
    
    parse(string, label = null) { // Parses a string into a JSON AST
        this._string = string;
        if(label) this.label = label;
        this._tokenizer.init(string);
        this._lookahead = this._tokenizer.getNextToken();
        this._lineID = 0;
        this.tempFunctions = [];
        const program = this.Program();
        if(this._lookahead !== null) throw new CompileTimeError(this._lineID, "expected EOF but got trailing content outside of main program");
        //console.log(program); // used for debugging
        return program;
    }

    _addLabel(token, wasExpression = false) {
        if(!this.label || this.tempFunctions.includes(token.name)) return token;
        return {
            type  : "StackCall",
            value : [this.label, token],
        };
    }

    Program() { // Program ::= ( Expression )*
        let lines = [];
        if(this._lookahead !== null && this._lookahead.type === "NEWLINE") this._eat("NEWLINE");
        while(this._lookahead !== null && this._lookahead.type !== "}") {
            if(this._lookahead.type === "SPACE") this._eat("SPACE");
            lines.push(this.Expression());
        }
        lines = lines.filter(l => l);
        if(!lines.length) console.warn("Empty <Program>");

        return {
            ID   : this._lineID,
            type : "Program",
            body : lines,
        };
    }

    Expression() { // Expression ::= ( Procedure | Assignment | FuncCall ) LineEnder
        let token = null;
        
        switch(this._lookahead.type) {
            case "procKeyword" : token = this.Procedure();  break;
            case "WORD"        : token = this._lookahead.value.slice(-1) === "(" ? this.FuncCall() : this.Assignment(); break;
            case "}"           : break;
            case "NEWLINE"     : break;
            default            : throw new CompileTimeError(this._lineID, `Unrecognized statement "${this._lookahead.value}" as any known <Expression> token type`);
        }

        if(this._lookahead !== null && this._lookahead.type === "SPACE") this._eat("SPACE");
        if(this._lookahead !== null && this._lookahead.type !== "}") this._eat("NEWLINE");   // LineEnder ::= "\n" | "}"
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

    PrintProc() { // PrintProc ::= "print" StackExpr ( "with" StackExpr )?
        const token = {
            type  : "print",
            value : this.StackExpr().value,
        };

        if(this._lookahead !== null && this._lookahead.type === "procKeyword") {
            if(this._eat("procKeyword").value !== "with") throw new CompileTimeError(this._lineID, `<print> procedure expected optional keyword "with" or NEWLINE after <StackExpr> argument`);
            this._eat("SPACE");
            token.style = this.StackExpr().value;
        }

        return token;
    }

    MakeProc() { // MakeProc ::= "make" Assignment
        return {
            type  : "make",
            value : this.Assignment(true), // no further extraction
        }
    }

    FreeProc() { // FreeProc ::= "free" WORD
        return {
            type : "free",
            value : this._eat("WORD").value,
        }
    }

    ReplaceProc() { // ReplaceProc ::= "replace" WORD ( "=" | "with" ) StackExpr
        const token = this._eat("WORD").value;
        this._eat("SPACE");
        if(this._lookahead === null) throw new SyntaxError(`at line ${this._lineID}: <replace> procedure expected <assignment>`);
        
        if(this._lookahead.type == "ASSIGN") {
            if(this._eat("ASSIGN").value !== "=") throw new SyntaxError("<replace> procedure only supports strict assignment");
        }
        else if(this._eat("procKeyword").value !== "with") throw new SyntaxError("<replace> procedure expected <with> or \"=\"");
        this._eat("SPACE");

        return {
            type   : "replace",
            target : token,
            value  : this.StackExpr().value,
        };
    }

    LoopProc() { // LoopProc ::= "loop" StackExpr ( "with" WORD )? Block
        const value = this.StackExpr().value;
        if(this._lookahead !== null && this._lookahead.type === "procKeyword") {
            if(this._eat("procKeyword").value !== "with") throw new SyntaxError("<loop> procedure expected optional keyword \"with\" after <StackExpr> and before <block> declaration");
            this._eat("SPACE");
            return this._handCraftLoop(this._eat("WORD").value, value);
        }
        
        return {
            type  : "loop",
            value : value,
            block : this.Block().value,
        }
    }

    _handCraftLoop(target, value) {
        this._eat("SPACE");
        const token = {
            type  : "when",
            value : [ 1 ],
            block : [
                {
                    ID    : this._lineID,
                    type  : ["Procedure", "make"],
                    value : {
                        ID     : this._lineID,
                        type   : "Assignment",
                        target : target,
                        value  : {
                            type  : "StackExpr",
                            value : [ -1 ], // this init value allows to solve problems with the <next> procedure
                        }
                    },
                },
                {
                    ID    : this._lineID,
                    type  : ["Procedure", "loop"],
                    value : value,
                    block : this.Block().value,
                },
            ],
        };

        token.block[1].block.unshift({
            ID     : this._lineID,
            type   : "Assignment",
            target : target,
            value  : {
                type : "StackExpr", // necessary because it could be a block
                value : [ { type: "StackCall", value : target }, 1, { type  : "StackOperand", value : "+" } ],
            },
        });

        return token;
    }

    UseProc() { // UseProc ::= "use" STRING "with" WORD
        const token = {
            type: "use",
            value: this.StringLiteral().value,
        }

        this._eat("SPACE");
        if(this._eat("procKeyword").value !== "with") throw new SyntaxError("<use> procedure expected keyword \"with\" after target argument");
        this._eat("SPACE");
        token.label = this._eat("WORD").value;
        return token;
    }

    WhenProc(canLoop = true) { // WhenProc ::= "when" StackExpr ( "loop" )? Block ( ElseProc )?
        const value = this.StackExpr().value;
        const loops = (this._lookahead !== null && this._lookahead.type === "procKeyword") ? this._eat("procKeyword").value : false;
        if(this._lookahead?.type === "SPACE") this._eat("SPACE");
        
        const token = {
            type  : "when",
            value : value,
            block : this.Block().value,
        }
        if(loops) {
            if(!canLoop) throw new CompileTimeError(this._lineID, "using <else> blocks as looping conditionals is confusing and thus not allowed");
            if(loops !== "loop") throw new CompileTimeError(this._lineID, `invalid <procKeyword> token "${loops}" in this context, expected at most "loop"`);
            token.loops = true;
        }

        if(this._lookahead !== null) {
            if(!["NEWLINE", "}"].includes(this._lookahead.type)) {
                if(this._eat("procKeyword").value !== "else") throw new SyntaxError(`at line ${this._lineID}: tried pairing <when> procedure to a block owned by a procedure other than <else>`);
                const els = this.ElseProc();
                token.else = { block: els.block };
                if(els.value) token.else.value = els.value;
                if(els.else)  token.else.else  = els.else;
            }
        }

        return token;
    }

    ElseProc() { // ElseProc ::= "else" ( Block | WhenProc )
        this._eat("SPACE");
        if(this._lookahead !== null && this._lookahead.type === "procKeyword") {
            if(this._eat("procKeyword").value !== "when") throw new CompileTimeError(this._lineID, "<else> procedure token expected either block declaration or when statement");
            this._eat("SPACE");
            const token = this.WhenProc(false);
            token.ID = this._lineID; // necessary
            token.type = ["Procedure", token.type];
            return token;
        }    
        else return {
            ID    : this._lineID, // necessary
            type  : ["Procedure", "else"],
            block : this.Block().value,
        };
    }

    NextProc() { // NextProc ::= "next"
        if(this._lookahead !== null && this._lookahead.type === "SPACE") this._eat("SPACE");
        return {
            type  : "next",
        }
    }

    ExitProc() { // ExitProc ::= "exit" ( StackExpr )?
        let value = null;
        if(this._lookahead !== null && this._lookahead.type === "SPACE") {
            this._eat("SPACE");
            if(this._lookahead !== null && !["NEWLINE", "}"].includes(this._lookahead.type)) value = this.StackExpr().value;
        }

        return {
            type : "exit",
            value : value,
        }
    }

    FlagProc() { // FlagProc ::= "flag" StackExpr
        return {
            type  : "flag",
            value : this.StackExpr().value,
        }
    }

    FuncProc() { // FuncProc ::= "def" ( Helper )? WORD ( ( "with" | "=>" ) InputList )? Block
        const name = this._eat("WORD").value;
        this._eat("SPACE");

        if(this._lookahead.type === "$") {
            const help = this.Helper().value;
            if(help !== "temp") throw new CompileTimeError(this._lineID, `received invalid <HelperKeyword> in context, expected "temp" but got ${help}`);
            this.tempFunctions.push(name);
            this._eat("SPACE");
        }

        const argStream = [];
        if(this._lookahead !== null && this._lookahead.type !== "{") {
            const symbol = this._eat(this._lookahead?.type === "procKeyword" ? "procKeyword" : "WORD").value;
            if(!["with", "=>"].includes(symbol)) throw new CompileTimeError(this._lineID, `<def> procedure expected either "with" keyword or "=>" after the function's name`);  
            this._eat("SPACE");

            argStream.push(this._eat("WORD").value); //this needs to be here because it's mandatory to have at least one argument after =>/with
            this._eat("SPACE");
            while(this._lookahead !== null && this._lookahead.type === "WORD") {
                argStream.push(this._eat("WORD").value);
                this._eat("SPACE");
            }
        }
        
        const token = {
            type  : "def",
            name  : name,
            block : this.Block().value,
        }

        if(argStream.length) token.args = argStream;
        return token;
    }

    Helper() { // Helper ::= "$"WORD
        this._eat("$");
        return this._eat("WORD");
    }

    Block() { // Block ::= "{" Program "}"
        if(this._lookahead !== null && this._lookahead.type === "NEWLINE") this._eat("NEWLINE");
        this._eat("{");
        if(this._lookahead !== null && this._lookahead.type === "NEWLINE") this._eat("NEWLINE");
        else this._eat("SPACE");

        const linesContainer = this.Program().body;
        this._eat("}");
        
        try { if(this._lookahead != null && this._lookahead.type !== "NEWLINE") this._eat("SPACE"); }
        catch(e) {
            throw new SyntaxError(`at line ${this._lineID}: <block> tokens expect either NEWLINE or SPACE after their closing bracket`);
        }
        
        return {
            type  : "Block",
            value : linesContainer,
        }
    }

    FuncCall() { // FuncCall ::= ( StackCall "." )? WORD"(" ( StackExpr | Iterator )? ")"
        const name = this._eat("WORD").value.slice(0, -1);
        this._eat("SPACE");
        let value;
        if(this._lookahead !== null && this._lookahead.type === "@") {
            value = this.Iterator(); // necessary
            this._eat("SPACE");
        }
        else if(this._lookahead !== null && this._lookahead.type !== ")") {
            value = this.StackExpr(true).value;
            if(value[0].endsIter === true) value = value[0];
        }
        this._eat(")");

        return {
            type  : "FuncCall",
            name  : name,
            value : value,
        };
    }

    Iterator() { // Iterator ::= "@"WORD
        this._eat("@");
        return {
            type  : "Iterator",
            value : this._eat("WORD").value,
        };
    }

    Assignment(canOmit = false) { // Assignment ::= TargetArg ( ASSIGN ( StackExpr | Block ) )?
        const target = this._checkIterator(this.Target(), false).value;
        let value;
        if(target[target.length - 1]?.type === "FuncCall") value = "omitted";
        
        if(this._lookahead === null || this._lookahead.type === "NEWLINE" || this._lookahead.type === "}") {
            if(value !== "omitted") {
                if(!canOmit) throw new SyntaxError(`at line ${this._lineID}: lazy assignment is only valid inside of a <make> procedure`);   
                value = { type : "StackExpr", value : [0] };
            }
        }
        else {
            if(value === "omitted") throw new CompileTimeError(this._lineID, "cannot assign to <FuncCall> items, expected <NEWLINE> or <EOF> token");
            const symbol = this._eat("ASSIGN").value;
            this._eat("SPACE");
            value = (this._lookahead !== null && this._lookahead.type === "{") ? this.Block() : this.StackExpr(); //need to be different, can't extract further

            if(symbol !== "=") {
                if(value.type !== "StackExpr") throw new CompileTimeError(this._lineID, `Unstrict assignment (${symbol}) is only valid if followed by a <StackExpr> argument`);
                const injectedOps = [
                    { type: "StackCall"   , value: target instanceof Array ? [...target] : target },
                    { type: "StackOperand", value: "rot>"       },
                    { type: "StackOperand", value: symbol[0]    },
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

    StackExpr(allowsIterator = false) { // StackExpr ::= StackElement*
        const StackElementList = [];
        let found = false;
        while(this._lookahead !== null && !["]", "{", "}", "NEWLINE", "procKeyword", ")"].includes(this._lookahead.type)) {
            const stackElement = this.StackElement(allowsIterator); // no further extraction needed, it's useful to have the whole token to differentiate them
            if(allowsIterator && !found && stackElement.endsIter) found = true;
            StackElementList.push(stackElement);
            if(this._lookahead !== null && this._lookahead.type !== "NEWLINE") this._eat("SPACE");
        }
        if(!StackElementList.length) throw new CompileTimeError(this._lineID, "Empty <StackExpr>");
        if(found && StackElementList.length !== 1) throw new CompileTimeError(this._lineID, "cannot have other arguments to <FuncCall> when an iterator is present");
        return { type: "StackExpr", value: StackElementList };
    }

    StackElement(allowsIterator) { // StackElement ::= StackOp | Literal | StackCall | FuncCall
        switch(this._lookahead.type) {
            case "StackOp" : return this.StackOp();
            case "WORD"    : return this._lookahead.value.slice(-1) === "(" ? this._addLabel(this.FuncCall()) : this._checkIterator(this.StackCall(), allowsIterator);
            default        : return this.Literal().value;
        }
    }

    _checkIterator(token, allowsIterator) {
        if(!allowsIterator && token.endsIter) throw new CompileTimeError(this._lineID, "cannot use iterators outside of <FuncCall> tokens");
        return token;
    }

    StackOp() { // StackOp ::= ::= "dup" | "drop" | ...
        const token = this._eat("StackOp");
        return {
            type  : 'StackOperand',
            value : token.value,
        };
    }

    Target() { // TargetArg ::= StackCall
        const token = this.StackCall();
        if(this._lookahead !== null && this._lookahead.type !== "NEWLINE") {
            try { this._eat("SPACE"); }
            catch(e) { throw new SyntaxError("Expected <DOT> or <StackExpr> to access <StackCall> property, or space to end this token"); }
        }
        return token;
    }

    StackCall() { // StackCall ::= WORD ( PropertyList )?
        let token = this._eat("WORD"); // no extraction here, Property is checked based on its type
        if(this._checkPropertyAhead()) {
            token.value = [token.value];
            while(this._checkPropertyAhead()) token.value.push(this.Property()); // same as above
        }

        token = {
            type  : 'StackCall',
            value : token.value,
        };
        if(token.value[token.value.length - 1]?.type === "Iterator") {
            token.value[token.value.length - 1].type = "WORD";
            token.endsIter = true;
        }
        return token;
    }

    _checkPropertyAhead() {
        return this._lookahead !== null && ["DOT", "["].includes(this._lookahead.type);
    }

    Property() { // Property ::= "."( WORD | FuncCall ) | "[" StackExpr "]"
        let res;
        if(this._lookahead.type === "DOT") {
            this._eat("DOT");
            if(this._lookahead !== null && this._lookahead.type === "@") {
                res = this.Iterator();
                if(this._checkPropertyAhead()) throw new CompileTimeError(this._lineID, "property chains containing an <Iterator> token must end with it");
            }
            else res = (this._lookahead !== null && this._lookahead.value.slice(-1) === "(") ? this.FuncCall() : this._eat("WORD");
        }
        else {
            this._eat("[");
            this._eat("SPACE");
            res = this.StackExpr();
            this._eat("]");
        }
        return res;
    }

    Literal() { // Literal ::= NUMBER | STRING
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
        if(token.value.match(/\n/) !== null) throw new CompileTimeError(this._lineID, "<StringLiteral> tokens cannot span multiple lines");
        return {
            type  : 'StringLiteral',
            value : token.value.slice(1, -1).replace(/&new/g, '\n'), // strip quotes, escape newlines
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