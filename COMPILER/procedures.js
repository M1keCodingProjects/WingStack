import * as ArgClasses from "./arguments.js";
import {Type, runtime_checkGot_asValidExpected, runtime_checkType} from "./type checker.js";
import {print, RuntimeError} from "./customErrors.js";

class Proc {
    constructor(args) {
        this.buildArgs(args);
    }

    buildArgs(args) {
        if(args.value) this.stackExpr = new ArgClasses.StackExpr(args.value);
        if(args.block) this.block     = new ArgClasses.Block(args.block);
    }
}

export class PrintProc extends Proc {
    constructor(args) {
        super(args);
    }

    async exec() {
        const result = await this.stackExpr.exec();
        print(result);
    }
}

export class IfProc extends Proc {
    constructor(args) {
        super(args);
        this.expectedType = new Type("num");
    }

    buildArgs(args) {
        super.buildArgs(args);
        if(args.trigger) this.trigger = args.trigger;
        if(args.loops)   this.exec    = this.execLoop;
        if(args.else)    this.else    = args.else.type == "IfProc" ?
                                        new IfProc(args.else) :
                                        new ArgClasses.Block(args.else.block);
    }

    async getConditionEval() {
        const result     = await this.stackExpr.exec();
        const resultType = runtime_checkType(result);
        if(!runtime_checkGot_asValidExpected(this.expectedType, resultType)) throw new RuntimeError(`"If" procedure condition expected "num" evaluation but got "${resultType.toString()}"`);
        return result;
    }

    async exec() {
        let sentTrigger = false;
        if(await this.getConditionEval()) sentTrigger = await this.block.exec();
        else if(this.else)                sentTrigger = await this.else.exec();
        
        if(sentTrigger) return sentTrigger;   
    }

    async execLoop() {
        while(true) {
            if(await this.getConditionEval()) {
                await this.block.exec();
                if(!this.trigger?.sent) continue;
                if(this.trigger.sent !== true) return true; // trigger was meant for function.
                this.trigger.sent = false;
                return;
            }

            return this.else ? await this.else.exec() : false; // if the condition is false the loop stops anyway, but it might need to bubble up a trigger.
        }
    }
}

export class LoopProc extends Proc {
    constructor(args) {
        super(args);
        this.expectedType = new Type("int");
    }

    buildArgs(args) {
        super.buildArgs(args);
        if(args.trigger) this.trigger = args.trigger;
    }

    async exec() {
        let result = await this.stackExpr.exec();
        const resultType = runtime_checkType(result);
        if(!runtime_checkGot_asValidExpected(this.expectedType, resultType)) throw new RuntimeError(`"Loop" procedure iteration expected "int" but got "${resultType}" instead.`);
        
        result *= result >= 0;
        for(let i = 0; i < result; i++) {
            await this.block.exec();
            if(!this.trigger?.sent) continue;
            if(this.trigger.sent !== true) return true; // trigger was meant for function.
            this.trigger.sent = false;
            return;
        }
    }
}

export class ExitProc extends Proc {
    constructor(args) {
        super(args);
    }

    buildArgs(args) {
        super.buildArgs(args);
        if(args.trigger) this.trigger = args.trigger;
    }

    async exec() {
        this.trigger.sent = this.stackExpr ? await this.stackExpr.exec() : true;
    }
}

export class MakeProc extends Proc {
    constructor(args) {
        super(args);
    }

    buildArgs(args) {
        this.assignment = new ArgClasses.Assignment(args);
        this.depth = this.assignment.depth;
    }

    async exec() {
        await this.assignment.exec(true);
    }
}

/*
export class FreeProc extends Proc {
    constructor(compilerRef, line) {
        super(compilerRef, line);
    }

    getArguments(line) {
        this.target = new ArgClasses.StackCallArg(this.ID, this.compiler, line.value);
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
        if(line.target === "me") throw new Errors.CompileTimeError(this.ID, `cannot use reserved word "me" as target argument for <replace> procedure`);
        this.target = new ArgClasses.StackCallArg(this.ID, this.compiler, line.target);
        this.stackExpr = new ArgClasses.StackExprArg(this.ID, this.compiler, line.value);

        const found = this.stackExpr.stackOps.find(sOp => sOp instanceof ArgClasses.StackCallArg || sOp instanceof ArgClasses.FuncCall);
        if(found) throw new Errors.CompileTimeError(this.ID, `<stackExpression>s that are to be replaced cannot contain items of type <stackCall> or <funcCall>, found "${found.name}"`);

        if(this.compiler.stackOps[this.target.name]) throw new Errors.CompileTimeError(this.ID, `overwriting an already defined <stackOperand> (${this.target.name}) is not allowed`);
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
        this.stackExpr = new ArgClasses.StackExprArg(this.ID, this.compiler, line.value);
        this.block     = new ArgClasses.BlockArg(    this.ID, this.compiler, line.block, true);
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
        const path = new StackValue(this.ID, line.value);
        this.label = new ArgClasses.StackCallArg(this.ID, this.compiler, line.label);

        const moduleLines = this.compiler.compileModule(path, line.label);
        if(moduleLines === null) return;
        this.block = new ArgClasses.ObjBlockArg(this.ID, this.compiler, moduleLines);
    }

    execute() {
        if(!this.block) return;
        this.compiler.makeVar(this.label);
        this.label.execute(this.block.execute(), false);
    }
}

export class WhenProc extends Proc {
    constructor(compilerRef, line) {
        super(compilerRef, line);
    }

    getArguments(line) {
        this.stackExpr = new ArgClasses.StackExprArg(this.ID, this.compiler, line.value);
        this.loops = (line.loops == true);
        this.block = new ArgClasses.BlockArg(this.ID, this.compiler, line.block, this.loops);
        
        if(line.else) {
            if(line.else.value) this.else = new WhenProc(this.compiler, line.else);
            else this.else = new ArgClasses.BlockArg(this.ID, this.compiler, line.else.block);
        }
    }

    execute(isFirst = true) {
        const condition = this.stackExpr.execute();
        if(StackValue.prototype.get_type(condition) !== "number") throw new Errors.RuntimeError(this.ID, "this <whenProc> <stackExpression> evaluated to a result not compatible with a conditional evaluation: must be NUMBER");
        if(condition !== 0) {
            this.block.execute();
            if(this.loops) {
                if(this.compiler.exitStatus === "done") {
                    this.compiler.exitStatus = false;
                    return;
                }
                this.execute(false); // this makes when-loop elses useful: they only run if the when block never runs.
            }
        }
        else if(this.else && isFirst) this.else.execute();
    }
}

export class NextProc extends Proc {
    constructor(compilerRef, line) {
        super(compilerRef, line);
    }

    execute() {
        if(!this.compiler.openLoops.length) throw new Errors.RuntimeError(this.ID, "cannot use <next> procedure outside of a looping block");
        this.compiler.skipIter = true;
    }
}

export class ExitProc extends Proc {
    constructor(compilerRef, line) {
        super(compilerRef, line);
    }

    getArguments(line) {
        if(line.value) this.stackExpr = new ArgClasses.StackExprArg(this.ID, this.compiler, line.value);
    }

    execute() {
        if(this.stackExpr) {
            if(!this.compiler.callStack.length) throw new Errors.RuntimeError(this.ID, "<exit> procedures called outside of functions cannot carry <stackExpr> arguments");
            const evaluation = this.stackExpr.execute();
            this.compiler.exitStatus = [evaluation];
        }
        else {
            if(!this.compiler.openLoops.length) throw new Errors.RuntimeError(this.ID, `cannot use <exit> procedure outside of a looping block`);
            this.compiler.exitStatus = true;
        }
    }
}

export class DefProc extends Proc {
    constructor(compilerRef, line) {
        super(compilerRef, line);
    }

    getArguments(line) {
        this.name = line.name; //remember to label these for modules
        this.args = [];
        if(line.args) this.args = line.args.map(e => new ArgClasses.StackCallArg(this.ID, this.compiler, e));
        this.block = new ArgClasses.BlockArg(this.ID, this.compiler, line.block);
    }

    execute() {
        this.compiler.makeFunc(this);
    }

    call(inputEval = [], meInstance = null) {
        if(inputEval.length !== this.args.length) throw new Errors.RuntimeError(this.ID, `${inputEval.length > this.args.length ? "too many" : "not enough"} arguments passed to function "${this.name}"`);
        this.compiler.scopeDepth++;
        if(meInstance) {
            const meObj = this.compiler.createVariableInstance("me");
            this.compiler.vars.push(meObj);
            meObj.value = meInstance;
        }   
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

export class MatchProc extends Proc {
    constructor(compilerRef, line) {
        super(compilerRef, line);
    }

    getArguments(line) {
        this.stackExpr = new ArgClasses.StackExprArg(this.ID, this.compiler, line.value);
        this.block     = new ArgClasses.OptionsBlockArg(this.ID, this.compiler, line.block);
    }

    execute() {
        const evaluation = this.stackExpr.execute();
        if(evaluation instanceof Object) throw new Errors.RuntimeError(this.ID, `a <MatchProc> <StackExpression> argument can only evaluate to a single comparable (NUMBER or STRING) value`);
        this.block.execute(evaluation);
    }
}

export class HelperExpr extends Proc {
    constructor(compilerRef, line) {
        super(compilerRef, line);
    }

    getArguments(line) {
        const allowed_helper_expressions = {
            time_exec_start : this.onTimeExecStart,
            time_exec_end   : this.onTimeExecEnd,
        };

        if(!(line.value in allowed_helper_expressions)) throw new Errors.CompileTimeError(this.ID, `<Helper> token "${line.value}" is not a valid <Expression>`);
        this.execute = allowed_helper_expressions[line.value];
    }

    onTimeExecStart() {
        console.time("Global Helper Timer");
    }

    onTimeExecEnd() {
        console.timeEnd("Global Helper Timer");
    }
}
*/