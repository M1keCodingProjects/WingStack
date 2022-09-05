import { StackValue , Eqs_stackOp } from "./stack operators.js";
import * as Errors from "./errors.js";

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
            if(!(line.constructor.name === "WhenProc")) throw new Errors.CompileTimeError(this.ID, "an <OptionsProc> block can only contain <WhenProc> expressions and an optional <ElseProc>");
            if(line.loops) throw new Errors.CompileTimeError(this.ID, "<WhenProc> expressions inside of an <OptionsProc> block cannot loop");
            if(line.else) {
                if(i < this.lines.length - 1) throw new Errors.CompileTimeError(this.ID, "an <OptionsProc> block can only contain an optional <ElseProc> as the final case");
                if(line.else.constructor.name === "WhenProc") throw new Errors.CompileTimeError(this.ID, "an <ElseProc> option inside of an <OptionsProc> block cannot have a <StackExpression> argument");
                this.default = line.else;
            }
        }

        this.eqOp = new Eqs_stackOp(this.ID);
        this.stack = new Stack(this.ID);
    }

    execute(evaluation) {
        for(const line of this.lines) {
            const caseEval = line.stackExpr.execute();
            if(caseEval instanceof Object) throw new Errors.RuntimeError(this.ID, `a <WhenProc> <StackExpression> argument can only evaluate to a single comparable (NUMBER or STRING) value when part of an <OptionsProc>`);
            this.stack.data.push(evaluation);
            this.stack.data.push(caseEval);
            this.eqOp.execute(this.stack);
            if(this.stack.pop() === 1) return line.block.execute(); // unused return value
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