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

export class PrintProc extends Proc {
    constructor(compilerRef, line) {
        super(compilerRef, line);
    }

    getArguments(line) {
        this.colorOptions = [ "aliceblue", "aqua", "beige", "black", "blue", "brown", "coral", "crimson", "cyan", "fuchsia", "gold", "gray", "green", "grey", "indigo", "ivory", "lavender", "lightblue", "lime", "magenta", "navy", "orange", "pink", "purple", "red", "silver", "teal", "transparent", "turquoise", "violet", "white", "yellow" ];
        this.styleOptions = {
            "bold"      : "font-weight : bold; ",
            "italic"    : "font-style : italic; ",
            "underline" : "text-decoration : underline; ",
        };

        this.stackExpr = new ArgClasses.StackExprArg(this.ID, this.compiler, line.value);
        if(line.style) this.style = new ArgClasses.StackExprArg(this.ID, this.compiler, line.style);
    }

    applyStyle() {
        let evaluation = this.style.execute();
        if(StackValue.prototype.get_type(evaluation) !== "string") throw new Errors.RuntimeError(this.ID, "tried to style <print> procedure with non-string type style argument");
        const styleArray = evaluation.split(" ").filter(str => str.length);
        if(styleArray.length < 1) throw new Errors.CompileTimeError(this.ID, `invalid style string : not enough arguments, minimum one`);
        if(styleArray[0][0] === "#") {
            if(styleArray[0].length !== 7) throw new Errors.CompileTimeError(this.ID, `invalid style string : hex-base colors must have exactly 6 digits`);
            if(isNaN(Number(`0x${styleArray[0].slice(1)}`))) throw new Errors.CompileTimeError(this.ID, `invalid style string : hex-base colors must be valid hex numbers`);
        }
        else if(!this.colorOptions.includes(styleArray[0])) {
            if(styleArray[0] === "error") {
                if(styleArray.length != 1) throw new Errors.CompileTimeError(this.ID, "invalid style string : cannot append any other markers after \"error\"");
                return "error";
            }
            throw new Errors.CompileTimeError(this.ID, `invalid style string : "${styleArray[0]}" is not an available color`);
        }
        evaluation = `color : ${styleArray.shift()};`

        for(const style of styleArray) {
            if(style in this.styleOptions) evaluation += this.styleOptions[style];
            else throw new Errors.CompileTimeError(this.ID, `invalid style string : "${style}" is not an available style marker`);
        }
        return evaluation;
    }

    execute() {
        const evaluation = this.stackExpr.execute();
        if(this.style) {
            if(typeof evaluation !== "string") throw new Errors.RuntimeError(this.ID, `cannot style <StackExpression> result, expected STRING but got ${StackValue.prototype.get_type(evaluation).toUpperCase()}`);
            const style = this.applyStyle();
            if(style === "error") throw new Errors.FlagError(this.ID, evaluation);
            else console.log(`%c${evaluation}`, style);
        }
        else console.log(evaluation);
    }
}

export class MakeProc extends Proc {
    constructor(compilerRef, line) {
        super(compilerRef, line);
    }

    getArguments(line) {
        if(line.isGlobal) this.isGlobal = true;
        this.assignment = new ArgClasses.Assignment(this.ID, this.compiler, line.value);
    }

    execute() {
        this.compiler.makeVar(this.assignment.target, this.isGlobal);
        this.assignment.execute();
    }
}

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