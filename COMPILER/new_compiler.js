import      Parser  from "./PARSING/new_parser.js";
import      Editor  from "../EDITOR/editor.js";
import * as StackEl from "./stack operators.js";

const editor = new Editor();
const print = msg => editor.console.appendLog(msg);

const raise = msg => {
    editor.console.appendLog(msg, "Error");
    throw new Error(msg);
}

const mathSymbols = ["+", "-", "*", "/", "**", "and", "or", ">", "<", "==", "<<", ">>"];

export default class Compiler {
    constructor() {
        this.init();
        this.state = "deploy";
        this.parser = new Parser(editor);
        this.editor = editor;
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
            print(JSON.stringify(this.AST, null, 2));
            print("Build complete.");
        }
        
        this.run(expressions);
        if(this.state == "debug") print("Execution complete.");
    }

    async run(expressions) {
        for(const expr of expressions) {
            await expr.exec();
        }
    }
}

// PROCEDURES
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
        print(result);
    }
}

// STACK
class StackExpr {
    constructor(stackElements) {
        const typeStack = new StackEl.TypeStack();
        this.stackEls = stackElements.map(stackElm => {
            switch(stackElm.type) {
                case "stackOp": return this.getStackOp(stackElm.value, typeStack);
                case "num":
                case "str": return new StackValue(stackElm.value, typeStack);
            }
        });
        console.log(typeStack.items.map(item => item.toStr()));
    }

    getStackOp(symbol, typeStack) {
        if(mathSymbols.includes(symbol)) {
            switch(symbol) {
                case "+" : return new Plus_stackOp(typeStack);
                case "==": return new Eqs_stackOp(typeStack);
                default  : return new Math_stackOp(symbol, typeStack);
            }
        }
        switch(symbol) {
            case "not"  : return new StackEl.Not_stackOp(typeStack);
            case "dup"  : return new StackEl.Dup_stackOp(typeStack);
            case "size" : return new StackEl.Size_stackOp(typeStack); 
            case "rot<" : return new StackEl.RotL_stackOp(typeStack);
            case "rot>" : return new StackEl.RotR_stackOp(typeStack);
            case "spill": return new StackEl.Spill_stackOp(typeStack);
            case "type" : return new StackEl.Type_stackOp(typeStack);
            case "swap" : return new StackEl.Swap_stackOp(typeStack);
            case "drop" : return new StackEl.Drop_stackOp(typeStack);
            case "pop"  : return new StackEl.Pop_stackOp(typeStack);
            case "inp"  : return new Inp_stackOp(typeStack);
        }
    }

    async exec() {
        const stack = [];
        for(const stackEl of this.stackEls) {
            await stackEl.exec(stack);
        }
        return stack.length == 1 ? stack[0] : stack;
    }
}

class StackValue {
    constructor(value, typeStack) {
        this.value = value;
        this.checkType(typeStack);
    }

    checkType(typeStack) {
        typeStack.addOption(StackEl.Type_stackOp.prototype.getType(this.value));
    }

    exec(stack) {
        stack.push(this.value);
    }
}

class Math_stackOp extends StackEl.StackOp {
    constructor(symbol, typeStack) {
        super(typeStack);
        this.exec = this.init_exec(symbol).bind(this);
    }

    checkType(typeStack) { // num num -2-> num
        this.requestItem(typeStack, true, "num");
        this.requestItem(typeStack, true, "num");
        typeStack.addOption("num");
    }

    get(stack) {
        return this.grab(stack, new StackEl.TypeOption("num"), new StackEl.TypeOption("num"));
    }

    checkNaN(res) {
        if(isNaN(res)) raise("A math error has occurred inside of a StackExpression.");
    }

    init_exec(symbol) {
        switch(symbol) {
            case "-" : return stack => {
                const [el1, el2] = this.get(stack);
                const res = el1 - el2;
                this.checkNaN(res);
                stack.push(res);
            };

            case "*" : return stack => {
                const [el1, el2] = this.get(stack);
                const res = el1 * el2;
                this.checkNaN(res);
                stack.push(res);
            };

            case "/" : return stack => {
                const [el1, el2] = this.get(stack);
                const res = el1 / el2;
                this.checkNaN(res);
                stack.push(res);
            };

            case "**" : return stack => {
                const [el1, el2] = this.get(stack);
                const res = el1 ** el2;
                this.checkNaN(res);
                stack.push(res);
            };

            case "and" : return stack => {
                const [el1, el2] = this.get(stack);
                const res = 1 * (Boolean(el1) && Boolean(el2));
                this.checkNaN(res);
                stack.push(res);
            };

            case "or" : return stack => {
                const [el1, el2] = this.get(stack);
                const res = 1 * (Boolean(el1) || Boolean(el2));
                this.checkNaN(res);
                stack.push(res);
            };

            case ">" : return stack => {
                const [el1, el2] = this.get(stack);
                const res = 1 * (el1 > el2);
                this.checkNaN(res);
                stack.push(res);
            };

            case "<" : return stack => {
                const [el1, el2] = this.get(stack);
                const res = 1 * (el1 < el2);
                this.checkNaN(res);
                stack.push(res);
            };

            case ">>" : return stack => {
                const [el1, el2] = this.get(stack);
                const res = 1 * (el1 >> el2);
                this.checkNaN(res);
                stack.push(res);
            };

            case "<<" : return stack => {
                const [el1, el2] = this.get(stack);
                const res = 1 * (el1 << el2);
                this.checkNaN(res);
                stack.push(res);
            };
        }
    }
}
  
class Plus_stackOp extends StackEl.StackOp {
    constructor(typeStack) {
        super(typeStack);
    }

    checkType(typeStack) { // num|str num|str -2-> num|str
        const el2 = this.requestItem(typeStack, true, "num", "str");
        const el1 = this.requestItem(typeStack, true, "num", "str");

        const typeScore = (0.5 + 0.5 * (el1.canBe("num") - el1.canBe("str"))) *
                          (0.5 + 0.5 * (el2.canBe("num") - el2.canBe("str")));
        
        const options = [];
        if(typeScore > 0) options.push("num"); // 0.25, 0.5 relate to num|str, 1 is num
        if(typeScore < 1) options.push("str"); // 0.25, 0.5 relate to num|str, 0 is str
        typeStack.addOption(...options);
    }

    exec(stack) {
        const [el1, el2] = this.grab(stack, new StackEl.TypeOption("num", "str"), new StackEl.TypeOption("num", "str"));
        const res = el1 + el2;
        if(typeof res == "number") Math_stackOp.prototype.checkNaN(res);
        stack.push(res);
    }
}

class Eqs_stackOp extends StackEl.StackOp {
    constructor(typeStack) {
        super(typeStack);
    }

    checkType(typeStack) { // any any -2-> num
        const el2 = this.requestItem(typeStack, true, "any");
        const el1 = this.requestItem(typeStack, true, "any");
        typeStack.addOption("num");
    }

    exec(stack) {
        const [el1, el2] = this.grab(stack, new StackEl.TypeOption("any"), new StackEl.TypeOption("any"));
        const res = 1 * (el1 === el2);
        stack.push(res);
    }
}

class Inp_stackOp extends StackEl.StackOp {
    constructor(typeStack) {
        super(typeStack);
    }

    checkType(typeStack) { // any|void -0-> num|str
        typeStack.addOption("num", "str");
    }

    async exec(stack) {
        const userInput = await editor.console.requestInput();
        stack.push(userInput);
    }
}