import tokenize from "./tokenizer.js";

import iota from "../../UTILS/general.js";
const IGNORED_TOKEN_TYPES = {
    space   : iota(),
    EOL     : iota(),
    comment : iota(),
};

const CONSTANT_REPLACE_MAP = {
    TRUE  : 1,
    FALSE : 0,
    PI    : Math.PI,
    INF   : Infinity,
};

const MAKEPROC_SPECS = {
    const   : iota(),
    global  : iota(),
    dynamic : iota(),
    //type    : iota(),
}

import {ParsingError} from "../customErrors.js";
export default class Parser {
    constructor() {

    }

    correct_tokenType(tokenType, match) {
        switch(tokenType) {
            case "op"       : return "stackOp";
            case "WORD"     : return match == "any" ? "stackOp" : tokenType;
            default         : return tokenType;
        }
    }

    onNumberToken(tokenValue) {
        return tokenValue in CONSTANT_REPLACE_MAP ?
               CONSTANT_REPLACE_MAP[tokenValue]   :
               Number(tokenValue.replace(/_/g, ""));
    }

    parse(text) {
        this.tokens           = [];
        this.defloopStack     = []; // keep track of functions and loops, to manage "next" and "exit" procedures.
        this.beginExpr_lineID = 1;  // more so for a general indication
        this.currentDepth     = 0;  // global scope

        let justSpaced = false;
        let lineNumber = 1;
        tokenize(text, (match, tokenType, tokens) => {
            if(tokenType == "EOL") lineNumber += match.length;
            if(tokenType in IGNORED_TOKEN_TYPES) return justSpaced = tokenType != "comment"; // uncaught.

            tokens.push({
                line  : lineNumber,
                type  : this.correct_tokenType(tokenType, match),
                value : tokenType == "num" ? this.onNumberToken(match) :
                        tokenType == "str" ? match.slice(1, -1) : match,
            });

            if(justSpaced) {
                justSpaced = false;
                if(tokenType == "[") tokens[tokens.length - 1].isNewList = true;
            }
        }, this.tokens);

        //console.log(...this.tokens);
        return this.Program(true).value;
    }

    Program(isGlobal = false) { // Program : Expression*
        const expressions = [];
        
        while(this.peek_nextToken()?.type) {
            if(this.peek_nextToken()?.type == "}") break;
            expressions.push(this.Expression());
        }
        
        if(isGlobal && this.tokens.length) {
            this.throw(`Trailing content found outside of main program: ${
                this.tokens.reduce((acc, token) => acc + token.value, "")
            }`,
            this.tokens[0].line);
        }

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

        this.currentDepth++;
        const nextTokenValue = this.peek_nextToken()?.value;
        if(nextTokenValue == "then" || (noThen && nextTokenValue != "{")) { // no "and then?"!!
            if(!noThen || nextTokenValue == "then") this.get_nextToken_ifOfType("keyword");
            token.value.push(this.Expression(false));
        }
        else {
            this.get_nextToken_ifOfType("{");
            token.value = this.Program().value;
            this.get_nextToken_ifOfType("}");
        }
        
        this.currentDepth--;
        return token;
    }

    Expression(needsTerminator = true) { // Expression : (Procedure | Assignment) ";"?
        this.beginExpr_lineID = this.peek_nextToken()?.line;
        const token = this.peek_nextToken()?.type == "keyword" ?
                      this.Procedure(needsTerminator) :
                      this.Assignment();
        
        if(this.peek_nextToken()?.type == ";") this.get_nextToken_ifOfType(";");
        return token;
    }

    Procedure(needsTerminator) { // Procedure : PrintProc | IfProc | LoopProc
        const keyword = this.get_nextToken_ifOfType("keyword");

        switch(keyword.value) {
            case "print" : return this.PrintProc(needsTerminator);
            case "if"    : return this.IfProc();
            case "loop"  : return this.LoopProc();
            case "next"  : return this.NextProc();
            case "exit"  : return this.ExitProc();
            case "make"  : return this.MakeProc();
            default      : this.throw(`Procedure "${keyword.value}" is not implemented yet`);
        }
    }

    PrintProc(needsTerminator) { // PrintProc : "print" StackExpr
        return {
            type  : "PrintProc",
            value : this.StackExpr(needsTerminator).value,
        };
    }

    IfProc() { // IfProc : "if" StackExpr "loop"? Block ElseProc?
        const token = {
            type  : "IfProc",
            loops : false,
            value : this.StackExpr().value,
        };

        if(this.peek_nextToken()?.value == "loop") {
            this.get_nextToken_ifOfType("keyword");
            token.loops = true;
            this.defloopStack.push(token); // the token is valid only if it loops and needs to be validated before its block is parsed.
        }
        
        token.block = this.Block(token.loops).value;
        if(token.loops) this.defloopStack.pop();
        
        if(this.peek_nextToken()?.value == "else") token.else = this.ElseProc();
        return token;
    }

    ElseProc() { // ElseProc : "else" (IfProc | Block)
        this.get_nextToken_ifOfType("keyword");
        if(this.peek_nextToken()?.value == "when") {
            const procKW_lineID = this.get_nextToken_ifOfType("keyword").line;
            const token = this.IfProc();
            if(token.loops) this.throw('"Else-If" procedures cannot loop.', procKW_lineID);
            return token;
        }
        
        return {
            type  : "ElseProc",
            block : this.Block(true).value,
        };
    }

    LoopProc() { // LoopProc : "loop" StackExpr Block
        const token = {
            type  : "LoopProc",
            value : this.StackExpr().value,
        };

        this.defloopStack.push(token); // loop is always valid but must be validated before its block is parsed.
        token.block = this.Block().value;
        this.defloopStack.pop();
        return token;
    }

    NextProc() { // NextProc : "next"
        const nextTokenType = this.peek_nextToken()?.type;
        if(nextTokenType && nextTokenType != "}") this.get_nextToken_ifOfType(";", false);
        
        if(!this.defloopStack.length) this.throw('Cannot use "Next" procedure outside of a looping block');
        if(this.defloopStack[this.defloopStack.length - 1].type == "DefProc") this.throw("Next procedure cannot bypass the scope of a function");
        
        return {
            type : "NextProc",
        };
    }

    ExitProc() { // ExitProc : "exit" StackExpr?
        const tokenValue = this.StackExpr(true, true).value; // can be empty
        
        if(!this.defloopStack.length) this.throw('Cannot use "Exit" procedure outside of a looping or function block');
        const targetProc = this.defloopStack[this.defloopStack.length - 1];
        if(targetProc.type == "DefProc") {
            if(!tokenValue.length) this.throw("Exit procedure can be used with functions only if containing a Stack Expression argument");
            // handle functions stuff..
        }
        else if(tokenValue.length) this.throw("Exit procedure can be used with looping blocks only with no arguments", tokenValue[0].line); //get lineID from first stackEl

        if(!targetProc.trigger) targetProc.trigger = { sent : false };

        return {
            type    : "ExitProc",
            value   : tokenValue.length ? tokenValue : null,
            trigger : targetProc.trigger,
        };
    }

    MakeProc() { // MakeProc : "make" ("const" | "dynamic" | "global" | "type")<?> Assignment
        const token = {
            type  : "MakeProc",
        };
        
        while(this.peek_nextToken()?.type == "keyword") {
            const nextToken = this.get_nextToken_ifOfType("keyword");
            if(!(nextToken.value in MAKEPROC_SPECS)) {
                this.throw(
                    `"Make" procedure expected optional specifier "const", "dynamic" or "global" but got "${nextToken.value}"`,
                    nextToken.line
                );
            }

            if(token[nextToken.value]) {
                this.throw(
                    `Optional specifier "${nextToken.value}" was declared twice`,
                    nextToken.line
                );
            }

            if(nextToken.value == "global" && !this.currentDepth) {
                this.throw(
                    "No point in declaring a variable \"global\" in the global scope",
                    nextToken.line
                );
            }

            token[nextToken.value] = true;
        }

        token.value = this.Assignment(true);
        const assignmentTargetCallChain = token.value.target.value;
        const firstProperty = assignmentTargetCallChain[0];
        if(assignmentTargetCallChain.length == 1 && firstProperty.type == "instance") {
            this.throw(
                `Cannot use reserved word "${firstProperty.value}" to name a variable`,
                firstProperty.line
            );
        }
        
        return token;
    }

    Assignment(inMakeProc = false) { // Assignment : CallChain (":" Type)? "=" StackExpr
        const token = {
            type   : "Assignment",
            target : this.CallChain(true),
        };

        if(this.peek_nextToken()?.type == ":") {
            if(!inMakeProc) this.throw("Typed assignments are only possible within \"Make\" procedures", this.peek_nextToken().line);
            this.get_nextToken_ifOfType(":");
            token.typeSignature = this.Type().value;
        }

        this.get_nextToken_ifOfType("=");
        token.value = this.StackExpr(true).value;
        return token;
    }
    
    Type() { // Type : SingleType ("|" SingleType)*
        const token = {
            type  : "Type",
            value : [],
        };

        while(true) {
            const nextSingleType = this.SingleType();
            if(!nextSingleType) return token;
            token.value.push(nextSingleType);
            if(this.peek_nextToken()?.type != "|") return token;
            this.get_nextToken_ifOfType("|");
        }
    }

    SingleType() { // SingleType : (TYPE | WORD) | "[" Type "]"
        const nextTokenType = this.peek_nextToken()?.type;
        if(nextTokenType == "[") {
            this.get_nextToken_ifOfType("[");
            const token = this.Type();
            this.get_nextToken_ifOfType("]");
            return token;
        }

        if(nextTokenType == "WORD" || nextTokenType == "type") return this.get_nextToken_ifOfType(nextTokenType);
    }

    StackExpr(atLineEnd = false, allowEmpty = false) { // StackExpr : (StackValue | STACKOP | CallChain)+
        const token = {
            type    : "StackExpr",
            value   : [],
        };

        while(true) {
            const nextToken = this.peek_nextToken();
            switch(nextToken?.type) {
                case "["        :
                case "WORD"     :
                case "instance" : token.value.push(this.CallChain()); break;
                
                case "num" :
                case "str" : token.value.push(this.Value()); break;
                
                case "type"    : if(nextToken.value == "void") this.throw("Cannot cast to <void> in any circumstance");
                                 nextToken.type = "stackOp";
                case "stackOp" : token.value.push(this.get_nextToken_ifOfType("stackOp")); break;

                default        : if(atLineEnd) this.throw(`Unexpected token "${nextToken.value}" of type "${nextToken.type}" in Stack Expression, expected LiteralValue, CallChain or StackOperator`, nextToken.line);
                case "}"       :
                case ";"       :
                case undefined :
                    if(!allowEmpty && !token.value.length) this.throw("Missing Stack Expression argument");
                    return token;
            }
        }
    }

    CallChain(asTarget = false) { // CallChain : Property (("." Property) | IDProp)*
        this.eatOptionalSpace();
        const token = {
            type  : "CallChain",
            depth : this.currentDepth,
            value : [this.Property(asTarget)],
        };

        while(true) {
            const nextToken = this.peek_nextToken();
            if(nextToken.isNewList) return token;

            if(nextToken.type == ".") this.get_nextToken_ifOfType(".");
            else if(nextToken.type != "[") return token;
            
            token.value.push(this.Property());
        }
    }

    Property(asTarget = false) { // Property : IDProp | WORD
        const nextToken = this.peek_nextToken();
        if(nextToken?.type != "[") return this.get_nextToken_ifOfType(nextToken?.type == "instance" ? "instance" : "WORD");
        if(asTarget) this.throw("Cannot build list as target of assignment", nextToken?.line);
        return this.IDProp();
    }

    IDProp() { // IDProp : "[" StackExpr "]"
        this.get_nextToken_ifOfType("[");
        const token = {
            type  : "IndexedProperty",
            value : this.StackExpr(false, true).value,
        };
        this.get_nextToken_ifOfType("]");
        return token;
    }

    Value() { // Value : NUM | STR
        const token = {...this.grab_nextToken()};
        if(!["num", "str"].includes(token.type)) this.throw(`Unexpected token of type ${token.type}, expected: NUM or STR`, token.line);
        return token;
    }

    peek_nextToken() {
        return this.tokens[0] || null;
    }

    grab_nextToken() {
        return this.tokens.shift() || null;
    }

    eatOptionalSpace() {
        if(this.peek_nextToken()?.type == "space") this.get_nextToken_ifOfType("space");
    }

    demand(token, expectedType) {
        if(token === null) this.throw(`Unexpected end of input, expected ${expectedType}`);
        if(token.type !== expectedType) this.throw(`Unexpected token of type "${token.type}", expected "${expectedType}"`, token.line);
        return token;
    }

    get_nextToken_ifOfType(expectedType, consume = true) {
        return this.demand(
            consume ? this.grab_nextToken() : this.peek_nextToken(),
            expectedType
        );
    }

    throw(errorMsg, lineID = this.beginExpr_lineID) {
        throw new ParsingError(errorMsg, "Syntax ", lineID);
    }
}