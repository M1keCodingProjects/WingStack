import {Type, runtime_checkGot_asValidExpected, runtime_checkType} from "./type checker.js";

// GameLangParser (GLP) Instance
import Parser from "./PARSING/new_parser.js";
const GLP = new Parser();

// Custom Console Instance
import Console from '../EDITOR/console.js';
const customConsole = new Console();

export function print(msg) {
    customConsole.appendLog(msg);
}

export function raise(msg) {
    customConsole.appendLog(msg, "Error");
    throw new Error(msg);
}

export async function requestInput() {
    return await customConsole.requestInput();
}

import * as Proc from "./procedures.js";
const EXPR_TYPES = {
    // PROCEDURES
    "PrintProc" : (expr, compilerRef) => new Proc.PrintProc(expr, compilerRef),
    "WhenProc"  : (expr, compilerRef) => new Proc.WhenProc(expr, compilerRef),
    "LoopProc"  : (expr, compilerRef) => new Proc.LoopProc(expr, compilerRef),
    
    // OTHER STUFF
    "Assignment" : (expr, compilerRef) => new Assignment(expr, compilerRef),
};

import iota from "../UTILS/general.js";
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