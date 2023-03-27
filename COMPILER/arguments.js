export class Block {
    constructor(expressions) {
        this.expressions = expressions.map(expr => EXPR_TYPES[expr.type](expr, null));
    }

    async exec() {
        for(const expr of this.expressions) {
            await expr.exec();
        }
    }
}

import * as StackEl from "./stack operators.js";
import iota from "../../UTILS/general.js";
const MATH_SYMBOLS = {
    "+"   : iota(),
    "-"   : iota(),
    "*"   : iota(),
    "/"   : iota(),
    "**"  : iota(),
    "and" : iota(),
    "or"  : iota(),
    ">"   : iota(),
    "<"   : iota(),
    "=="  : iota(),
    "<<"  : iota(),
    ">>"  : iota(),
};

export class StackExpr {
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
        if(symbol in MATH_SYMBOLS) {
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

import { requestInput } from "./new_compiler.js";
class Inp_stackOp extends StackEl.StackOp {
    constructor(typeStack) {
        super(typeStack);
    }

    checkType(typeStack) { // any|void -0-> num|str
        typeStack.addOption("num", "str");
    }

    async exec(stack) {
        const userInput = await requestInput();
        stack.push(userInput);
    }
}

export class StackValue {
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

export class CallChain {
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
/*
class Arg {
    constructor(type, ID, compilerRef, content) {
        this.type = type;
        this.ID = ID;
        this.compiler = compilerRef;
        this.argumentize(content);
    }
}

export class StackCallArg extends Arg {
    constructor(ID, compilerRef, nameList, isPseudoCall = false) {
        super("target", ID, compilerRef, nameList);
        this.isPseudoCall = isPseudoCall;
    }

    argumentize(nameList) {
        if(nameList instanceof Array) {
            this.name = nameList.shift();
            this.properties = [];
            for(let property of nameList) {
                switch(property.type) {
                    case "WORD"      : this.properties.push(property.value); break;
                    case "StackExpr" : this.properties.push(new StackExprArg(this.ID, this.compiler, property.value)); break;
                    case "FuncCall"  : this.properties.push(new FuncCall(this.ID, this.compiler, property)); break;
                    default          : throw new SyntaxError(`Cannot recognize property type ${property.type}`);
                }
            }
        }
        else this.name = nameList;
    }

    execute(stack, isReading = true) {
        let variable = this.compiler.searchVar(this);
        if(this.properties) {
            let name = [variable.name];
            variable = variable.value;
            if(variable === null) throw new Errors.RuntimeError(this.ID, `cannot access properties of a variable during its initialization`);
            for(let i = 0; i < this.properties.length; i++) {
                let property = this.properties[i];
                if(property instanceof StackExprArg) {
                    property = property.execute();
                    switch(StackValue.prototype.get_type(property)) {
                        case "number" : if(!(variable instanceof Array)) throw new Errors.RuntimeError(this.ID, `cannot access index propery of non-list object`);
                                        if(property < 0 && -property <= variable.length) property += variable.length; break;

                        case "string" : if(variable instanceof Array) throw new Errors.RuntimeError(this.ID, `cannot access literal property of <list> type object`);
                                        break;

                        default       : throw new Errors.RuntimeError(this.ID, `a <stackExpression> evaluated to a result not compatible with a property access operation`);
                    }
                    name.push(`[${property}]`);
                }
                else if(property instanceof FuncCall) {
                    if(StackValue.prototype.get_type(variable) !== "object") throw new Errors.RuntimeError(this.ID, `tried accessing method property "${property.name}" of non-object type item "${name.join("")}"`);
                    name.push(`.${property.name}`);
                    const isPseudoLast = i == this.properties.length - 1 && isReading && this.isPseudoCall;
                    const returnValue = isPseudoLast ? null : new Stack(this.ID);
                    property.execute(returnValue, variable);
                    if(!isPseudoLast) variable = returnValue.pop("all");
                    continue;
                }
                else {
                    if(variable instanceof Array) throw new Errors.RuntimeError(this.ID, `cannot access literal property of <list> type object`);
                    name.push(`.${property}`);
                }

                if(variable[property] === undefined) {
                    name.pop();
                    if(variable instanceof Array) throw new Errors.RuntimeError(this.ID, `item "${name.join("")}" does not contain data at index ${property}`);
                    throw new Errors.RuntimeError(this.ID, `item "${name.join("")}" does not contain a property named ${property}`);
                }
                if(variable[property] instanceof Function) throw new Errors.RuntimeError(this.ID, `"${name.join("")}" is a method and should be called as such`); 
                if(!isReading && i == this.properties.length - 1) return variable[property] = stack; //unused return value
                variable = variable[property];
            }
        }
        
        if(isReading) {
            if(this.isPseudoCall) return;
            if(variable.constructor.name === "Variable") variable = variable.value;
            if(variable === null) throw new Errors.RuntimeError(this.ID, `cannot push a null value to the stack, this may have happened because a variable was called before finishing its initialization`);
            else stack.data.push(variable);
        }
        else variable.value = stack; // this only happens when writing to variables without properties. StackCalls property-chains ending in a FuncCall are not allowed to be a target by the parser
    }
}

export class StackExprArg extends Arg {
    constructor(ID, compilerRef, stackOpList, isArgStream = false) {
        super("StackExpr", ID, compilerRef, stackOpList);
        this.isArgStream = isArgStream;
    }

    argumentize(stackOpList) {
        this.stackOps = [];
        for(let opToken of stackOpList) {
            switch(opToken?.type) {
                case "FuncCall"       : this.stackOps.push(new FuncCall(this.ID, this.compiler, opToken)); break;
                case "StackOperand"   : this.stackOps.push(this.compiler.stackOps[opToken.value](this.ID)); break;
                case "StackCall"      : this._manageReplacedOps(opToken.value); break;
                default               : this.stackOps.push(new StackValue(this.ID, opToken)); break;
            }
        }
    }

    _manageReplacedOps(name) {
        this.stackOps.push(name in this.compiler.stackOps  ? this.compiler.stackOps[name](this.ID)                  :
                           name in this.compiler.constants ? new StackValue(this.ID, this.compiler.constants[name]) :
                           new StackCallArg(this.ID, this.compiler, name));
    }

    execute() {
        let stack = new Stack(this.ID);
        this.stackOps.forEach(op => op.execute(stack));
        if(stack.data.length < 2 && !this.isArgStream) stack.data = stack.data[0];
        if(stack.data === undefined) throw new Errors.RuntimeError(this.ID, `<stackExpr> ends its evaluation empty`);
        return stack.data;
    }
}

export class BlockArg extends Arg {
    constructor(ID, compilerRef, linesList, isLoop = false) {
        super("block", ID, compilerRef, linesList);
        this.isLoop = isLoop;
    }

    argumentize(linesList) {
        this.lines = this.compiler.tokenize(linesList);
        if(!this.lines.length) throw new Errors.RuntimeError(this.ID, `empty <block> declaration`);
    }

    execute() {
        if(this.isLoop) this.compiler.openLoops.push(this);
        this.compiler.scopeDepth++;
        let returnValue = null;
        for(let line of this.lines) {
            line.execute();
            if(this.compiler.skipIter) {
                let currentRunningLoop = this.compiler.openLoops[this.compiler.openLoops.length - 1];
                if(currentRunningLoop === this) this.compiler.skipIter = false;
                break;
            }

            if(this.compiler.exitStatus) {
                if(this.compiler.exitStatus === true) {
                    let currentRunningLoop = this.compiler.openLoops[this.compiler.openLoops.length - 1];
                    if(currentRunningLoop === this) this.compiler.exitStatus = "done";
                }
                else {
                    if(this.compiler.callStack[this.compiler.callStack.length - 1] === this) {
                        returnValue = [...this.compiler.exitStatus];
                        this.compiler.exitStatus = "done";
                        this.compiler.callStack.pop();
                    }
                }
                break;
            }
        }    
        this.compiler.clearLocalDepth();
        this.compiler.scopeDepth--;
        if(this.isLoop) this.compiler.openLoops.pop();
        return returnValue instanceof Array ? returnValue.length < 2 ? returnValue[0] : returnValue : null;
    }
}

export class ObjBlockArg extends BlockArg {
    constructor(ID, compilerRef, linesList) {
        super(ID, compilerRef, linesList);
    }

    argumentize(linesList) {
        super.argumentize(linesList);
        if(this.lines.find(line => line.isGlobal)) throw new Errors.CompileTimeError(this.ID, "Cannot instantiate globally when creating an object's property");
    }

    execute() {
        this.compiler.scopeDepth++;
        let returnValue = {};
        const oldLen = this.compiler.vars.length;
        for(let line of this.lines) {
            line.execute();
            const newVarsAmt = this.compiler.vars.length - oldLen;
            if(newVarsAmt > 0) {
                for(let i = 0; i < newVarsAmt; i++) {
                    const property = this.compiler.vars.pop();
                    if(property.constructor.name === "Variable") returnValue[property.name] = property.value;
                    else returnValue[property.name] = (() => property); // we save the whole DefProc, but hide it for security reasons
                }
            }
        }
        if(!Object.keys(returnValue).length) throw new Errors.RuntimeError(this.ID, `an empty <object> type item was created, with no properties nor methods`);
        this.compiler.scopeDepth--;
        return returnValue;
    }
}

export class OptionsBlockArg extends BlockArg {
    constructor(ID, compilerRef, linesList) {
        super(ID, compilerRef, linesList);
    }

    argumentize(linesList) {
        super.argumentize(linesList);
        for(let i = 0; i < this.lines.length; i++) {
            const line = this.lines[i];
            if(!(line.constructor.name === "WhenProc")) throw new Errors.CompileTimeError(this.ID, "a <MatchProc> block can only contain <WhenProc> expressions and an optional <ElseProc>");
            if(line.loops) throw new Errors.CompileTimeError(this.ID, "<WhenProc> expressions inside of a <MatchProc> block cannot loop");
            if(line.else) {
                if(i < this.lines.length - 1) throw new Errors.CompileTimeError(this.ID, "a <MatchProc> block can only contain an optional <ElseProc> as the final case");
                if(line.else.constructor.name === "WhenProc") throw new Errors.CompileTimeError(this.ID, "an <ElseProc> option inside of a <MatchProc> block cannot have a <StackExpression> argument");
                this.default = line.else;
            }
        }
    }

    execute(evaluation) {
        const evals = [];
        for(const line of this.lines) {
            const caseEval = line.stackExpr.execute();
            if(evals.includes(caseEval)) throw new Errors.RuntimeError(this.ID, `different <MatchProc> cases cannot evaluate to the same value, found "${caseEval}" twice`);
            if(caseEval instanceof Object) throw new Errors.RuntimeError(this.ID, `a <WhenProc> <StackExpression> argument can only evaluate to a single comparable (NUMBER or STRING) value when part of a <MatchProc>`);
            evals.push(caseEval);
            if(caseEval === evaluation) return line.block.execute(); // unused return value
        }
        //if we get here, then default can run:
        if(this.default) this.default.execute();
    }
}

export class Assignment extends Arg {
    constructor(ID, compilerRef, content) {
        super("assignment", ID, compilerRef, content);
    }

    argumentize(content) {
        this.target = new StackCallArg(this.ID, this.compiler, content.target, content.value === "omitted");
        if(this.target.isPseudoCall) return;
        switch(content.value.type) {
            case "Block"     : this.block     = new ObjBlockArg( this.ID, this.compiler, content.value.value); break;
            case "StackExpr" : this.stackExpr = new StackExprArg(this.ID, this.compiler, content.value.value); break;
            default          : throw new SyntaxError(`Cannot recognize argument type ${content.value.type}`);
        }
    }

    execute() {
        if(this.target.isPseudoCall) this.target.execute(null, true);
        else this.target.execute(this.stackExpr ? this.stackExpr.execute() : this.block.execute(), false);
    }
}

export class FuncCall extends Arg {
    constructor(ID, compilerRef, content) {
        super("function call", ID, compilerRef, content);
    }

    argumentize(content) {
        this.name = content.name;
        if(!content.value) return;
        
        if(content.value instanceof Array) this.stackExpr = new StackExprArg(this.ID, this.compiler, content.value, true);
        else this.iterator = new StackCallArg(this.ID, this.compiler, content.value.value);
    }

    execute(stack = null, objectRef = null) {
        let func = objectRef ? objectRef[this.name] : this.compiler.searchFunc(this.name, this.ID);
        if(func instanceof Function) func = func();
        if(func?.constructor.name !== "DefProc") throw new Errors.RuntimeError(this.ID, `tried calling non-method property "${this.name}"`);
  
        let returnValue = [];
        if(this.iterator) {
            let iterable = new Stack(this.ID);
            this.iterator.execute(iterable);
            iterable = iterable.pop();
            if(StackValue.prototype.get_type(iterable) !== "list") throw new Errors.RuntimeError(this.ID, `cannot iterate over non-list type item ${this.iterator.name}`);
            
            for(let el of iterable) returnValue.push(func.call([el], objectRef));
            if(returnValue.includes(null)) returnValue = null;
        }
        else returnValue = func.call(this.stackExpr ? this.stackExpr.execute() : [], objectRef);

        if(stack instanceof Stack) {
            if(returnValue === null) throw new Errors.RuntimeError(this.ID, `the function ${this.name} didn't have an exit ready for the particular control-flow path that happened at runtime, and thus produced an invalid stack value`);
            stack.data.push(returnValue);
        }
    }
}

class Stack {
    constructor(ID) {
      this.ID = ID;
      this.data = [];
      this.fetchID = 0;

      this.OOB_Error = new Errors.RuntimeError(this.ID, `tried fetching data from a point of the stack protected by a <comaSeparator> stackOperator`);
    }

    fetch(ID, keep = true) {
        ID += this.fetchID;
        if(ID >= this.data.length) throw OOB_Error;
        return keep ? this.data[ID] : this.data.splice(ID, 1)[0];
    }

    pop(n = 1, keep = false) {
        n = n === "all" ? this.fetchID : this.data.length - n; 
        if(n < this.fetchID) throw this.OOB_Error;
        const popped = keep ? this.data.slice(n) : this.data.splice(n);
        return popped.length == 1 ? popped[0] : popped;
    }

    push(data, ID = this.data.length - this.fetchID - 1) {
        ID += this.fetchID;
        if(ID >= this.data.length) throw OOB_Error;
        this.data.splice(ID, 0, data);
    }

    len() {
        return this.data.length - this.fetchID;
    }
}
*/