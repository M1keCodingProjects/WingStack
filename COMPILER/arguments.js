import * as Proc                          from "./procedures.js";
import * as StackOp                       from "./stack operators.js";
import Binary                             from "./customTypes.js";
import { GLC }                            from "./new_compiler.js";
import { MATH_SYMBOLS }                   from "./stack operators.js";
import { CompileTimeError, RuntimeError } from "./customErrors.js";
import { Type, runtime_getTypeStr }       from "./type checker.js";

const EXPR_TYPES = {
    // PROCEDURES
    "PrintProc" : expr => new Proc.PrintProc(expr),
    "IfProc"    : expr => new Proc.IfProc(expr),
    "LoopProc"  : expr => new Proc.LoopProc(expr),
    "NextProc"  : expr => null,
    "ExitProc"  : expr => new Proc.ExitProc(expr),
    "MakeProc"  : expr => new Proc.MakeProc(expr),
    "FreeProc"  : expr => new Proc.FreeProc(expr),
    "WaitProc"  : expr => new Proc.WaitProc(expr),
    
    // OTHER STUFF
    "Assignment" : expr => new Assignment(expr),
};

export class Block {
    constructor(expressions) {
        this.expressions = [];
        this.earlyStop   = false;
        for(let i = 0; i < expressions.length; i++) {
            const exprType = expressions[i].type;
            const exprObj = EXPR_TYPES[exprType](expressions[i]);
            if(!this.depth && exprType == "MakeProc") this.depth = exprObj.depth;
            if(this.earlyStop) continue;
            if(exprType == "NextProc" || exprType == "ExitProc") this.earlyStop = true;
            if(exprType != "NextProc") this.expressions.push(exprObj);
        }
    }

    onEnd(triggerSent = false) {
        if(this.depth) GLC.freeVars_fromDepth(this.depth);
        return triggerSent;
    }

    async exec() {
        for(const expr of this.expressions) {
            if(GLC.interrupt) throw new Error();
            if(await expr.exec()) return this.onEnd(true);
        }
        return this.onEnd(this.earlyStop);
    }
}

export class StackExpr {
    constructor(stackEls) {
        this.buildArgs(stackEls);
    }

    buildArgs(stackEls) {
        const typeStack = undefined; // TODO: implement compile-time type-checking.
        this.stackEls = stackEls.map(stackElm => {
            switch(stackElm.type) {
                case "stackOp": return this.getStackOp(stackElm.value, typeStack);
                case "CallChain": return new CallChain(stackElm.value, stackElm.depth, typeStack);

                case "num":
                case "bin":
                case "str": return new StackValue(stackElm, typeStack);
            }
        });
    }

    getStackOp(symbol, typeStack) {
        if(symbol in MATH_SYMBOLS) return MATH_SYMBOLS[symbol](typeStack);

        switch(symbol) {
            case "dup"    : return new StackOp.Dup_stackOp(typeStack);
            case "size"   : return new StackOp.Size_stackOp(typeStack); 
            case "rot<"   : return new StackOp.RotL_stackOp(typeStack);
            case "rot>"   : return new StackOp.RotR_stackOp(typeStack);
            case "spill"  : return new StackOp.Spill_stackOp(typeStack);
            case "typeof" : return new StackOp.Type_stackOp(typeStack);
            case "swap"   : return new StackOp.Swap_stackOp(typeStack);
            case "drop"   : return new StackOp.Drop_stackOp(typeStack);
            case "pop"    : return new StackOp.Pop_stackOp(typeStack);
            case "flip"   : return new StackOp.Flip_stackOp(typeStack);
            case "rand"   : return new StackOp.Rand_stackOp(typeStack);
            case "char"   : return new StackOp.Char_stackOp(typeStack);
            case "inp"    : return new StackOp.Inp_stackOp(typeStack);
            case "?"      : return new StackOp.When_stackOp(typeStack);

            //type-casting
            case "num"  : return new StackOp.Num_stackOp(typeStack);
            case "int"  : return new StackOp.Int_stackOp(typeStack);
            case "bin"  : return new StackOp.Bin_stackOp(typeStack);
            case "str"  : return new StackOp.Str_stackOp(typeStack);
            case "list" : return new StackOp.List_stackOp(typeStack);
            case "obj"  : return new StackOp.Obj_stackOp(typeStack);
        }
    }

    async exec(keepPacked = false) {
        const stack = [];
        for(const stackEl of this.stackEls) {
            await stackEl.exec(stack);
        }
        return stack.length < 2 && !keepPacked ? stack[0] : stack;
    }
}

export class StackValue {
    constructor(token, typeStack) {
        if(token.type == "bin") {
            this.value = Binary.fromToken(token);
            this.exec  = this.execBin;
        }
        else this.value = token.value;
    }

    checkType(typeStack) {
    }

    execBin(stack) {
        stack.push(this.value.copy());
    }

    exec(stack) {
        stack.push(this.value);
    }
}

export class CallChain {
    constructor(properties, depth, typeStack) {
        this.depth = depth;
        this.properties = properties.map(
            property => property.type == "IndexedProperty" ? new StackExpr(property.value) : property.value
        );
    }

    copyIfBin(value) {
        return runtime_getTypeStr(value) == "bin" ? value.copy() : value;
    }

    isBoolean(value) {
        return value.isBool?.() || value === 0 || value === 1;
    }

    async extract(res, value = null, isNewItem = false) {
        const valueExists = value !== null;
        for(let i = 1; i < this.properties.length; i++) {
            const resType = runtime_getTypeStr(res);
            let   resLen  = res.length;
            switch(resType) {
                case "str"  : if(valueExists) throw new RuntimeError(`Tried assigning to property of immutable <str> item`, "Property"); break;
                case "bin"  :
                    resLen = res.value.length;
                    if(!valueExists) break;
                    if(!this.isBoolean(value)) throw new RuntimeError("<bin> items can only accept <0|1|b0|b1> as property values", "Type");
                    break;
                
                default     : throw new RuntimeError(`Cannot access properties of <${resType}> items`, "Type");
                case "list" : break;
            }

            let id        = await this.properties[i].exec();
            const idType  = runtime_getTypeStr(id);
            if(idType    != "int" ) throw new RuntimeError(`Indexed property key expected <int>, got <${idType}>`, "Type");
            if(id < 0) id += resLen;

            if(i == this.properties.length - 1) {
                if(valueExists) {
                    if(resType == "bin") value = Binary.toBool(value);
                    switch(id) {
                        case -1 :
                            if(!isNewItem) throw new RuntimeError("Cannot add new property \"-1\" outside of \"Make\" procedure", "Property");
                            return resType == "bin" ? res.addBottomDigit(value) : res.unshift(value); // uncaught.
                        
                        case resLen :
                            if(!isNewItem) throw new RuntimeError(`Cannot add new property "${id}" outside of \"Make\" procedure`, "Property");
                            return resType == "bin" ? res.addTopDigit(value) : res.push(value); // uncaught.
                        
                        default :
                            if(id < 0 || id > resLen) throw new RuntimeError(`Index "${id}" is out of bounds for an item with length "${resLen}"`, "Property");
                            if(isNewItem) throw new RuntimeError(`Property "${id}" already exists on item`, "Property");
                            return resType == "bin" ? res.assignDigit(id, value) : res[id] = value; // uncaught.
                    }
                }

                if(isNewItem == "delete") {
                    if(id < 0 || id >= resLen) throw new RuntimeError(`Cannot find property "${id}" on item`, "Property");
                    return resType == "bin" ? res.deleteDigit(id) : res.splice(id, 1);
                }
            }

            if(resType == "bin") {
                if(valueExists) throw new RuntimeError("Assigning to a <bin> value digit's digit is pointless and not allowed", "Property");
                if(isNewItem == "delete") throw new RuntimeError("Deleting a <bin> value digit's digit is pointless and not allowed", "Property");
                res = res.getDigit(id);
                continue;
            }
            res = res[id];
            if(res === undefined) throw new RuntimeError(`Cannot find property "${id}" on item`, "Property");
        }
        return this.copyIfBin(res);
    }

    async exec(stack) {
        const res = typeof this.properties[0] == "string" ?
                    GLC.getVar(this.properties[0]).get() :
                    await this.properties[0].exec(true);
        
        stack.push(
            this.properties.length == 1 ?
            this.copyIfBin(res) :
            await this.extract(res)
        );
    }

    async execWrite(value, allowNew = false) {
        const res = GLC.getVar(this.properties[0]);
        if(this.properties.length == 1) return res.set(value); // uncaught.
        await this.extract(res.get(), value, allowNew);
    }

    async free() {
        const deleteVar = this.properties.length == 1;
        const res = GLC.getVar(this.properties[0], deleteVar).get();
        if(deleteVar) return;
        await this.extract(res, null, "delete");
    }
}

export class Assignment {
    constructor(args, makesNewVar = false) {
        this.depth     = args.target.depth * !args.global;
        this.target    = new CallChain(args.target.value, this.depth);
        this.stackExpr = new StackExpr(args.value);

        if(makesNewVar) this.exec = this.execCreate;

        if(args.typeSignature) {
            if(args.target.value.length > 1) throw new CompileTimeError("Assignments that target properties of items cannot be type-annotated");
            this.buildTypeArg(args.typeSignature);
        }
    }

    buildTypeArg(typeSignature) {
        if(!typeSignature) return;
        this.expectedType = typeSignature.length ?
                            new Type(...this.parse_typeSignature(typeSignature)) :
                            "inferred";
        
        if(this.expectedType.canBe?.("void")) {
            throw new CompileTimeError("Cannot expect target of assignment to be of type <void>");
        }
    }

    parse_typeSignature(typeSignature) {
        const types = [];
        for(const type of typeSignature) {
            switch(type.type) {
                case "type" : types.push(type.value); break;
                case "WORD" : throw new RuntimeError("not implemented!");
                case "Type" : types.push([...this.parse_typeSignature(type.value)]); break;
            }
        }
        return types;
    }

    async exec() {
        await this.target.execWrite(await this.stackExpr.exec());
    }

    async execCreate() {
        const value = await this.stackExpr.exec();
        if(this.target.properties.length > 1) return await this.target.execWrite(value, true);
        const target = GLC.createVar(this.target.properties[0], value, this.expectedType, this.depth, this.const);
        if(this.dynamic) target.type = new Type();
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