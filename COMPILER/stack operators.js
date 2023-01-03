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

export class StackOp {
  constructor(required_stackState = ["any|void"]) {
      this.parseRequirements(required_stackState);
  }

  parseRequirements(required_stackState) {
      //TODO
  }
}

export class Not_stackOp extends StackOp {
  constructor() {
    super(["num"]);
  }

  exec(stack) {
    stack.push(1 * !stack.pop());
  }
}

export class Dup_stackOp extends StackOp {
  constructor() {
    super(["any"]);
  }

  exec(stack) {
    stack.push(stack[stack.length - 1]);
  }
}

export class Size_stackOp extends StackOp {
  constructor() {
    super();
  }
  
  exec(stack) {
    stack.push(stack.length);
  }
}

export class RotL_stackOp extends StackOp {
  constructor() {
    super(["many"]);
  }
  
  exec(stack) {
    stack.push(stack.shift());
  }
}

export class RotR_stackOp extends StackOp {
  constructor() {
    super(["many"]);
  }
  
  exec(stack) {
    stack.unshift(stack.pop());
  }
}

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
  
export class Type_stackOp extends StackOp {
  constructor() {
    super();
  }
  
  exec(stack) {
    switch(typeof stack[stack.length - 1]) {
      case "undefined": stack.push("void"); return;
      case "number" : stack.push("num");  return;
      case "string" : stack.push("str");  return;
      case "object" : stack.push("list"); return;
      case "obj"    : stack.push("obj");  return; //NOT READY
    }
  }
}

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