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

export class TypeOption {
  constructor(...options) {
    this.options = this.expand(options);
  }

  copy() {
    const copy = new TypeOption();
    for(const type in this.options) {
      const option = this.options[type];
      if(option === false) continue;
      copy.set(type, option instanceof TypeOption ? { many : option.copy() } : option); // list variant not implemented
    }
    return copy;
  }

  expand(options) {
    const expandedOpts = {
      int   : false,
      float : false,
      str   : false,
      list  : false,
      obj   : false,
      void  : false,
      many  : false,
    };

    for(const opt of options) {
      if(expandedOpts[opt] === false) expandedOpts[opt] = true;
      
      if(opt == "many") opt = { many : ["any"] };
      if(typeof opt == "object") {
        if(opt instanceof Array) {
          expandedOpts[opt[0]] = opt[1];
          continue;
        }

        if("list" in opt) return; // TODO: support
        // if "many" in opt:
        expandedOpts.many = new TypeOption(...opt.many);
        continue;
      }

      switch(opt) {
        case "any" :
          expandedOpts.int   = true;
          expandedOpts.float = true;
          expandedOpts.str   = true;
          expandedOpts.list  = true;
          expandedOpts.obj   = true;
          break;
        
        case "num" :
          expandedOpts.int   = true;
          expandedOpts.float = true;
          break;
      }
    }

    return expandedOpts;
  }

  set(type, value = true) {
    this.options[type] = value;
  }

  canBe(type) {
    return type == "any" ? (this.canBe("num") && this.options.str && this.options.list && this.options.obj) :
    type == "num" ? this.options.int || this.options.float
    : this.options[type] !== false;
  }

  isOnly(...types) {
    const expectedTypeOpt = new TypeOption(...types);
    for(const type in this.options) {
      if((this.options[type] !== false) != expectedTypeOpt.options[type]) return false;
    }
    return true;
  }

  isValidFor(typeOpt) {
    for(const type in this.options) {
      if(this.options[type] !== false && typeOpt.canBe(type)) return true;
    }
    return this.options.many && this.options.many.isValidFor(typeOpt);
  }

  toStr() {
    let res = "";
    for(const key in this.options) {
      const option = this.options[key];
      if(option === false) continue;
      let optionText = option instanceof TypeOption ? option.toStr() : key;
      if(typeof option == "number") optionText += `(${option})`;
      res += (key == "many" ? `(${optionText})` :
              key == "list" ? `[${optionText}]` :
              optionText) + "|";
    }
    return res.slice(0, -1);
  }
}

export class TypeStack {
  constructor() {
    this.items = [];
    this.emptyFallback = new TypeOption("void");
  }

  addOption(...options) {
    this.items.push(new TypeOption(...options));
  }

  getItem(atPos = -1) {
    if(itemPos < 0) itemPos = this.items.length + itemPos;
    this.items[itemPos];
  }

  verifyItem_isOfType(expectedTypeOpt, itemPos) {
    if(!this.items.length) return this.emptyFallback.toStr();
    let item = this.getItem(itemPos);
    return item?.isValidFor(expectedTypeOpt) || item?.toStr() || this.emptyFallback.toStr();
  }

  toStr() {
    return this.items.map(item => item.toStr());
  }
}

export class StackOp {
  constructor(typeStack) {
    //this.checkType(typeStack); Temporarily paused development on compile-time typechecking
  }

  checkType(typeStack) { // any|void -0-> any : default behaviour wants at least 0 any:items, takes 0 and returns 1 any:item
    typeStack.addOption("any");
  }

  requestItem(typeStack, itemPos = -1, pop = false, ...options) {
    const typeOpt = new TypeOption(...options);
    const result = typeStack.verifyItem_isOfType(typeOpt, itemPos);
    if(typeof result == "string") throw new Error(`TypeError: ${this.constructor.name} expected ${typeOpt.toStr()} but got ${result}`);
    if(!pop) return;
    const lastElement = typeStack.items[typeStack.items.length - 1];
    return lastElement.canBe("many") ? lastElement.options.many.copy() : typeStack.items.pop();
  }

  checkStackMinLength(stack, amt) {
    if(stack.length < amt) throw new Error(`Runtime NotEnoughArguments Error: ${this.constructor.name} expected ${amt} arguments but got ${stack.length} instead.`);
  }

  grabItemFromTop(stack, inputID, asCopy, ...validTypes) {
    const grabbedItem = asCopy ? stack[stack.length - 1] : stack.pop();
    const itemType    = this.checkItemType(grabbedItem, inputID, ...validTypes);
    return [grabbedItem, itemType];
  }

  checkItemType(item, inputID, ...validTypes) {
    const itemType = Type_stackOp.prototype.getType(item);
    if(validTypes[0] == "any" && itemType != "void") return itemType;
    
    const validTypeOpt = new TypeOption(...validTypes);
    if(itemType == "void" || !validTypeOpt.canBe(itemType)) throw new Error(`Runtime Type Error: ${this.constructor.name} expected ${inputID + 1}° input value to be of type "${validTypeOpt.toStr()}" but got "${itemType}" instead.`);
    return itemType;
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
    const [item] = this.grabItemFromTop(stack, 0, false, "num");
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
    const [item] = this.grabItemFromTop(stack, 0, true, "any");
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
    const [item, type] = this.grabItemFromTop(stack, 0, false, "str", "list", "obj");
    switch(type) {
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

  getType(item) {
    switch(typeof item) {
      case "undefined": return "void";
      case "number"   : return Math.floor(item) === item ? "int" : "float";
      case "string"   : return "str";
      case "object"   : return "list";
      case "obj"      : return "obj"; //NOT READY
    }
  }

  exec(stack) {
    stack.push(this.getType(stack[stack.length - 1]));
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
    let [item1] = this.grabItemFromTop(stack, 0, false, "any");
    let [item2] = this.grabItemFromTop(stack, 1, false, "any");
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
    this.grabItemFromTop(stack, 0, false, "any");
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
    const [item] = this.grabItemFromTop(stack, 0, false, "any");
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

  getRandomStackItem(stack) {
    return stack[ Math.floor(Math.random() * stack.length) ];
  }

  exec(stack) {
    this.checkStackMinLength(stack, 1);
    stack.push(this.getRandomStackItem(stack));
  }
}

export class Num_stackOp extends StackOp {
  constructor(typeStack) {
    super(typeStack);
  }

  checkType(typeStack) {
    //TODO
  }

  castStr(item) {
    if(item.match(/^-?\d+(\.\d+)?/)?.[0] == item) return Number(item);
    if(item.length != 1) throw new Error("Runtime ValueError: casting from non-numeric str to num is only possible with a single character str.");
    return item.charCodeAt(0);
  }

  exec(stack) {
    if(!stack.length) stack.push(0);
    const [item, type] = this.grabItemFromTop(stack, 0, false, "num", "str");
    stack.push(type == "str" ? this.castStr(item) : item);
  }
}

export class Int_stackOp extends Num_stackOp {
  constructor(typeStack) {
    super(typeStack);
  }

  checkType(typeStack) {
    //TODO
  }

  castStr(item) {
    return Math.round(super.castStr(item));
  }

  exec(stack) {
    if(!stack.length) stack.push(0);
    const [item, type] = this.grabItemFromTop(stack, 0, false, "num", "str");
    stack.push(type == "str" ? this.castStr(item) : Math.floor(item));
  }
}

export class Str_stackOp extends StackOp {
  constructor(typeStack) {
    super(typeStack);
  }

  checkType(typeStack) { // void|num|str -all-> str
    const allowedOpts = new TypeOption("num", "str");
    for(const item of typeStack.items) {
      if(!item.isValidFor(allowedOpts)) throw new Error(`TypeError: ${this.constructor.name} expected ${allowedOpts.toStr()} but got ${item.toStr()}`);
    }
    typeStack.items = [];
    typeStack.addOption("str");
  }

  exec(stack) {
    let res = "";
    
    if(stack.length == 1 && Type_stackOp.prototype.getType(stack[0]) == "int") {
      res = String.fromCharCode(stack[0]);
      stack.length = 1;
      stack[0] = res;
      return;
    }

    const initialLength = stack.length;
    for(let i = 0; i < initialLength; i++) {
      const [item, type] = this.grabItemFromTop(stack, i, false, "num", "str");
      res = item + res;
    }
    
    stack[0] = res;
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

    const item = this.grabItemFromTop(stack, 0, false, "obj");
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