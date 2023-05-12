function* iota_generator(start = 0) {
    let i = start;
    while(true) yield i++;
}

let iota_iterator;
export function iota(start = null) {
    if(start !== null) iota_iterator = iota_generator(start);
    return iota_iterator ? iota_iterator.next().value : iota(0);
}

export class Option {
    constructor(value = null) {
        this.value = value;
    }

    Some(value) {
        return new Option(value);
    }

    None() {
        return new Option();
    }

    unwrap(orElse) {
        return this.value ?? orElse;
    }

    map(func) {
        return new Option(func(this.value));
    }

    pipe(...funcs) {
        return new Option(funcs.reduce((acc, func) => func(acc), this.value));
    }
}