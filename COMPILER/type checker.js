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
        this.asOptions = new Set();
        this.itemsType = [];

        if(types.length == 0) types = ["any"];

        types.forEach(type => this.addType(type));
        this.asOptions = Array.from(this.asOptions);

        if(!this.num && this.int && this.float) this.num = true;
        if(!this.any && this.num && this.str && this.list && this.obj) this.any = true;
    }

    setType(type, ifList_itemsType) {
        if(type == "list") this.itemsType.push(ifList_itemsType);
        this[type] = true;
        this.asOptions.add(type);
    }

    addType(type) {
        if(type instanceof Array) this.setType("list", new Type(...type)); // not supporting obj 
        else if(type == "list") this.setType("list", new Type("any", "void"));
        else this.setType(type);
    }

    canBe(type) {
        if(this.any) return type == "void" ? this.void == true : true;
        if(this.num && (type == "int" || type == "float")) return true; 
        return this[type] !== undefined;
    }

    toString() {
        const result = [];
        for(const typeStr of this.asOptions) {
            if(typeStr != "list") {
                result.push(typeStr);
                continue;
            }
            
            for(const itemType of this.itemsType) result.push(`[${itemType.toString()}]`);
        }
        return result.join("|");
    }
}

export function runtime_checkGot_asValidExpected(expected, got) { // pietro
    if(expected.any) {
        if((!got.void) || expected.void) return true;
    }

    for(const type of got.asOptions) {
        if(!expected.canBe(type)) return false;
        if(type != "list") continue;
        for(const typeInList of got.itemsType) {
            let expectedContains = false;
            for(const expectedTypeInList of expected.itemsType) {
                if(runtime_checkGot_asValidExpected(expectedTypeInList, typeInList)) {
                    expectedContains = true;
                    break;
                }
            }
            if(!expectedContains) return false;
        }
    }
    return true;
}

export function runtime_getTypeStr(value) {
    switch(typeof value) {
        case "undefined" : return "void";
        case "number"    : return Math.floor(value) === value ? "int" : "float";
        case "string"    : return "str";
        case "object"    : return value instanceof Array ? "list" : "obj";
    }
}

function runtime_buildContainerTypeStr(value) {
    return value.length ? value.map(item => runtime_getTypeStr(item)) : ["void"];
}

function runtime_buildCompleteTypeStr(value) {
    const typeStr = runtime_getTypeStr(value);
    return typeStr == "list" ? runtime_buildContainerTypeStr(value) : typeStr;
}

export function runtime_checkType(value) {
    return new Type(runtime_buildCompleteTypeStr(value));
}

/*
const got      = new Type(["num"]);
const expected = new Type(["str"], ["int"], "list");

console.log("expected:", expected);
console.log("got:", got);
console.log(runtime_checkGot_asValidExpected(expected, got));
*/