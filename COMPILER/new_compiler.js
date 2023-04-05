import {Type, runtime_checkGot_asValidExpected, runtime_checkType} from "./type checker.js";
import {print, warn, RuntimeError} from "./customErrors.js";

// GameLangParser (GLP) Instance
import Parser from "./PARSING/new_parser.js";
const GLP = new Parser();

import {Block} from "./arguments.js";
import iota from "../UTILS/general.js";

class Variable {
    constructor(name, value, frozen, ...types) {
        this.name = name;
        this.type = new Type(...types);
        this.set(value);
        this.frozen = frozen;
    }

    set(value) {
        if(this.frozen) throw new RuntimeError(`Cannot assign to frozen variable "${this.name}"`, "Scope");
        const got = new Type(runtime_checkType(value));
        if(runtime_checkGot_asValidExpected(this.type, got)) return this.value = value; //uncaught
        throw new RuntimeError(`Variable "${this.name}" expected value to be of type <${this.type}> but got <${got}> instead`, "Type");
    }

    get() {
        return this.value;
    }
}

class InstanceVariable extends Variable {
    constructor(name, value, frozen, whenReferenced_callback, ...types) {
        super(name, value, frozen, ...types);
        this.whenReferenced = whenReferenced_callback;
    }

    get() {
        return this.whenReferenced();
    }
}

export class Compiler {
    constructor(state) {
        this.state = state;
        if(state != "deploy") warn(`Compiler working in ${state} mode.`);
        this.runtimeElapsedVar = new InstanceVariable("runtimeElapsed", 0, true, this.getRuntimeElapsed.bind(this), "num");
    }

    reset_runtime() {
        this.vars = [
            new Variable("a", 23, false, "any"),
            new Variable("b", 23, false, "any"),
            new Variable("c", 23, false, "any"),
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
        if(this.expressions.isEmpty()) throw new RuntimeError("Couldn't find any previous build to run.");

        //console.time("runtime");
        this.runtimeElapsedVar.value = window.performance.now(); // bypass freeze, quicker.
        await this.expressions.exec();
        //console.timeEnd("runtime");
        print("Execution complete.");
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

    createVar(name, value, type = "any") {
        const newVar = new Variable(name, value, type);
        this.vars.push(newVar);
        return newVar;
    }

    getVar(name) {
        const searchedVar = this.vars.find(v => v.name == name);
        if(!searchedVar) throw new RuntimeError(`Unknown variable "${name}" referenced`, "Name");
        return searchedVar;
    }
}

export const GLC = new Compiler("deploy");