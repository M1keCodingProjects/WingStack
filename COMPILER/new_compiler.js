import Editor  from '../EDITOR/editor.js';
import Parser from "./PARSING/new_parser.js";

const editor = new Editor();
export default class Compiler {
    constructor() {
        this.init();
        this.state = "deploy";
        this.parser = new Parser(editor);
    }

    init() {
        this.AST = [];
        this.reset_runtime();
    }

    reset_runtime() {
        this.vars = [];
    }

    build() {
        this.init();
        this.AST = this.parser.parse_fileContents();
        const expressions = [];
        for(const expr of this.AST) expressions.push(new PrintProc(expr.value));
        if(this.state == "debug") {
            editor.console.appendLog(JSON.stringify(this.AST, null, 2));
            editor.console.appendLog("Build complete.");
        }
        
        this.run(expressions);
    }

    async run(expressions) {
        for(const expr of expressions) {
            await expr.exec();
        }
    }
}

class Proc {
    constructor(args) {
        this.buildArgs(args);
    }
}

class PrintProc extends Proc {
    constructor(args) {
        super(args);
    }

    buildArgs(args) {
        this.stackExpr = new StackExpr(args);
    }

    async exec() {
        const result = await this.stackExpr.exec();
        editor.console.appendLog("" + result);
    }
}

class StackExpr {
    constructor(stackElements) {
        this.stackEls = stackElements.map(stackEl => {
            switch(stackEl.type) {
                case "stackOp": return new InpStackOp(stackEl.value);
                case "num":
                case "str": return new StackValue(stackEl.value);
            }
        });
    }

    async exec() {
        const stack = [];
        for(const stackEl of this.stackEls) {
            await stackEl.exec(stack);
        }
        return stack;
    }
}
class InpStackOp {
    async exec(stack) {
        const userInput = await editor.console.requestInput();
        stack.push(userInput);
    }
}

class StackValue{
    constructor(value) {
        this.value = value;
    }

    exec(stack) {
        stack.push(this.value);
    }
}