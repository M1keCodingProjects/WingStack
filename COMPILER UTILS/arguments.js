import { StackValue } from "./stack operators.js";
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
    constructor(ID, compilerRef, nameList) {
        super("target", ID, compilerRef, nameList);
    }

    argumentize(nameList) {
        if(nameList instanceof Array) {
            this.name = nameList.shift();
            this.properties = [];
            for(let property of nameList) {
                switch(property.type) {
                    case "WORD"      : this.properties.push(property.value); break;
                    case "StackExpr" : this.properties.push(new StackExprArg(this.ID, this.compiler, property.value)); break;
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
                        case "number" : if(! (variable instanceof Array)) throw new Errors.RuntimeError(this.ID, `cannot access index propery of non-list object`);
                                        name.push(`[${property}]`); break;

                        case "string" : if(   variable instanceof Array)  throw new Errors.RuntimeError(this.ID, `cannot access literal property of <list> type object`);
                                        name.push(`.${property}`); break; 
                        
                        default       : throw new Errors.RuntimeError(this.ID, `a <stackExpression> evaluated to a result not compatible with a property access operation`);
                    }
                }
                else if(variable instanceof Array) throw new Errors.RuntimeError(this.ID, `cannot access literal property of <list> type object`);
                
                if(variable[property] === undefined) {
                    name.pop();
                    if(variable instanceof Array) throw new Errors.RuntimeError(this.ID, `item "${name.join("")}" does not contain data at index ${property}`);
                    throw new Errors.RuntimeError(this.ID, `item "${name.join("")}" does not contain a property named ${property}`);
                }   
                if(!isReading && i == this.properties.length - 1) return variable[property] = stack; //unused return value
                variable = variable[property];
            }
        }
        
        if(isReading) {
            if(variable.value !== undefined) variable = variable.value;
            if(variable === null) throw new Errors.RuntimeError(this.ID, `cannot push a null value to the stack, this may have happened because a variable was called before finishing its initialization`);
            else stack.data.push(variable);
        }    
        else variable.value = stack;
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

export class Assignment extends Arg {
    constructor(ID, compilerRef, content) {
        super("assignment", ID, compilerRef, content);
    }

    argumentize(content) {
        this.target = new StackCallArg(this.ID, this.compiler, content.target);
        this.stackExpr = new StackExprArg(this.ID, this.compiler, content.value);
    }

    execute() {
        this.target.execute(this.stackExpr.execute(), false);
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
        else this.iterator = new StackCallArg(this.ID, this.compiler, content.value);
    }

    execute(stack = null) {
        const func = this.compiler.searchFunc(this.name, this.ID);
        let returnValue = [];

        if(this.iterator) {
            const iterable = this.compiler.searchVar(this.iterator);
            if(StackValue.prototype.get_type(iterable.value) !== "list") throw new Errors.RuntimeError(this.ID, `cannot iterate over non-list type item ${this.iterator.name}`);
            
            for(let el of iterable.value) returnValue.push(func.call([el]));
            if(returnValue.includes(null)) returnValue = null;
        }
        else returnValue = func.call(this.stackExpr ? this.stackExpr.execute() : []);

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