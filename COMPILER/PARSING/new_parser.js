import tokenize from "./tokenizer.js";

import iota from "../../UTILS/general.js";
const IGNORED_TOKEN_TYPES = {
    EOL     : iota(),
    comment : iota(),
};

const CONSTANT_REPLACE_MAP = {
    TRUE  : 1,
    FALSE : 0,
    PI    : Math.PI,
    INF   : Infinity,
};

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
               Number(tokenValue.replace("_", ""));
    }

    parse(text) {
        this.tokens       = [];
        this.defloopStack = []; // keep track of functions and loops, to manage "next" and "exit" procedures.

        tokenize(text, (match, tokenType, tokens) => {
            if(tokenType in IGNORED_TOKEN_TYPES || (tokenType == "space" && this.tokens[this.tokens.length - 1]?.type != "]")) return;
            
            tokens.push({
                type  : this.correct_tokenType(tokenType, match),
    
                value : tokenType == "num" ? this.onNumberToken(match) :
                        tokenType == "str" ? match.slice(1, -1) : match,
            });
        }, this.tokens);

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

    Block(noThen = false) { // Block : ("{" Program "}") | ("then" Expression)
        const token = {
            type  : "Block",
            value : [],
        };

        const nextTokenValue = this.peek_nextToken()?.value;
        if(nextTokenValue == "then" || (noThen && nextTokenValue != "{")) { // no "and then?"!!
            if(!noThen || nextTokenValue == "then") this.get_nextToken_ifOfType("keyword");
            token.value.push(this.Expression(false));
            return token;
        }

        this.get_nextToken_ifOfType("{");
        token.value = this.Program().value;
        this.get_nextToken_ifOfType("}");

        return token;
    }

    Expression(needsTerminator = true) { // Expression : (Procedure | Assignment) ";"?
        const token = this.peek_nextToken()?.type == "keyword" ?
                      this.Procedure(needsTerminator) :
                      this.Assignment();
        
        if(this.peek_nextToken()?.type == ";") this.get_nextToken_ifOfType(";");
        return token;
    }

    Procedure(needsTerminator) { // Procedure : PrintProc | WhenProc | LoopProc
        const keyword = this.get_nextToken_ifOfType("keyword");

        switch(keyword.value) {
            case "print" : return this.PrintProc(needsTerminator);
            case "when"  : return this.WhenProc();
            case "loop"  : return this.LoopProc();
            case "next"  : return this.NextProc();
            case "exit"  : return this.ExitProc();
        }
    }

    PrintProc(needsTerminator) { // PrintProc : "print" StackExpr
        return {
            type  : "PrintProc",
            value : this.StackExpr(needsTerminator).value,
        };
    }

    WhenProc() { // WhenProc : "when" StackExpr "loop"? Block ElseProc?
        const token = {
            type  : "WhenProc",
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

    ElseProc() { // ElseProc : "else" (WhenProc | Block)
        this.get_nextToken_ifOfType("keyword");
        if(this.peek_nextToken()?.value == "when") {
            this.get_nextToken_ifOfType("keyword");
            const token = this.WhenProc();
            if(token.loops) this.throw('"Else-When" procedures cannot loop.');
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
        else {
            if(tokenValue.length) this.throw("Exit procedure can be used with looping blocks only with no arguments");
        }

        if(!targetProc.trigger) targetProc.trigger = { sent : false };

        return {
            type    : "ExitProc",
            value   : tokenValue.length ? tokenValue : null,
            trigger : targetProc.trigger,
        };
    }

    Assignment() {// Assignment : CallChain (":" Type)? "=" StackExpr
        const token = {
            type   : "Assignment",
            target : this.CallChain(true).value,
        };

        if(this.peek_nextToken()?.type == ":") {
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
            this.eatOptionalSpace();
            return token;
        }

        if(["WORD", "stackOp"].includes(nextTokenType)) return this.get_nextToken_ifOfType(nextTokenType);
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
                
                case "num"      :
                case "str"      : token.value.push(this.Value()); break;
                
                case "stackOp"  : token.value.push(this.get_nextToken_ifOfType("stackOp")); break;
                default         : if(atLineEnd) this.throw(`Unexpected token "${nextToken.value}" of type "${nextToken.type}" in Stack Expression, expected LiteralValue, CallChain or StackOperator.`);
                
                case "}"        :
                case ";"        :
                case undefined  : if(!allowEmpty && !token.value.length) this.throw("Missing Stack Expression argument");
                                  return token;
            }
        }
    }

    CallChain(asTarget = false) { // CallChain : Property (("." Property) | IDProp)*
        const token = {
            type  : "CallChain",
            value : [this.Property(asTarget)],
        };

        while(true) {
            const nextTokenType = this.peek_nextToken()?.type;
            if(nextTokenType == ".") this.get_nextToken_ifOfType(".");
            else if(nextTokenType != "[") {
                this.eatOptionalSpace();
                return token;
            }

            token.value.push(this.Property());
        }
    }

    Property(asTarget = false) { // Property : IDProp | WORD
        const nextTokenType = this.peek_nextToken()?.type;
        if(nextTokenType != "[") return this.get_nextToken_ifOfType(nextTokenType == "instance" ? "instance" : "WORD");
        if(asTarget) this.throw("Cannot build list as target of assignment.");
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
        if(!["num", "str"].includes(token.type)) this.throw(`Unexpected token of type ${token.type}, expected: NUM or STR`);
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
        if(token.type !== expectedType) this.throw(`Unexpected token of type "${token.type}", expected "${expectedType}"`);
        return token;
    }

    get_nextToken_ifOfType(expectedType, consume = true) {
        return this.demand(
            consume ? this.grab_nextToken() : this.peek_nextToken(),
            expectedType
        );
    }

    throw(errorMsg) {
        throw new ParsingError(errorMsg, "Syntax ");
    }
}