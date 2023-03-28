import {Type, runtime_checkGot_asValidExpected, runtime_checkType} from "./type checker.js";
import {print, requestInput, RuntimeError} from "./customErrors.js";

// GameLangParser (GLP) Instance
import Parser from "./PARSING/new_parser.js";
const GLP = new Parser();

import * as Proc from "./procedures.js";
import {Block} from "./arguments.js";
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
        const AST = GLP.parse(text);
        if(this.state == this.VALID_STATES.debugAST) print(JSON.stringify(AST, null, 2));
        return AST;
    }

    compile(AST) {
        this.expressions = new Block(AST);
        if(this.state == this.VALID_STATES.debug) print("Code compiled successfully.");
    }

    async run() {
        this.reset_runtime();
        if(this.expressions.isEmpty()) throw new RuntimeError("Couldn't find any previous build to run.");

        //console.time("runtime");
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