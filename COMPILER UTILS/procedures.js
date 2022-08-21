import * as ArgClasses from "./arguments.js";
import {StackOp, StackValue} from "./stack operators.js";
import * as Errors from "./errors.js";

class Proc {
    constructor(compilerRef, line) {
        this.ID = line.ID;
        this.compiler = compilerRef;
        this.getArguments(line);
    }

    getArguments(line) {}
}

export class PrintProc extends Proc {  // print <stackExpr>
    constructor(compilerRef, line) {
        super(compilerRef, line);
    }

    getArguments(line) {
        this.stackExpr = new ArgClasses.StackExprArg(this.ID, this.compiler, line.value.value);
    }

    execute() {
        console.log(this.stackExpr.execute());
    }
}

export class MakeProc extends Proc {
    constructor(compilerRef, line) {
        super(compilerRef, line);
    }

    getArguments(line) {
        this.assignment = new ArgClasses.Assignment(this.ID, this.compiler, line.value);
    }

    execute() {
        this.compiler.makeVar(this.assignment.target);
        this.assignment.execute();
    }
}

export class FreeProc extends Proc {
    constructor(compilerRef, line) {
        super(compilerRef, line);
    }

    getArguments(line) {
        this.target = new ArgClasses.StackCallArg(this.ID, this.compiler, line.value.value);
    }

    execute() {
        this.compiler.removeVar(this.target);
    }
}

export class ReplaceProc extends Proc {
    constructor(compilerRef, line) {
        super(compilerRef, line);
    }

    getArguments(line) {
        const assignmentToken = line.value;
        this.target = new ArgClasses.StackCallArg(this.ID, this.compiler, assignmentToken.target.value);
        this.stackExpr = new ArgClasses.StackExprArg(this.ID, this.compiler, assignmentToken.value.value);

        const found = this.stackExpr.stackOps.find(sOp => sOp instanceof ArgClasses.StackCallArg);
        if(found) throw new Errors.RuntimeError(this.ID, `<stackExpression>s that are to be replaced cannot contain items of type <stackCall>, found "${found.name}"`);

        if(this.compiler.stackOps[this.target.name]) throw new Errors.RuntimeError(this.ID, "overwriting an already defined <stackOperand> is not allowed");
        this.compiler.stackOps[this.target.name] = (() => new StackOp(this.ID, this.target.name, this.stackExpr.stackOps));
    }
    
    execute() {
        try {
            this.compiler.searchVar(this.target);
        }
        catch (e) { return; }
        throw new Errors.RuntimeError(this.ID, "an existing variable name is conflicting with this <replace> procedure's target argument");
    }
}

export class LoopProc extends Proc {
    constructor(compilerRef, line) {
        super(compilerRef, line);
    }

    getArguments(line) {
        this.stackExpr = new ArgClasses.StackExprArg(this.ID, this.compiler, line.value.value);
        this.block     = new ArgClasses.BlockArg(this.ID, this.compiler, line.block.value, true);
    }

    execute() {
        this.iters = this.stackExpr.execute();
        if(StackValue.prototype.get_type(this.iters) !== "number") throw new Errors.RuntimeError(this.ID, "this <loopProc> <stackExpression> evaluated to a result not compatible with an iterative operation: must be NUMBER");
        for(let i = 0; i < this.iters; i++) {
            this.block.execute();
            if(this.compiler.exitStatus === "done") {
                this.compiler.exitStatus = false;
                return;
            }
        }
    }
}

export class UseProc extends Proc {
    constructor(compilerRef, line) {
        super(compilerRef, line);
    }

    getArguments(line) {
        const path = new StackValue(this.ID, line.value.value);
        if(line.label) this.label = line.label; //for now it does nothing, it will when we add functions
        this.block = new ArgClasses.BlockArg(this.ID, this.compiler, this.compiler.compileModule(path));
        this.block.lines.forEach(line => line.ID += ` from module ${path.value}`);
    }

    execute() {
        this.block.execute();
    }
}

export class WhenProc extends Proc {
    constructor(compilerRef, line) {
        super(compilerRef, line);
    }

    getArguments(line) {
        this.stackExpr = new ArgClasses.StackExprArg(this.ID, this.compiler, line.value.value);
        this.loops = (line.loops == true);
        this.block = new ArgClasses.BlockArg(this.ID, this.compiler, line.block.value, this.loops);
        
        if(line.else) {
            if(line.else.name === "when") this.else = new WhenProc(this.compiler, line.else);
            else this.else = new ArgClasses.BlockArg(this.ID, this.compiler, line.else.block.value);
        }
    }

    execute() {
        const condition = this.stackExpr.execute();
        if(StackValue.prototype.get_type(condition) !== "number") throw new Errors.RuntimeError(this.ID, "this <whenProc> <stackExpression> evaluated to a result not compatible with a conditional evaluation: must be NUMBER");
        if(condition !== 0) {
            this.block.execute();
            if(this.loops) {
                if(this.compiler.exitStatus === "done") {
                    this.compiler.exitStatus = false;
                    return;
                }
                this.execute();
            }
        }
        else if(this.else) this.else.execute();
    }
}

export class NextProc extends Proc {
    constructor(compilerRef, line) {
        super(compilerRef, line);
    }

    execute() {
        this.compiler.skipIter = true;
    }
}

export class ExitProc extends Proc {
    constructor(compilerRef, line) {
        super(compilerRef, line);
    }

    getArguments(line) {
        if(line.value) this.stackExpr = new ArgClasses.StackExprArg(this.ID, this.compiler, line.value.value);
    }

    execute() {
        if(this.stackExpr) {
            const evaluation = this.stackExpr.execute();
            this.compiler.exitStatus = evaluation instanceof Array ? [...evaluation] : [evaluation];
        }
        else this.compiler.exitStatus = true;
    }
}

export class FlagProc extends Proc {
    constructor(compilerRef, line) {
        super(compilerRef, line);
    }

    getArguments(line) {
        this.stackExpr = new ArgClasses.StackExprArg(this.ID, this.compiler, line.value.value);
    }

    execute() {
        const message = this.stackExpr.execute();
        if(StackValue.prototype.get_type(message) !== "string") throw new Errors.RuntimeError(this.ID, "this <flagProc> <stackExpression> evaluated to a result not compatible with an error message: must be STRING");
        throw new Errors.FlagError(this.ID, message);
    }
}

export class DefProc extends Proc {
    constructor(compilerRef, line) {
        super(compilerRef, line);
    }

    getArguments(line) {
        this.name = line.name.value; //remember to label these for modules
        this.args = [];
        if(line.args) this.args = line.args.map(e => new ArgClasses.StackCallArg(this.ID, this.compiler, e.value));
        this.block = new ArgClasses.BlockArg(this.ID, this.compiler, line.block.value);
    }

    execute() {
        this.compiler.makeFunc(this);
    }

    call(inputEval = []) {
        if(inputEval.length !== this.args.length) throw new Errors.RuntimeError(this.ID, `${inputEval.length > this.args.length ? "too many" : "not enough"} arguments passed to function "${this.name}"`);
        this.compiler.scopeDepth++;
        for(let i = 0; i < inputEval.length; i++) {
            let arg = this.compiler.makeVar(this.args[i]);
            arg.value = inputEval[i];
        }
        this.compiler.scopeDepth--;

        this.compiler.callStack.push(this.block);
        const returnValue = this.block.execute();
        if(this.compiler.exitStatus === "done") this.compiler.exitStatus = false;
        return returnValue;
    }
}