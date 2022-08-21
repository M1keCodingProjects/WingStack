class CustomError extends Error {
    constructor(ID, name, message) {
        super(message);
        this.name = `${name} Error at line ${ID}`;
    }
}

export class CompileTimeError extends CustomError {
    constructor(ID, message, name = "") {
        super(ID, `Compile-time ${name}`, message);
    }
}

export class RuntimeError extends CustomError {
    constructor(ID, message, name = "") {
        super(ID, `Runtime ${name}`, message);
    }
}

export class FlagError extends RuntimeError {
    constructor(ID, message) {
        super(ID, message ,"Flag Exception");
    }
}