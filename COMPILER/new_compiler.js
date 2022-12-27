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

    run(expressions) {
        expressions.shift()?.exec(expressions);
    }
}

class Proc {
    constructor(args) {
        this.buildArgs(args);
    }

    exec(callback) {
        callback.shift()?.exec(callback);
    }
}

class PrintProc extends Proc {
    constructor(args) {
        super(args);
    }

    buildArgs(args) {
        this.stackExpr = new StackExpr(args);
    }

    exec(callback) {
        this.stackExpr.exec(result => {
            editor.console.appendLog("" + result);
            super.exec(callback);
        });
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

    exec(callback) {
        const stack = [];
        this.stackEls.shift().exec(stack, this.stackEls);
        waitForResponse.call(this);

        function waitForResponse() {
            if(this.stackEls.length) return setTimeout(waitForResponse.bind(this), 0);
            callback(stack);
        }
    }
}

class InpStackOp {
    constructor() {

    }

    exec(stack, nextEls) {
        editor.console.requestInput((stack, nextEls, response) => {
            stack.push(response);
            nextEls.shift()?.exec(stack, nextEls);
        }, stack, nextEls);
    }
}

class StackValue {
    constructor(value) {
        this.value = value;
    }

    exec(stack, nextEls) {
        stack.push(this.value);
        nextEls.shift()?.exec(stack, nextEls);
    }
}