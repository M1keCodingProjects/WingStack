/* to implement in the std library:
  //  : / int
  mix : rot> swap rot<
  over: mix swap
  revo: swap mix
  tup : rot> dup rot< dup mix
  xor : tup and not rot> or rot< and
  >=  : < not
  <=  : > not
*/
import Binary from "./customTypes.js";
import { requestInput, RuntimeError } from "./customErrors.js";
import { Type, runtime_checkGot_asValidExpected, runtime_checkType, runtime_getTypeStr } from "./type checker.js";
import { NUM_MATCH_PATTERN, BIN_MATCH_PATTERN } from "./PARSING/tokenizer.js";

class UnexpectedInputType_RuntimeError extends RuntimeError {
  constructor(stackOperator, argID, expectedType, gotType, ID) {
    super(`${stackOperator} expected ${argID}° argument to be of type <${expectedType}>, but got <${gotType}> instead`, "Type", ID);
  }
}

export class StackOp {
  constructor(typeStack) {
    //this.checkType(typeStack); Temporarily paused development on compile-time typechecking
  }

  checkType(typeStack) { // any|void -0-> any : default behaviour wants at least 0 any:items, takes 0 and returns 1 any:item
    typeStack.addOption("any");
  }

  checkStackMinLength(stack, amt) {
    if(stack.length < amt) {
        throw new RuntimeError(`${this.constructor.name} expected ${amt} argument${amt == 1 ? "" : "s"} but got ${stack.length} instead`, "NotEnoughArguments");
    }
  }

  getValidatedItemAndType_fromStackTop(stack, inputID, asCopy, ...validTypes) {
    const grabbedItem = asCopy ? stack[stack.length - inputID - 1] : stack.pop();
    const itemType    = this.getValidatedItemType(grabbedItem, inputID, ...validTypes);
    return [grabbedItem, itemType];
  }

  getValidatedItemType(item, inputID, ...validTypes) {
    const got = runtime_checkType(item);
    const expected = new Type(...validTypes);
    if(runtime_checkGot_asValidExpected(expected, got)) return got;
    throw new UnexpectedInputType_RuntimeError(this.constructor.name, inputID + 1, expected.toString(), got.toString());
  }
}

export const MATH_SYMBOLS = {
    "+"   : (typeStack) => new Add_stackOp(typeStack),
    "*"   : (typeStack) => new Mult_stackOp(typeStack),
    "-"   : (typeStack) => new Sub_stackOp(typeStack),
    "/"   : (typeStack) => new Div_stackOp(typeStack),
    "^"   : (typeStack) => new Pow_stackOp(typeStack),
    "%"   : (typeStack) => new Mod_stackOp(typeStack),

    "=="  : (typeStack) => new Eqs_stackOp(typeStack),
    "!="  : (typeStack) => new Neq_stackOp(typeStack),
    "<"   : (typeStack) => new Lst_stackOp(typeStack),
    ">"   : (typeStack) => new Grt_stackOp(typeStack),
    "<="  : (typeStack) => new LstEq_stackOp(typeStack),
    ">="  : (typeStack) => new GrtEq_stackOp(typeStack),

    "not" : (typeStack) => new Not_stackOp(typeStack),
    "and" : (typeStack) => new And_stackOp(typeStack),
    "or"  : (typeStack) => new Or_stackOp(typeStack),
    ">>"  : (typeStack) => new ShiftR_stackOp(typeStack),
    "<<"  : (typeStack) => new ShiftL_stackOp(typeStack),
};

// MATH
export class Math_stackOp extends StackOp {
  constructor(symbol, typeStack) {
      super(typeStack);
      this.symbol = symbol;
  }

  checkType(typeStack) {
      this.requestItem(typeStack, true, "num");
      this.requestItem(typeStack, true, "num");
      typeStack.addOption("num");
  }

  getOperands(stack, ...types) {
    if(!types.length) types = ["dec"];
    const  [item2, type2] = this.getValidatedItemAndType_fromStackTop(stack, 1, false, ...types);
    const  [item1, type1] = this.getValidatedItemAndType_fromStackTop(stack, 0, false, ...types);
    return [item1, item2, type1, type2];
  }

  checkNaN(res) {
      if(isNaN(res)) throw new RuntimeError(`A "${this.symbol}" operation proved mathematically impossible`, "Math");
  }
}
export class Add_stackOp extends Math_stackOp {
    constructor(typeStack) {
        super("+", typeStack);
    }

    checkType(typeStack) { // *dec|str *dec|str -> dec|str
        const el2 = this.requestItem(typeStack, true, "num", "str");
        const el1 = this.requestItem(typeStack, true, "num", "str");

        const typeScore = (0.5 + 0.5 * (el1.canBe("num") - el1.canBe("str"))) *
                            (0.5 + 0.5 * (el2.canBe("num") - el2.canBe("str")));
        
        const options = [];
        if(typeScore > 0) { // 0.25, 0.5 relate to num|str, 1 is num
            const numTypeScore = Math.round(1.4 * el1.canBe("float") + 0.4 * el1.canBe("int")) +
                                Math.round(1.4 * el2.canBe("float") + 0.4 * el2.canBe("int"));

            options.push(["int", "float", "num"][Math.min(numTypeScore, 2)]); // 0 : int, 1 : float, 2 : num
        }
        if(typeScore < 1) options.push("str"); // 0.25, 0.5 relate to num|str, 0 is str
        typeStack.addOption(...options);
    }

    exec(stack) {
        const [item1, item2, type1, type2] = this.getOperands(stack, "dec", "str");
        const res = item1 + item2;
        if(!type1.canBe("str") && !type2.canBe("str")) this.checkNaN(res);
        stack.push(res);
    }
}
export class Mult_stackOp extends Math_stackOp {
    constructor(typeStack) {
        super("*", typeStack);
    }

    checkType(typeStack) { // *dec|str *dec|str -> dec|str
      const el2 = this.requestItem(typeStack, true, "num", "str");
      const el1 = this.requestItem(typeStack, true, "num", "str");

      if(el1.isOnly("str") && el2.isOnly("str")) this.raise("Cannot multiply str with str");
      if((el1.isOnly("float") && el2.isOnly("str")) ||
         (el2.isOnly("float") && el1.isOnly("str"))) this.raise("Cannot multiply str with float");
      
      const typeScore = (0.5 + 0.5 * (el1.canBe("num") - el1.canBe("str"))) *
                        (0.5 + 0.5 * (el2.canBe("num") - el2.canBe("str")));
  
      const options = [];
      if(typeScore > 0) { // 0.25, 0.5 relate to num|str, 1 is num
          const numTypeScore = Math.round(1.4 * el1.canBe("float") + 0.4 * el1.canBe("int")) +
                               Math.round(1.4 * el2.canBe("float") + 0.4 * el2.canBe("int"));

          options.push(["int", "float", "num"][Math.min(numTypeScore, 2)]); // 0 : int, 1 : float, 2 : num
      }
      if(typeScore < 1) options.push("str"); // 0.25, 0.5 relate to num|str, 0 is str
      typeStack.addOption(...options);
    }

    _multiplyNumWithStr(num, str, numType) {
        if(numType.canBe("float")) throw new RuntimeError("Cannot multiply <str> value with <float>", "Type");
        if(num < 0) throw new RuntimeError("Cannot multiply <str> value with negative <int>", "Type");
        return str.repeat(num);
    }

    exec(stack) {
        const [item1, item2, type1, type2] = this.getOperands(stack, "dec", "str");
        const item1_isStr    = type1.canBe("str");
        const item2_isStr    = type2.canBe("str");

        if(item1_isStr && item2_isStr) throw new RuntimeError("Cannot multiply two <str> values together", "Type");

        const res = item1_isStr ? this._multiplyNumWithStr(item2, item1, type2) :
                    item2_isStr ? this._multiplyNumWithStr(item1, item2, type1) :
                    item1 * item2;
      
        if(!item1_isStr && !item2_isStr) this.checkNaN(res);
        stack.push(res);
  }
}
export class Sub_stackOp extends Math_stackOp {
    constructor(typeStack) {
        super("-", typeStack);
    }

    checkType(typeStack) { // *dec *dec -> dec
    }

    exec(stack) {
        const [item1, item2] = this.getOperands(stack);
        const res = item1 - item2;
        this.checkNaN(res);
        stack.push(res);
    }
}
export class Div_stackOp extends Math_stackOp {
    constructor(typeStack) {
        super("/", typeStack);
    }

    checkType(typeStack) { // *dec *dec -> dec
    }

    exec(stack) {
        const [item1, item2] = this.getOperands(stack);
        const res = item1 / item2;
        this.checkNaN(res);
        stack.push(res);
    }
}
export class Pow_stackOp extends Math_stackOp {
    constructor(typeStack) {
        super("^", typeStack);
    }

    checkType(typeStack) { // *dec *dec -> dec
    }

    exec(stack) {
        const [item1, item2] = this.getOperands(stack);
        const res = item1 ** item2;
        this.checkNaN(res);
        stack.push(res);
    }
}
export class Mod_stackOp extends Math_stackOp {
    constructor(typeStack) {
        super("%", typeStack);
    }

    checkType(typeStack) { // *dec *dec -> dec
    }

    exec(stack) {
        const [item1, item2] = this.getOperands(stack);
        const res = item1 % item2;
        this.checkNaN(res);
        stack.push(res);
    }
}

// COMPARISON
export class Eqs_stackOp extends StackOp {
    constructor(typeStack) {
        super(typeStack);
    }
  
    checkType(typeStack) { // *any *any -> bin
        const el2 = this.requestItem(typeStack, true, "any");
        const el1 = this.requestItem(typeStack, true, "any");
        typeStack.addOption("num");
    }
  
    exec(stack) {
        this.checkStackMinLength(stack, 2);
        const el2 = stack.pop();
        const el1 = stack.pop();
        const res = Binary.fromBool(el1 === el2);
        stack.push(res);
    }
}
export class Neq_stackOp extends StackOp {
    constructor(typeStack) {
        super(typeStack);
    }

    checkType(typeStack) { // *any *any -> bin
        const el2 = this.requestItem(typeStack, true, "any");
        const el1 = this.requestItem(typeStack, true, "any");
        typeStack.addOption("num");
    }

    exec(stack) {
        this.checkStackMinLength(stack, 2);
        const el2 = stack.pop();
        const el1 = stack.pop();
        const res = Binary.fromBool(el1 !== el2);
        stack.push(res);
    }
}
export class Lst_stackOp extends Math_stackOp {
    constructor(typeStack) {
        super("<", typeStack);
    }

    checkType(typeStack) { // *dec *dec -> bin
    }

    exec(stack) {
        const [item1, item2] = this.getOperands(stack);
        const res = Binary.fromBool(item1 < item2);
        stack.push(res);
    }
}
export class Grt_stackOp extends Math_stackOp {
    constructor(typeStack) {
        super(">", typeStack);
    }

    checkType(typeStack) { // *dec *dec -> bin
    }

    exec(stack) {
        const [item1, item2] = this.getOperands(stack);
        const res = Binary.fromBool(item1 > item2);
        stack.push(res);
    }
}
export class LstEq_stackOp extends Math_stackOp {
    constructor(typeStack) {
        super("<=", typeStack);
    }

    checkType(typeStack) { // *dec *dec -> bin
    }

    exec(stack) {
        const [item1, item2] = this.getOperands(stack);
        const res = Binary.fromBool(item1 <= item2);
        stack.push(res);
    }
}
export class GrtEq_stackOp extends Math_stackOp {
    constructor(typeStack) {
        super(">=", typeStack);
    }

    checkType(typeStack) { // *dec *dec -> bin
    }

    exec(stack) {
        const [item1, item2] = this.getOperands(stack);
        const res = Binary.fromBool(item1 >= item2);
        stack.push(res);
    }
}

// LOGICAL
export class Not_stackOp extends StackOp {
    constructor(typeStack) {
        super(typeStack);
    }
  
    checkType(typeStack) { // *num -> bin
      this.requestItem(typeStack, true, "num");
      typeStack.addOption("num");
    }
  
    exec(stack) {
        const [item, type] = this.getValidatedItemAndType_fromStackTop(stack, 0, false, "num");
        stack.push(type.canBe("bin") ? item.not() : Binary.fromBool(!item));
    }
}
export class And_stackOp extends Math_stackOp {
    constructor(typeStack) {
        super("and", typeStack);
    }
  
    checkType(typeStack) { // *num *num -> bin
      this.requestItem(typeStack, true, "num");
      typeStack.addOption("num");
    }
  
    exec(stack) {
        const [item1, item2, type1, type2] = this.getOperands(stack, "num"); 
        const res = type1.canBe("bin") ?
                    item1.and(item2, type2) :
                    type2.canBe("bin") ?
                    item2.and(item1, type1) :
                    Binary.fromBool(item1 && item2);
        
        stack.push(res);
    }
}
export class Or_stackOp extends Math_stackOp {
    constructor(typeStack) {
        super("or", typeStack);
    }
  
    checkType(typeStack) { // *num *num -> bin
      this.requestItem(typeStack, true, "num");
      typeStack.addOption("num");
    }
  
    exec(stack) {
        const [item1, item2, type1, type2] = this.getOperands(stack, "num"); 
        const res = type1.canBe("bin") ?
                    item1.or(item2, type2) :
                    type2.canBe("bin") ?
                    item2.or(item1, type1) :
                    Binary.fromBool(item1 || item2);
        
        stack.push(res);
    }
}
export class ShiftR_stackOp extends StackOp {
    constructor(typeStack) {
        super(typeStack);
    }

    checkType(typeStack) { // *bin *int -> bin
      this.requestItem(typeStack, true, "num");
      typeStack.addOption("num");
    }

    exec(stack) {
        const [item2] = this.getValidatedItemAndType_fromStackTop(stack, 1, false, "int");
        if(item2 < 0) throw new RuntimeError("Cannot shift <bin> to the right by a negative <int> amount", "Value");
        const [item1] = this.getValidatedItemAndType_fromStackTop(stack, 0, false, "bin");
        stack.push(item1.shiftR(item2));
    }
}
export class ShiftL_stackOp extends StackOp {
    constructor(typeStack) {
        super(typeStack);
    }
  
    checkType(typeStack) { // *bin *int -> bin
      this.requestItem(typeStack, true, "num");
      typeStack.addOption("num");
    }
  
    exec(stack) {
        const [item2] = this.getValidatedItemAndType_fromStackTop(stack, 1, false, "int");
        if(item2 < 0) throw new RuntimeError("Cannot shift <bin> to the left by a negative <int> amount", "Value");
        const [item1] = this.getValidatedItemAndType_fromStackTop(stack, 0, false, "bin");
        stack.push(item1.shiftL(item2));
    }
}
export class When_stackOp extends Mult_stackOp { // temporary!!!
  constructor(typeStack) {
    super(typeStack);
  }

  checkType(typeStack) { // *dec|str *bin -> dec|str
  }

  exec(stack) {
    const [binItem] = this.getValidatedItemAndType_fromStackTop(stack, 1, false, "bin");
    stack.push(binItem.toNum());
    super.exec(stack);
  }
}

// PUSHING VALUES
export class Inp_stackOp extends StackOp {
  constructor(typeStack) {
      super(typeStack);
  }

  checkType(typeStack) { // void -> dec|str
      typeStack.addOption("num", "str");
  }

  async exec(stack) {
      const userInput = await requestInput();
      stack.push(userInput);
  }
}
export class Size_stackOp extends StackOp {
  constructor(typeStack) {
    super(typeStack);
  }
  
  checkType(typeStack) { // *any|(any)|void -> int
    typeStack.addOption("num");
  }

  exec(stack) {
    const item = stack.length;
    stack.length = 1;
    stack[0] = item;
  }
}
export class Rand_stackOp extends StackOp {
  constructor(typeStack) {
    super(typeStack);
  }
  
  checkType(typeStack) { // void -> float
    //TODO
  }

  exec(stack) {
    stack.push(Math.random());
  }
}

// MOVE DATA
export class Dup_stackOp extends StackOp {
  constructor(typeStack) {
    super(typeStack);
  }

  checkType(typeStack) { // any -> any
    const lastItem = this.requestItem(typeStack, true, "any");
    typeStack.items.push(lastItem, lastItem.copy());
  }

  exec(stack) {
    this.checkStackMinLength(stack, 1);
    const item = stack[stack.length - 1];
    stack.push(item.copy instanceof Function ? item.copy() : item);
  }
}
export class RotL_stackOp extends StackOp {
  constructor(typeStack) {
    super(typeStack);
  }
  
  checkType(typeStack) { // any any -> void
    this.requestItem(typeStack, false, "any");
    this.requestItem(typeStack, false, "any");
    typeStack.items.push(typeStack.items.shift());
  }

  exec(stack) {
    this.checkStackMinLength(stack, 2);
    stack.push(stack.shift());
  }
}
export class RotR_stackOp extends StackOp {
  constructor(typeStack) {
    super(typeStack);
  }
  
  checkType(typeStack) { // any any -> void
    this.requestItem(typeStack, false, "any");
    this.requestItem(typeStack, false, "any");
    typeStack.items.unshift(typeStack.items.pop());
  }

  exec(stack) {
    this.checkStackMinLength(stack, 2);
    stack.unshift(stack.pop());
  }
}
export class Flip_stackOp extends StackOp {
    constructor(typeStack) {
        super(typeStack);
    }
  
    checkType(typeStack) { // any any -> void
        this.requestItem(typeStack, false, "any");
        this.requestItem(typeStack, false, "any");
        typeStack.items.reverse();
    }
  
    exec(stack) {
        stack.reverse();
    }
}
export class Swap_stackOp extends StackOp {
    constructor(typeStack) {
        super(typeStack);
    }
  
    checkType(typeStack) { // any any -> void
        //TODO
    }
    
    exec(stack) {
        this.checkStackMinLength(stack, 2);
        [stack[stack.length - 2], stack[stack.length - 1]] = [stack[stack.length - 1], stack[stack.length - 2]];
    }
}
export class Drop_stackOp extends StackOp {
    constructor(typeStack) {
        super(typeStack);
    }
  
    checkType(typeStack) { // *any -> void
        //TODO
    }
    
    exec(stack) {
        this.checkStackMinLength(stack, 1);
        stack.pop();
    }
}
export class Pop_stackOp extends StackOp {
  constructor(typeStack) {
    super(typeStack);
  }

  checkType(typeStack) { // *(any)|void any -> void
    //TODO
  }

  exec(stack) {
    this.checkStackMinLength(stack, 1);
    stack[0] = stack.pop();
    stack.length = 1;
  }
}

// OTHERS
export class Spill_stackOp extends StackOp {
  constructor(typeStack) {
    super(typeStack);
  }
  
  checkType(typeStack) { // *str|list|obj -> void|any|(any)
    const el = this.requestItem(typeStack, true, "str", "list", "obj");
    if(!el.isValidFor(new TypeOption("str"))) return;
    if(el.options.str === true) return typeStack.addOption({ many : ["str"] });
    for(let i = 0; i < el.options.str; i++) typeStack.addOption("str");
  }

  exec(stack) {
    const [item, type] = this.getValidatedItemAndType_fromStackTop(stack, 0, false, "str", "list", "obj");
    switch(type.asOptions[0]) {
      case "str"  : stack.push(...item.split("")); return;
      case "list" : stack.push(...item.map(listItem => runtime_getTypeStr(listItem) == "bin" ? listItem.copy() : listItem)); return;
      case "obj"  : stack.push(...item.listEnumerable()); return; //NOT READY
    }
  }
}
export class Type_stackOp extends StackOp {
  constructor(typeStack) {
    super(typeStack);
  }
  
  checkType(typeStack) { // *any|void -> str
    this.requestItem(typeStack, false, "any", "void");
    typeStack.addOption("str");
  }

  exec(stack) {
    const value = stack.pop();
    stack.push(runtime_getTypeStr(value));
  }
}

// CASTING
export class Num_stackOp extends StackOp {
  constructor(typeStack) {
    super(typeStack);
    this.type = "num";
  }

  checkType(typeStack) { // *num|str -> num
    //TODO
  }

  castStr(value) {
    if(value.match(NUM_MATCH_PATTERN)?.[0] === value) return Number(value);
    if(value.match(BIN_MATCH_PATTERN)?.[0] === value) {
        if(value.match(/[2-9]/) !== null) throw new RuntimeError(`Non-numeric <str> value "${value}" does not abide by <bin> casting syntax and is too big to be <${this.type}>`, "Value");
        return Binary.fromStr(value);
    }
    if(value.length != 1) throw new RuntimeError(`Non-numeric <str> cannot be cast to <${this.type}> if longer than one character`, "Value");
    return value.charCodeAt(0);
  }

  exec(stack) {
    if(!stack.length) stack.push(0);
    let [item, type] = this.getValidatedItemAndType_fromStackTop(stack, 0, false, "num", "str");
    switch(type.asOptions[0]) {
      case "str" : item = this.castStr(item); break;
      case "bin" : item = item.toNum(); break;
    }
    stack.push(item);
  }
}
export class Int_stackOp extends Num_stackOp {
  constructor(typeStack) {
    super(typeStack);
    this.type = "int";
  }

  checkType(typeStack) { // *num|str -> int
    //TODO
  }

  exec(stack) {
    if(!stack.length) stack.push(0);
    let [item, type] = this.getValidatedItemAndType_fromStackTop(stack, 0, false, "num", "str");
    switch(type.asOptions[0]) {
      case "str"   : item = this.castStr(item);
      case "float" : item = Math.floor(item instanceof Binary ? item.toNum() : item); break;
      case "bin"   : item = item.toNum(); break;
    }
    stack.push(item);
  }
}
export class Str_stackOp extends StackOp {
  constructor(typeStack) {
    super(typeStack);
  }

  checkType(typeStack) { // *void|num|str|(num|str) -> str
    const allowedOpts = new TypeOption("num", "str");
    for(const item of typeStack.items) {
      if(!item.isValidFor(allowedOpts)) throw new RuntimeError(`${this.constructor.name} expected ${allowedOpts.toStr()} but got ${item.toStr()}`, "Type");
    }
    typeStack.items = [];
    typeStack.addOption("str");
  }

  exec(stack) {
    let res = "";
    const initialLength = stack.length;
    for(let i = 0; i < initialLength; i++) {
      const type = runtime_getTypeStr(stack[i]);
      if(type == "list" || type == "obj") throw new UnexpectedInputType_RuntimeError(this.constructor.name, i, "num|str", type);
      res += type == "bin" ? stack[i].toStr() : stack[i];
    }
    
    stack[0] = res;
    stack.length = 1;
  }
}
export class Char_stackOp extends StackOp {
  constructor(typeStack) {
    super(typeStack);
  }

  checkType(typeStack) { // *int -> str
    //TODO
  }

  exec(stack) {
    const [item] = this.getValidatedItemAndType_fromStackTop(stack, 0, false, "int");
    stack.push(String.fromCharCode(item));
  }
}
export class List_stackOp extends StackOp {
  constructor(typeStack) {
    super(typeStack);
  }

  checkType(typeStack) { // *any|void|(any) -> list
    //TODO
  }

  exec(stack) {
    stack[0] = [...stack];
    stack.length = 1;
  }
}
export class Obj_stackOp extends StackOp {
  constructor(typeStack) {
    super(typeStack);
  }

  checkType(typeStack) { // *obj -> obj
    //TODO
  }

  exec(stack) {
    if(!stack.length) return stack.push({}); // uncaught.
    const item = this.getValidatedItemAndType_fromStackTop(stack, 0, false, "obj");
    stack.push({...item}); // NOT READY!!
  }
}
export class Bin_stackOp extends Num_stackOp {
  constructor(typeStack) {
    super(typeStack);
    this.type = "bin";
  }
  
  checkType(typeStack) { // *num|str|void -> bin
    //TODO
  }

  castStr(value) {
    if(value.match(BIN_MATCH_PATTERN)?.[0] === value && value.match(/[2-9]/g) === null) return Binary.fromStr(value);
    throw new RuntimeError(`<str> doesn't meet syntax requirements for <${this.type}> casting`, "Value");
  }

  isValidBinSegment(value, type = null) {
    return value === 0 || value === 1 || value === -1 || (type ? type.canBe("bin") : runtime_getTypeStr(value) == "bin");
  }

  exec(stack) {
    if(!stack.length) return stack.push(Binary.fromBool(0)); // uncaught.
    let [item, type] = this.getValidatedItemAndType_fromStackTop(stack, 0, true, "int", "bin", "str");

    if(this.isValidBinSegment(item, type)) {
      if(!stack.find(value => !this.isValidBinSegment(value))) {
        stack[0] = Binary.fromMany(stack);
        return stack.length = 1; // uncaught.
      }
    }
    stack.pop();

    switch(type.asOptions[0]) {
      case "int"   : item = Binary.fromNum(item); break;
      case "str"   : item = this.castStr(item);   break;
    }
    stack.push(item);
  }
}

export class Sin_stackOp extends StackOp {
  constructor(typeStack) {
    super(typeStack);
  }
  
  checkType(typeStack) {
    typeStack.addOption("num");
  }

  exec(stack) {
    const [item, _] = this.getValidatedItemAndType_fromStackTop(stack, 0, false, "num");
    const res = Math.sin(item);
    if(isNaN(res)) throw new RuntimeError("Obtained NaN value from sin operation", "Math");
    
    stack.push(res);
  }
}

/*
export class _stackOp extends StackOp {
  constructor(typeStack) {
    super(typeStack);
  }
  
  checkType(typeStack) {
    //TODO
  }

  exec(stack) {

  }
}
*/