import * as StackEl from "./stack operators.js";
import {Type, runtime_checkGot_asValidExpected} from "./type checker.js";

// GameLangParser (GLP) Instance
import Parser from "./PARSING/new_parser.js";
const GLP = new Parser();

// Custom Console Instance
import Console from '../EDITOR/console.js';
const customConsole = new Console();

function print(msg) {
    customConsole.appendLog(msg);
}

function raise(msg) {
    customConsole.appendLog(msg, "Error");
    throw new Error(msg);
}

// TODO: clean up
import iota from "../../UTILS/general.js";
const mathSymbols = ["+", "-", "*", "/", "**", "and", "or", ">", "<", "==", "<<", ">>"];

const EXPR_TYPES = {
    // PROCEDURES
    "PrintProc" : (expr, compilerRef) => new PrintProc(expr, compilerRef),
    "WhenProc"  : (expr, compilerRef) => new WhenProc(expr, compilerRef),
    "LoopProc"  : (expr, compilerRef) => new LoopProc(expr, compilerRef),
    
    // OTHER STUFF
    "Assignment" : (expr, compilerRef) => new Assignment(expr, compilerRef),
};

export default class Compiler {
    constructor(state) {
        this.VALID_STATES = {
            debug    : iota(),
            debugAST : iota(),
            deploy   : iota(),
        };

        if(!(state in this.VALID_STATES)) throw new Error(`INVALID COMPILER STATE ${state}.`);
        this.state = state;
    }

    reset_runtime() {
        this.vars = [];
        if(this.state == this.VALID_STATES.deploy) print("\\clear");
    }

    parse(text) {
        try {
            const AST = GLP.parse(text);
            if(this.state == this.VALID_STATES.debugAST) print(JSON.stringify(AST, null, 2));
            return AST;
        }
        catch(err) {
            raise(err.message);
        }
    }

    compile(AST) {
        this.expressions = AST.map(expr => EXPR_TYPES[expr.type](expr, this));
        if(this.state == this.VALID_STATES.debug) print("Code compiled successfully.");
    }

    async run() {
        this.reset_runtime();
        if(!this.expressions) raise("Couldn't find any previous build to run.");

        //console.time("runtime");
        for(const expr of this.expressions) {
            await expr.exec();
        }
        //console.timeEnd("runtime");
        if(this.state == this.VALID_STATES.debug) print("Execution complete.");
    }

    build(text) {
        const AST = this.parse(text);
        this.compile(AST);
        print("Build complete.");
    }

    build_and_run(text) {
        this.build(text);
        this.run();
    }
}

class Variable {
    constructor(name, value, type = "any") {
        this.name = name;
        this.type = type;
        this.set(value);
    }

    set(value) {
        // verify that value is of type : 'valid for' this.type
        this.value = value;
    }
}

class Assignment {
    constructor(args) {
        this.target = new CallChain(args.target);
        this.value  = new StackExpr(args.value);
        if(args.typeSignature) this.expectedType = new Type(...this.parse_typeSignature(args.typeSignature));
    }

    parse_typeSignature(typeSignature) {
        const types = [];
        for(const type of typeSignature) {
            switch(type.type) {
                case "stackOp" : types.push(type.value); break;
                case "WORD"    : raise("not implemented!");
                case "Type"    : types.push([...this.parse_typeSignature(type.value)]); break;
            }
        }
        return types;        
    }

    async exec() {
        raise("Assignments don't run yet!");
        const target = await this.target.exec("write"); // TODO: get writeable reference
        target.set(await this.value.exec());
    }
}

// PROCEDURES
class Proc {
    constructor(args) {
        this.buildArgs(args);
    }
}

class PrintProc extends Proc {
    constructor(args) {
        super(args);
    }

    buildArgs(args) {
        this.stackExpr = new StackExpr(args.value);
    }

    async exec() {
        const result = await this.stackExpr.exec();
        print(result);
    }
}

class WhenProc extends Proc {
    constructor(args) {
        super(args);
    }

    buildArgs(args) {
        this.stackExpr = new StackExpr(args.value);
        this.block     = new Block(args.block);
        
        this.exec = args.loops ? this.exec_loop : this.exec_noLoop;
        
        if(args.else) this.else = args.else.type == "WhenProc" ? new WhenProc(args.else) : new Block(args.else.block);
    }

    async exec_noLoop() {
        const result = await this.stackExpr.exec();
        if(!["int", "float"].includes(StackEl.Type_stackOp.prototype.getType(result))) raise('Conditions for "When" procedures must evaluate to "int", "float" or any "num" derived custom type.');
        if(result) await this.block.exec();
        else if(this.else) await this.else.exec();
    }

    async exec_loop() {
        while(true) {
            const result = await this.stackExpr.exec();
            if(!["int", "float"].includes(StackEl.Type_stackOp.prototype.getType(result))) raise('Conditions for "When" procedures must evaluate to "int", "float" or any "num" derived custom type.');
            if(result) await this.block.exec();
            else if(this.else) return await this.else.exec();
            else return;
        }
    }
}

class LoopProc extends Proc {
    constructor(args) {
        super(args);
    }

    buildArgs(args) {
        this.stackExpr = new StackExpr(args.value);
        this.block     = new Block(args.block);
    }

    async exec() {
        const result = await this.stackExpr.exec();
        if(StackEl.Type_stackOp.prototype.getType(result) != "int") raise(`"Loop" procedure expected its StackExpression argument to evaluate to "int", got "??" instead.`);
        for(let i = 0; i < (result * (result >= 0)); i++) await this.block.exec();
    }
}

class Block {
    constructor(expressions) {
        this.expressions = expressions.map(expr => EXPR_TYPES[expr.type](expr, null));
    }

    async exec() {
        for(const expr of this.expressions) {
            await expr.exec();
        }
    }
}

// STACK
class StackExpr {
    constructor(stackEls) {
        this.buildArgs(stackEls);
    }

    buildArgs(stackEls) {
        const typeStack = new StackEl.TypeStack();

        this.stackEls = stackEls.map(stackElm => {
            switch(stackElm.type) {
                case "stackOp": return this.getStackOp(stackElm.value, typeStack);
                case "CallChain": return new CallChain(stackElm.value, typeStack);

                case "num":
                case "str": return new StackValue(stackElm.value, typeStack);
            }
        });
    }

    getStackOp(symbol, typeStack) {
        if(mathSymbols.includes(symbol)) {
            switch(symbol) {
                case "+" : return new Plus_stackOp(typeStack);
                case "==": return new Eqs_stackOp(typeStack);
                case "*" : return new Mult_stackOp(typeStack);
                default  : return new Math_stackOp(symbol, typeStack);
            }
        }
        switch(symbol) {
            case "not"  : return new StackEl.Not_stackOp(typeStack);
            case "dup"  : return new StackEl.Dup_stackOp(typeStack);
            case "size" : return new StackEl.Size_stackOp(typeStack); 
            case "rot<" : return new StackEl.RotL_stackOp(typeStack);
            case "rot>" : return new StackEl.RotR_stackOp(typeStack);
            case "spill": return new StackEl.Spill_stackOp(typeStack);
            case "type" : return new StackEl.Type_stackOp(typeStack);
            case "swap" : return new StackEl.Swap_stackOp(typeStack);
            case "drop" : return new StackEl.Drop_stackOp(typeStack);
            case "pop"  : return new StackEl.Pop_stackOp(typeStack);
            case "flip" : return new StackEl.Flip_stackOp(typeStack);
            case "rand" : return new StackEl.Rand_stackOp(typeStack);
            case "char" : return new StackEl.Char_stackOp(typeStack);
            case "in"   : return new StackEl.In_stackOp(typeStack);
            
            //type-casting
            case "num"  : return new StackEl.Num_stackOp(typeStack);
            case "int"  : return new StackEl.Int_stackOp(typeStack);
            case "str"  : return new StackEl.Str_stackOp(typeStack);
            case "list" : return new StackEl.List_stackOp(typeStack);
            case "obj"  : return new StackEl.Obj_stackOp(typeStack);

            case "inp"  : return new Inp_stackOp(typeStack);
        }
    }

    async exec(keepPacked = false) {
        const stack = [];
        for(const stackEl of this.stackEls) {
            await stackEl.exec(stack);
        }
        return stack.length == 1 && !keepPacked ? stack[0] : stack;
    }
}

class StackValue {
    constructor(value, typeStack) {
        this.value = value;
        this.type = StackEl.Type_stackOp.prototype.getType(value);
        this.checkType(typeStack);
    }

    checkType(typeStack) {
        const typeOfValue = StackEl.Type_stackOp.prototype.getType(this.value);
        typeStack.addOption(typeOfValue == "str" ? [typeOfValue, this.value.length] : typeOfValue);
    }

    exec(stack) {
        stack.push(this.value);
    }
}

class Math_stackOp extends StackEl.StackOp {
    constructor(symbol, typeStack) {
        super(typeStack);
        this.init_exec(symbol);
    }

    checkType(typeStack) { // num num -2-> num
        this.requestItem(typeStack, true, "num");
        this.requestItem(typeStack, true, "num");
        typeStack.addOption("num");
    }

    getOperands(stack) {
        const  [item2] = this.grabItemFromTop(stack, 0, false, "num");
        const  [item1] = this.grabItemFromTop(stack, 1, false, "num");
        return [item1, item2];
    }

    round(n) {
        return Number(Math.round(`${n}e${5}`) + `e-${5}`);
    }

    checkNaN(res) {
        if(isNaN(res)) raise("A math error has occurred inside of a StackExpression.");
    }

    init_exec(symbol) {
        const operationFunc = this.getOperationFunc(symbol);
        this.exec = (stack => {
            const res = operationFunc(...this.getOperands(stack));
            this.checkNaN(res);
            stack.push(res);
        }).bind(this);
    }

    getOperationFunc(symbol) {
        switch(symbol) {
            case "-"   : return (el1, el2) => el1 - el2;
            case "/"   : return (el1, el2) => el1 / el2;
            case "**"  : return (el1, el2) => el1 ** el2;
            case "and" : return (el1, el2) => 1 * (Boolean(el1) && Boolean(el2));
            case "or"  : return (el1, el2) => 1 * (Boolean(el1) || Boolean(el2));
            case ">"   : return (el1, el2) => 1 * (el1 > el2);
            case "<"   : return (el1, el2) => 1 * (el1 < el2);
            case ">>"  : return (el1, el2) => 1 * (el1 >> el2);
            case "<<"  : return (el1, el2) => 1 * (el1 << el2);
        }
    }
}
  
class Plus_stackOp extends StackEl.StackOp {
    constructor(typeStack) {
        super(typeStack);
    }

    checkType(typeStack) { // num|str num|str -2-> num|str
        const el2 = this.requestItem(typeStack, true, "num", "str");
        const el1 = this.requestItem(typeStack, true, "num", "str");

        const typeScore = (0.5 + 0.5 * (el1.canBe("num") - el1.canBe("str"))) *
                          (0.5 + 0.5 * (el2.canBe("num") - el2.canBe("str")));
        
        const options = [];
        if(typeScore > 0) { // 0.25, 0.5 relate to num|str, 1 is num
            const numTypeScore = Math.round(1.4 * el1.canBe("float") + 0.4 * el1.canBe("int")) +
                                 Math.round(1.4 * el2.canBe("float") + 0.4 * el2.canBe("int"));

            options.push(["int", "float", "num"][Math.min(numTypeScore, 2)]); // 0 : int, 1 : float, 2 : num
        }
        if(typeScore < 1) options.push("str"); // 0.25, 0.5 relate to num|str, 0 is str
        typeStack.addOption(...options);
    }

    exec(stack) {
        const [el2]    = this.grabItemFromTop(stack, 0, false, "num", "str");
        const [el1]    = this.grabItemFromTop(stack, 1, false, "num", "str");
        const res      = el1 + el2;
        const resIsNum = StackEl.Type_stackOp.prototype.getType(res) == "num";
        if(resIsNum) Math_stackOp.prototype.checkNaN(res);
        stack.push(resIsNum ? Math_stackOp.prototype.round(res) : res);
    }
}

class Eqs_stackOp extends StackEl.StackOp {
    constructor(typeStack) {
        super(typeStack);
    }

    checkType(typeStack) { // any any -2-> num
        const el2 = this.requestItem(typeStack, true, "any");
        const el1 = this.requestItem(typeStack, true, "any");
        typeStack.addOption("num");
    }

    exec(stack) {
        const [el2] = this.grabItemFromTop(stack, 0, false, "any");
        const [el1] = this.grabItemFromTop(stack, 1, false, "any");
        const res   = 1 * (el1 === el2);
        stack.push(res);
    }
}

class Mult_stackOp extends StackEl.StackOp {
    constructor(typeStack) {
        super(typeStack);
    }

    checkType(typeStack) { // num|str num|str -2-> num|str
        const el2 = this.requestItem(typeStack, true, "num", "str");
        const el1 = this.requestItem(typeStack, true, "num", "str");

        if(el1.isOnly("str") && el2.isOnly("str")) raise("Cannot multiply str with str.");
        if((el1.isOnly("float") && el2.isOnly("str")) ||
           (el2.isOnly("float") && el1.isOnly("str"))) raise("Cannot multiply str with float.");
        
        const typeScore = (0.5 + 0.5 * (el1.canBe("num") - el1.canBe("str"))) *
                          (0.5 + 0.5 * (el2.canBe("num") - el2.canBe("str")));
    
        const options = [];
        if(typeScore > 0) { // 0.25, 0.5 relate to num|str, 1 is num
            const numTypeScore = Math.round(1.4 * el1.canBe("float") + 0.4 * el1.canBe("int")) +
                                 Math.round(1.4 * el2.canBe("float") + 0.4 * el2.canBe("int"));

            options.push(["int", "float", "num"][Math.min(numTypeScore, 2)]); // 0 : int, 1 : float, 2 : num
        }
        if(typeScore < 1) options.push("str"); // 0.25, 0.5 relate to num|str, 0 is str
        typeStack.addOption(...options);
    }

    _multiplyNumWithStr(num, str) {
        if(StackEl.Type_stackOp.prototype.getType(num) == "float") raise("Runtime Error: Cannot repeat a str value with a float amount of times.");
        return str.repeat(num);
    }

    exec(stack) {
        const [el2, type2] = this.grabItemFromTop(stack, 0, false, "num", "str");
        const [el1, type1] = this.grabItemFromTop(stack, 1, false, "num", "str");
        const el1_isStr    = type1 == "str";
        const el2_isStr    = type2 == "str";

        if(el1_isStr && el2_isStr) raise("Runtime Error: Cannot multiply two strings together");

        const res = el1_isStr ? this._multiplyNumWithStr(el2, el1) :
                    el2_isStr ? this._multiplyNumWithStr(el1, el2) :
                    el1 * el2;
        
        if(typeof res == "number") Math_stackOp.prototype.checkNaN(res);
        stack.push(res);
    }
}

class Inp_stackOp extends StackEl.StackOp {
    constructor(typeStack) {
        super(typeStack);
    }

    checkType(typeStack) { // any|void -0-> num|str
        typeStack.addOption("num", "str");
    }

    async exec(stack) {
        const userInput = await customConsole.requestInput();
        stack.push(userInput);
    }
}

class CallChain {
    constructor(properties, typeStack) {
        this.properties = properties.map(
            property => property.type == "IndexedProperty" ? new StackExpr(property.value) : property.value
        );
    }

    async exec(stack) {
        const newListItem = await this.properties[0].exec(true);
        if(this.properties.length == 1) return stack.push(newListItem);
        
        let res = newListItem;
        for(let i = 1; i < this.properties.length; i++) {
            const id      = await this.properties[i].exec();
            const idType  = StackEl.Type_stackOp.prototype.getType(id);
            const resType = StackEl.Type_stackOp.prototype.getType(res);
            if(resType   != "list") raise(`Runtime List Error: cannot index properties of a non-list item: got ${resType}`);
            if(idType    != "int" ) raise(`Runtime List Error: cannot index properties of a list item with a non-int index: got ${idType}`);
            res = res[id < 0 ? res.length + id : id];
            if(res === undefined) raise(`Runtime List Error: cannot find item at position ${id} in list.`);
        }
        stack.push(res);
    }
}