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
import { requestInput, RuntimeError } from "./customErrors.js";
import { Type, runtime_checkGot_asValidExpected, runtime_checkType, runtime_getTypeStr } from "./type checker.js";
export class StackOp {
  constructor(typeStack) {
    //this.checkType(typeStack); Temporarily paused development on compile-time typechecking
  }

  raise(errorMsg) {
    throw new RuntimeError(errorMsg);
  }

  checkType(typeStack) { // any|void -0-> any : default behaviour wants at least 0 any:items, takes 0 and returns 1 any:item
    typeStack.addOption("any");
  }

  requestItem(typeStack, itemPos = -1, pop = false, ...options) {
    const typeOpt = new TypeOption(...options);
    const result = typeStack.verifyItem_isOfType(typeOpt, itemPos);
    if(typeof result == "string") throw new RuntimeError(`${this.constructor.name} expected ${typeOpt.toStr()} but got ${result}`, "Type");
    if(!pop) return;
    const lastElement = typeStack.items[typeStack.items.length - 1];
    return lastElement.canBe("many") ? lastElement.options.many.copy() : typeStack.items.pop();
  }

  checkStackMinLength(stack, amt) {
    if(stack.length < amt) throw new RuntimeError(`${this.constructor.name} expected ${amt} arguments but got ${stack.length} instead`, "NotEnoughArguments");
  }

  getValidatedItemAndType_fromStackTop(stack, inputID, asCopy, ...validTypes) {
    const grabbedItem = asCopy ? stack[stack.length - inputID - 1] : stack.pop();
    const itemType    = this.getValidatedItemType(grabbedItem, inputID, ...validTypes);
    return [grabbedItem, itemType];
  }

  getValidatedItemType(item, inputID, ...validTypes) {
    const expected = new Type(...validTypes);
    const got      = runtime_checkType(item);
    if(!runtime_checkGot_asValidExpected(expected, got)) throw new RuntimeError(`${this.constructor.name} expected ${inputID + 1}° input value to be of type "${expected.toString()}" but got "${got.toString()}" instead`, "Type");
    return got;
  }
}

export class Math_stackOp extends StackOp {
  constructor(symbol, typeStack) {
      super(typeStack);
      this.init_exec(symbol);
  }

  checkType(typeStack) { // num num -2-> num
      this.requestItem(typeStack, true, "num");
      this.requestItem(typeStack, true, "num");
      typeStack.addOption("num");
  }

  getOperands(stack) {
      const  [item2] = this.getValidatedItemAndType_fromStackTop(stack, 0, false, "num");
      const  [item1] = this.getValidatedItemAndType_fromStackTop(stack, 1, false, "num");
      return [item1, item2];
  }

  round(n) {
      return Number(Math.round(`${n}e${5}`) + `e-${5}`);
  }

  checkNaN(res) {
      if(isNaN(res)) this.raise("A math error has occurred inside of a StackExpression");
  }

  init_exec(symbol) {
      const operationFunc = this.getOperationFunc(symbol);
      this.exec = (stack => {
          const res = operationFunc(...this.getOperands(stack));
          this.checkNaN(res);
          stack.push(res);
      }).bind(this);
  }

  getOperationFunc(symbol) {
      switch(symbol) {
          case "-"   : return (el1, el2) => el1 - el2;
          case "/"   : return (el1, el2) => el1 / el2;
          case "**"  : return (el1, el2) => el1 ** el2;
          case "and" : return (el1, el2) => 1 * (Boolean(el1) && Boolean(el2));
          case "or"  : return (el1, el2) => 1 * (Boolean(el1) || Boolean(el2));
          case ">"   : return (el1, el2) => 1 * (el1 > el2);
          case "<"   : return (el1, el2) => 1 * (el1 < el2);
          case ">>"  : return (el1, el2) => 1 * (el1 >> el2);
          case "<<"  : return (el1, el2) => 1 * (el1 << el2);
      }
  }
}

export class Plus_stackOp extends StackOp {
  constructor(typeStack) {
      super(typeStack);
  }

  checkType(typeStack) { // num|str num|str -2-> num|str
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
      const [el2]    = this.getValidatedItemAndType_fromStackTop(stack, 0, false, "num", "str");
      const [el1]    = this.getValidatedItemAndType_fromStackTop(stack, 1, false, "num", "str");
      const res      = el1 + el2;
      const resIsNum = runtime_getTypeStr(res) != "str";
      if(resIsNum) Math_stackOp.prototype.checkNaN(res);
      stack.push(resIsNum ? Math_stackOp.prototype.round(res) : res);
  }
}

export class Eqs_stackOp extends StackOp {
  constructor(typeStack) {
      super(typeStack);
  }

  checkType(typeStack) { // any any -2-> num
      const el2 = this.requestItem(typeStack, true, "any");
      const el1 = this.requestItem(typeStack, true, "any");
      typeStack.addOption("num");
  }

  exec(stack) {
      const el2 = stack.pop();
      const el1 = stack.pop();
      const res = 1 * (el1 === el2);
      stack.push(res);
  }
}

export class Mult_stackOp extends StackOp {
  constructor(typeStack) {
      super(typeStack);
  }

  checkType(typeStack) { // num|str num|str -2-> num|str
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

  _multiplyNumWithStr(num, str) {
      if(runtime_getTypeStr(num) == "float") this.raise("Cannot repeat a str value with a float amount of times");
      return str.repeat(num);
  }

  exec(stack) {
      const [el2, type2] = this.getValidatedItemAndType_fromStackTop(stack, 0, false, "num", "str");
      const [el1, type1] = this.getValidatedItemAndType_fromStackTop(stack, 1, false, "num", "str");
      const el1_isStr    = type1.canBe("str");
      const el2_isStr    = type2.canBe("str");

      if(el1_isStr && el2_isStr) this.raise("Cannot multiply two strings together");

      const res = el1_isStr ? this._multiplyNumWithStr(el2, el1) :
                  el2_isStr ? this._multiplyNumWithStr(el1, el2) :
                  el1 * el2;
      
      if(typeof res == "number") Math_stackOp.prototype.checkNaN(res);
      stack.push(res);
  }
}

export class Inp_stackOp extends StackOp {
  constructor(typeStack) {
      super(typeStack);
  }

  checkType(typeStack) { // any|void -0-> num|str
      typeStack.addOption("num", "str");
  }

  async exec(stack) {
      const userInput = await requestInput();
      stack.push(userInput);
  }
}

export class Not_stackOp extends StackOp {
  constructor(typeStack) {
    super(typeStack);
  }

  checkType(typeStack) { // num -1-> num
    this.requestItem(typeStack, true, "num");
    typeStack.addOption("num");
  }

  exec(stack) {
    const [item] = this.getValidatedItemAndType_fromStackTop(stack, 0, false, "num");
    stack.push(1 * !item);
  }
}

export class Dup_stackOp extends StackOp {
  constructor(typeStack) {
    super(typeStack);
  }

  checkType(typeStack) { // any -0-> any
    const lastItem = this.requestItem(typeStack, true, "any");
    typeStack.items.push(lastItem, lastItem.copy());
    console.log(typeStack.items);
  }

  exec(stack) {
    const [item] = this.getValidatedItemAndType_fromStackTop(stack, 0, true, "any");
    stack.push(item);
  }
}

export class Size_stackOp extends StackOp {
  constructor(typeStack) {
    super(typeStack);
  }
  
  checkType(typeStack) { // any|void -0-> num
    typeStack.addOption("num");
  }

  exec(stack) {
    stack.push(stack.length);
  }
}

export class RotL_stackOp extends StackOp {
  constructor(typeStack) {
    super(typeStack);
  }
  
  checkType(typeStack) { // any any -0-> void
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
  
  checkType(typeStack) { // any any -0-> void
    this.requestItem(typeStack, false, "any");
    this.requestItem(typeStack, false, "any");
    typeStack.items.unshift(typeStack.items.pop());
  }

  exec(stack) {
    this.checkStackMinLength(stack, 2);
    stack.unshift(stack.pop());
  }
}

export class Spill_stackOp extends StackOp {
  constructor(typeStack) {
    super(typeStack);
  }
  
  checkType(typeStack) { // str|list|obj -1-> void|any|many
    const el = this.requestItem(typeStack, true, "str", "list", "obj");
    if(!el.isValidFor(new TypeOption("str"))) return;
    if(el.options.str === true) return typeStack.addOption({ many : ["str"] });
    for(let i = 0; i < el.options.str; i++) typeStack.addOption("str");
  }

  exec(stack) {
    const [item, type] = this.getValidatedItemAndType_fromStackTop(stack, 0, false, "str", "list", "obj");
    switch(type.asOptions[0]) {
      case "str"  : stack.push(...item.split("")); return;
      case "list" : stack.push(...item); return;
      case "obj"  : stack.push(...item.listEnumerable()); return; //NOT READY
    }
  }
}

export class Type_stackOp extends StackOp {
  constructor(typeStack) {
    super(typeStack);
  }
  
  checkType(typeStack) { // any|void -0-> str
    this.requestItem(typeStack, false, "any", "void");
    typeStack.addOption("str");
  }

  exec(stack) {
    const value = stack[stack.length - 1];
    stack.push(runtime_getTypeStr(value));
  }
}

export class Flip_stackOp extends StackOp {
  constructor(typeStack) {
    super(typeStack);
  }

  checkType(typeStack) { // any any -0-> void
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

  checkType(typeStack) {
    //TODO
  }
  
  exec(stack) {
    this.checkStackMinLength(stack, 2);
    let [item1] = this.getValidatedItemAndType_fromStackTop(stack, 0, false, "any");
    let [item2] = this.getValidatedItemAndType_fromStackTop(stack, 1, false, "any");
    stack.push(item1, item2);
  }
}

export class Drop_stackOp extends StackOp {
  constructor(typeStack) {
    super(typeStack);
  }

  checkType(typeStack) {
    //TODO
  }
  
  exec(stack) {
    this.getValidatedItemAndType_fromStackTop(stack, 0, false, "any");
  }
}

export class Pop_stackOp extends StackOp {
  constructor(typeStack) {
    super(typeStack);
  }

  checkType(typeStack) {
    //TODO
  }

  exec(stack) {
    const [item] = this.getValidatedItemAndType_fromStackTop(stack, 0, false, "any");
    stack.length = 1;
    stack[0]     = item;
  }
}

export class Rand_stackOp extends StackOp {
  constructor(typeStack) {
    super(typeStack);
  }
  
  checkType(typeStack) {
    //TODO
  }

  exec(stack) {
    this.checkStackMinLength(stack, 2);
    const [item2] = this.getValidatedItemAndType_fromStackTop(stack, 0, false, "num");
    const [item1] = this.getValidatedItemAndType_fromStackTop(stack, 1, false, "num");
    stack.push(Math.random() * (item2 - item1) + item1); // remember to implement rounding
  }
}

export class Num_stackOp extends StackOp {
  constructor(typeStack) {
    super(typeStack);
  }

  checkType(typeStack) {
    //TODO
  }

  castStr_toNum(item) {
    if(item.match(/^-?\d+(\.\d+)?/)?.[0] == item) return Number(item);
    if(item.length != 1) throw new RuntimeError("Casting from non-numeric str to num is only possible with a single character str", "Value");
    return item.charCodeAt(0);
  }

  exec(stack) {
    if(!stack.length) stack.push(0);
    const [item, type] = this.getValidatedItemAndType_fromStackTop(stack, 0, false, "num", "str");
    stack.push(type == "str" ? this.castStr_toNum(item) : item);
  }
}

export class Int_stackOp extends Num_stackOp {
  constructor(typeStack) {
    super(typeStack);
  }

  checkType(typeStack) {
    //TODO
  }

  castStr_toNum(item) {
    return Math.round(super.castStr_toNum(item));
  }

  exec(stack) {
    if(!stack.length) stack.push(0);
    const [item, type] = this.getValidatedItemAndType_fromStackTop(stack, 0, false, "num", "str");
    stack.push(type == "str" ? this.castStr_toNum(item) : Math.floor(item));
  }
}

export class Str_stackOp extends StackOp {
  constructor(typeStack) {
    super(typeStack);
  }

  checkType(typeStack) { // void|num|str -all-> str
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
      const [item, type] = this.getValidatedItemAndType_fromStackTop(stack, i, false, "num", "str");
      res = item + res;
    }
    
    stack[0] = res;
  }
}

export class Char_stackOp extends StackOp { // technically not casting
  constructor(typeStack) {
    super(typeStack);
  }

  checkType(typeStack) {
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

  checkType(typeStack) {
    //TODO
  }

  exec(stack) {
    const res    = [...stack];
    stack.length = 1;
    stack[0]     = res;
  }
}

export class Obj_stackOp extends StackOp {
  constructor(typeStack) {
    super(typeStack);
  }

  checkType(typeStack) {
    //TODO
  }

  exec(stack) {
    if(!stack.length) return stack.push({});

    const item = this.getValidatedItemAndType_fromStackTop(stack, 0, false, "obj");
    stack.push({...item}); // NOT READY!!
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