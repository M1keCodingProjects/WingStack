import iota from "../UTILS/general.js";
const PRIMITIVE_TYPES = {
    void  : iota(),
    int   : iota(),
    float : iota(),
    str   : iota(),
    list  : iota(),
    obj   : iota(),
};

export class Type {
    constructor(...types) {
        this.asOptions = [];
        for(const type of types) {
            this.addType(type);
        }
        
        if(!this.num && this.int && this.float) this.num = true;
        if(!this.any && this.num && this.str && this.list && this.obj) this.any = true;
    }

    setType(type, value = true) {
        if(this[type]) {
            if(type != "list") return;
            for(const opt of value.asOptions) this.list.addType(opt);
            return;
        }
        
        this[type] = value;
        this.asOptions.push(type);
    }

    addType(type, value) {
        if(type instanceof Array) this.setType("list", new Type(...type)); // not supporting obj 
        else if(type == "list") this.setType("list", new Type("any", "void"));
        else this.setType(type);
    }

    canBe(type) {
        if(this.any) return type == "void" ? this.void == true : true;
        if(type == "num") return this.int && this.float;
        return this[type] !== undefined;
    }
}

export function runtime_checkGot_asValidExpected(expected, got) { // pietro
    for(const type of got.asOptions) {
        if(!expected.canBe(type) || (type == "list" && !runtime_checkGot_asValidExpected(expected.list, got.list))) return false;
    }
    return true;
}

export function runtime_checkType(value) {
    switch(typeof value) {
        case "undefined" : return PRIMITIVE_TYPES.void;
        case "number"    : return Math.floor(value) === value ? PRIMITIVE_TYPES.int : PRIMITIVE_TYPES.float;
        case "string"    : return PRIMITIVE_TYPES.str;
        case "object"    : return value instanceof Array ? PRIMITIVE_TYPES.list : PRIMITIVE_TYPES.obj;
    }
}

/*
const got      = new Type(["str", "void"], ["num"]);
const expected = new Type(["any"]);

console.log("expected:", expected);
console.log("got:", got);
console.log(runtime_checkGot_asValidExpected(expected, got));
*/