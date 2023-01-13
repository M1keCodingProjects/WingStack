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

  expand(options) {
    const expandedOpts = {
      num  : false,
      str  : false,
      list : false,
      obj  : false,
      void : false,
    };

    for(const opt of options) {
      if(expandedOpts[opt] === false) expandedOpts[opt] = true;
      if(opt == "any") {
        expandedOpts.num  = true;
        expandedOpts.str  = true;
        expandedOpts.list = true;
        expandedOpts.obj  = true;
      }
    }
    return expandedOpts;
  }

  set(type, value = true) {
    this.options[type] = value;
  }

  canBe(type) {
    return type == "any" ? (this.options.num && this.options.str && this.options.list && this.options.obj) : this.options[type];
  }

  isValidFor(typeOpt) {
    for(const type in this.options) {
      if(this.options[type] && typeOpt.canBe(type)) return true;
    }
    return false;
  }

  toStr() {
    let res = "";
    for(const key in this.options) {
      if(this.options[key]) res += `${key}|`;
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

  verifyTop_isOfType(expectedTypeOpt) {
    if(!this.items.length) return this.emptyFallback.toStr();
    const lastElement = this.items[this.items.length - 1];
    return lastElement.isValidFor(expectedTypeOpt) || lastElement.toStr();
  }
}

export class StackOp {
  constructor(typeStack) {
    this.checkType(typeStack);
  }

  checkType(typeStack) { // any|void -0-> any : default behaviour wants at least 0 any:items, takes 0 and returns 1 any:item
    typeStack.addOption("any");
  }

  requestItem(typeStack, pop = false, ...options) {
    const typeOpt = new TypeOption(...options);
    const result = typeStack.verifyTop_isOfType(typeOpt);
    if(typeof result == "string") throw new Error(`TypeError: ${this.constructor.name} expected ${typeOpt.toStr()} but got ${result}`);
    if(pop) return typeStack.items.pop();
  }

  grab(stack, ...typeOpts) {
    const res = stack.splice(stack.length - typeOpts.length);
    for(let i = 0; i < typeOpts.length; i++) {
      const type = Type_stackOp.prototype.getType(res[i]);
      if(!typeOpts[i].canBe(type)) throw new Error(`Runtime TypeError: ${this.constructor.name} expected #${i + 1} input value to be of type "${typeOpts[i].toStr()}" but got "${type}" instead`);
    }
    return res;
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
    const [el1] = this.grab(stack, new TypeOption("num"));
    stack.push(1 * !el1);
  }
}

export class Dup_stackOp extends StackOp {
  constructor(typeStack) {
    super(typeStack);
  }

  checkType(typeStack) { // any -0-> any
    this.requestItem(typeStack, false, "any");
    const lastItem = Object.assign(new TypeOption, typeStack.items[typeStack.items.length - 1]);
    typeStack.items.push(lastItem);
  }

  exec(stack) {
    stack.push(stack[stack.length - 1]);
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
    stack.unshift(stack.pop());
  }
}
/*
export class Spill_stackOp extends StackOp {
  constructor() {
    super(["str|list|obj"])
  }
  
  exec(stack) {
    const el = stack.pop();
    switch(typeof el) {
      case "string" : stack.push(...el.split("")); return;
      case "object" : stack.push(...el); return;
      case "obj"    : stack.push(...el.listEnumerable()); return; //NOT READY
    }
  }
}
*/
export class Type_stackOp extends StackOp {
  constructor(typeStack) {
    super(typeStack);
  }
  
  checkType(typeStack) { // any|void -0-> str
    this.requestItem(typeStack, true, "any", "void");
    typeStack.addOption("str");
  }

  getType(item) {
    switch(typeof item) {
      case "undefined": return "void";
      case "number"   : return "num";
      case "string"   : return "str";
      case "object"   : return "list";
      case "obj"      : return "obj"; //NOT READY
    }
  }

  exec(stack) {
    stack.push(this.getType(stack[stack.length - 1]));
  }
}
/*
export class Swap_stackOp extends StackOp {
  constructor() {
    super(["many"]);
  }
  
  exec(stack) {
    let el1 = stack.pop();
    let el2 = stack.pop();
    stack.push(el1, el2);
  }
}

export class Drop_stackOp extends StackOp {
  constructor() {
    super(["any"]);
  }
  
  exec(stack) {
    stack.pop();
  }
}

export class Pop_stackOp extends StackOp {
  constructor() {
    super(["any"]);
  }

  exec(stack) {
    stack.splice(0, stack.length - 1, stack.pop());
  }
}
/*
export class Rand_stackOp extends StackOp {
  constructor(ID) { super(ID, "rand"); }
  
  exec(stack) {
    this.check_minLength(stack, 1);
    stack.data.push(stack.fetch(Math.floor(Math.random() * stack.len())));
  }
}

export class Limit_stackOp extends StackOp {
  constructor(ID) { super(ID, ","); }
  
  exec(stack) {
    this.check_minLength(stack, 1);
    stack.fetchID = stack.len();
  }
}

//########################################################################################################
class Cast_stackOp extends StackOp {
  constructor(ID, type, acceptedTypes) {
    super(ID, type);
    this.acceptedTypes = acceptedTypes;
  }
  
  exec(stack) {
    if(!this.acceptedTypes.includes("none")) this.check_minLength(stack, 1);
    let el;
    let type = "many";
    if(this.acceptedTypes.includes("many") && stack.len() > 1) el = [...stack.pop("all")];
    else {
      el = stack.pop();
      type = StackValue.prototype.get_type(el);
      if(!this.acceptedTypes.includes(type)) throw new Errors.RuntimeError(this.ID, `Invalid casting attempt from <${type}> to <${this.type}>, expected ${this.acceptedTypes.join(" or ")}`);
    }
    stack.data.push(this.cast(el, type));
  }
}

export class NumCast_stackOp extends Cast_stackOp {
  constructor(ID) { super(ID, "number", ["number", "string"]); }

  cast(el, type) {
    if(isNaN(el)) throw new Errors.RuntimeError(this.ID, `string literal item "${el}" cannot be converted to a number`);
    return Number(el);
  }
}

export class StrCast_stackOp extends Cast_stackOp {
  constructor(ID) { super(ID, "string", ["number", "string", "list", "many"]); }

  cast(el, type){
    switch(type) {
      case "list": return el.join(" ");
      case "many": return el.join("");
      default    : return `${el}`;
    }
  }
}

export class LstCast_stackOp extends Cast_stackOp {
  constructor(ID) { super(ID, "list", ["number", "string", "list", "many", "object"]); }

  cast(el, type) {
    switch(type) {
      case "many"   : return [...el];
      case "object" : const propertiesList = Object.entries(el).filter(entry => !(entry[1] instanceof Function));
                      if(!propertiesList.length) throw new Errors.RuntimeError(this.ID, "Nothing to pack! A <pack> operation was performed on an OBJECT-type item with no properties, which results in an empty LIST");
                      return propertiesList;
      default       : return [el];
    }
  }
}

export class ObjCast_stackOp extends Cast_stackOp {
  constructor(ID) { super(ID, "object", ["number", "string", "list", "object"]); }

  cast(el, type) {
    if(type == "object") return {...el};
    return { value : el };
  }
}

//########################################################################################################

/* TEMPLATE BELOW :
export class _stackOp extends StackOp {
  constructor(ID) { super(ID, ""); }
  
  exec(stack) {
    this.check_minLength(stack, 1);
    
  }
}
*/