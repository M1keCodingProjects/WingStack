import {Type, runtime_checkGot_asValidExpected, runtime_checkType} from "./type checker.js";
import {print, warn, RuntimeError} from "./customErrors.js";

// GameLangParser (GLP) Instance
import Parser from "./PARSING/new_parser.js";
const GLP = new Parser();

import {Block} from "./arguments.js";

class Variable {
    constructor(name, value, frozen, depth, ...types) {
        this.name = name;
        this.init(value, types);
        this.frozen = frozen;
        this.depth  = depth;
    }

    init(value, types) {
        if(types[0] == "inferred") {
            this.type = runtime_checkType(value);
            if(this.type.canBe("void")) throw new RuntimeError("Cannot expect target of assignment to be of type <void>");
            return this.value = value; //uncaught
        }

        this.type = types[0] instanceof Type ? types[0] : new Type(...types);
        this.set(value);
    }

    set(value) {
        if(this.frozen) throw new RuntimeError(`Cannot assign to frozen variable "${this.name}"`, "Scope");
        const got = runtime_checkType(value);
        if(runtime_checkGot_asValidExpected(this.type, got)) return this.value = value; //uncaught
        throw new RuntimeError(`Variable "${this.name}" expected value to be of type <${this.type}> but got <${got}> instead`, "Type");
    }

    get() {
        return this.value;
    }
}

class InstanceVariable extends Variable {
    constructor(name, value, frozen, whenReferenced_callback, ...types) {
        super(name, value, frozen, 0, ...types);
        this.whenReferenced = whenReferenced_callback;
    }

    get() {
        return this.whenReferenced();
    }
}

class Compiler {
    constructor(state) {
        this.state = state;
        if(state != "deploy") warn(`Compiler working in ${state} mode.`);
        this.runtimeElapsedVar = new InstanceVariable("time", 0, true, this.getRuntimeElapsed.bind(this), "num");
    }

    reset_runtime() {
        this.vars = [
            this.runtimeElapsedVar,
        ];
        if(this.state == "deploy") print("\\clear");
    }

    getRuntimeElapsed() {
        return window.performance.now() - this.runtimeElapsedVar.value;
    }

    parse(text) {
        const AST = GLP.parse(text);
        if(this.state == "debugAST") print(JSON.stringify(AST, null, 2));
        return AST;
    }

    compile(AST) {
        this.expressions = new Block(AST);
        if(this.state == "debug") print("Code compiled successfully.");
    }

    async run() {
        this.reset_runtime();
        if(!this.expressions) throw new RuntimeError("Couldn't find any previous build to run.");

        this.runtimeElapsedVar.value = window.performance.now(); // bypass freeze, quicker.
        await this.expressions.exec();
        print("Execution complete.");
        if(this.state == "debug") console.log(this.vars);
    }

    build(text) {
        if(this.state == "deploy") print("\\clear");
        const AST = this.parse(text);
        this.compile(AST);
        print("Build complete.");
    }

    build_and_run(text) {
        this.build(text);
        this.run();
    }

    createVar(name, value, type = "any", depth = 0, frozen = false) {
        for(let i = this.vars.length - 1; i >= 0; i--) {
            if(this.vars[i].depth < depth) break;
            if(this.vars[i].name == name) throw new RuntimeError(`Variable "${name}" already defined in scope`, "Name");
        }

        const newVar = new Variable(name, value, frozen, depth, type);
        if(depth) this.vars.push(newVar);
        else      this.vars.unshift(newVar);
        return newVar;
    }

    getVar(name, free = false) {
        for(let i = this.vars.length - 1; i >= 0; i--) { //from the top, the first match is always the deepest.
            if(this.vars[i].name != name) continue;
            return free ? this.vars.splice(i, 1) : this.vars[i];
        }
        
        throw new RuntimeError(`Variable "${name}" is either not defined or not available in the current scope`, "Name");
    }

    freeVars_fromDepth(depth) {
        let deletionStartPos = 0;
        for(let i = this.vars.length; i > 0; i--) { 
            if(this.vars[i - 1].depth == depth) continue;
            deletionStartPos = i;
            break;
        }
        this.vars.splice(deletionStartPos);
    }
}

export const GLC = new Compiler("deploy");