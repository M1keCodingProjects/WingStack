import Console from '../EDITOR/console.js';
const customConsole = new Console();

class CustomError extends Error {
    constructor(message, name = "", ID = "?") {
        super(message);
        this.name = `${name}Error at line ${ID}`;
        customConsole.appendLog(`$<color:red; text-decoration:underline;>${this.name}: ${message}.<$>`);
    }
}

export class ParsingError extends CustomError {
    constructor(message, name = "", ID) {
        super(message, `Parsing ${name}`, ID);
    }
}

export class CompileTimeError extends CustomError {
    constructor(message, name = "", ID) {
        super(message, `Compile-time ${name}`, ID);
    }
}

export class RuntimeError extends CustomError {
    constructor(message, name = "", ID) {
        super(message, `Runtime ${name}`, ID);
    }
}

export function print(msg) {
    customConsole.appendLog(msg);
}

export async function requestInput() {
    return await customConsole.requestInput();
}

//throw new RuntimeError("", "something happened");