import * as Errors from "./errors.js";

export class StackValue {
    constructor(ID, value) {
      this.ID = ID;
      this.value = value;
    }
    
    get_type(stackElement) {
      if(stackElement === undefined) return "none";
      switch(typeof stackElement) {
        case 'string'  : return 'string';
        case 'number'  : return 'number';
        case 'boolean' : return 'number';
        case 'object'  : return stackElement instanceof Array ? 'list' : 'object';
        default: throw new Errors.RuntimeError(this.ID, `unknown or unsupported <StackElement> type ${typeof stackElement}`);
      }
    }

    execute(stack) {
      stack.push(this.value);
      return true;
    }
  }
  
export class StackOp {
  constructor(ID, type, replacedExpr = false) {
    this.ID = ID;
    this.type = type;
    if(replacedExpr) {
      this.stackOps = [...replacedExpr];
      this.stackOps.forEach(stackOp => stackOp.ID = ID);
      this.execute = this.replaceExec;
    }
  }
  
  check_minLength(stack, len) { if(stack.length < len) throw new Errors.RuntimeError(this.ID, `A Runtime NotEnoughArguments Error occurred at line ${this.ID} : tried performing the stack operation "${this.type}" with less than ${len} elements on the stack`); }
  throw_unsupportedTypes_error(acceptedTypes, typesArr) { throw new Errors.RuntimeError(this.ID, `A Runtime UnsupportedTypes Error occurred at line ${this.ID} : unsupported type(s) for <StackOperator> "${this.type}", which only accepts items of type(s) ${acceptedTypes.join(" or ")}, and instead got : ${typesArr.join(" and ")}`); }

  replaceExec(stack) {
    for(let stackOp of this.stackOps) {
      try { stackOp.execute(stack); }
      catch(e) {
        throw new Errors.RuntimeError(this.ID, `Execution failed inside of a <${this.type}> stackOp: ${e.message}`);
      }
    }
    return true;
  }
}

//########################################################################################################
export class Math_stackOp extends StackOp {
  constructor(ID, type, acceptedTypes = ["number"]) { 
    super(ID, type);
    this.acceptedTypes = acceptedTypes;
  }
  
  execute(stack) {
    this.check_minLength(stack, 2);
    let el2 = stack.pop();
    let type2 = StackValue.prototype.get_type(el2);
    let el1 = stack.pop();
    let type1 = StackValue.prototype.get_type(el1);
    if(!this.acceptedTypes.includes(type1) || !this.acceptedTypes.includes(type2)) this.throw_unsupportedTypes_error(this.acceptedTypes, [type1, type2]);
    return [el1, el2];
  }
  
  checkNaN(stack, res) {
    if(isNaN(res)) throw new Errors.RuntimeError(this.ID, "you tried performing a mathematically impossible operation");
    stack.push(res);
    return true;
  }
}

export class Add_stackOp extends Math_stackOp {
  constructor(ID) { super(ID, "+", ["number", "string"]); }
  
  execute(stack) {
    let [el1, el2] = super.execute(stack);
    stack.push(el1 + el2);
  }
}

export class Sub_stackOp extends Math_stackOp {
  constructor(ID) { super(ID, "-"); }
  
  execute(stack) {
    let [el1, el2] = super.execute(stack);
    this.checkNaN(stack, el1 - el2);
  }
}

export class Mult_stackOp extends Math_stackOp {
  constructor(ID) { super(ID, "*"); }
  
  execute(stack) {
    let [el1, el2] = super.execute(stack);
    this.checkNaN(stack, el1 * el2);
  }
}

export class Div_stackOp extends Math_stackOp {
  constructor(ID) { super(ID, "/"); }
  
  execute(stack) {
    let [el1, el2] = super.execute(stack);
    this.checkNaN(stack, el1 / el2);
  }
}

export class Idiv_stackOp extends Math_stackOp {
  constructor(ID) { super(ID, "//"); }
  
  execute(stack) {
    let [el1, el2] = super.execute(stack);
    this.checkNaN(stack, Math.floor(el1 / el2));
  }
}

export class Pow_stackOp extends Math_stackOp {
  constructor(ID) { super(ID, "**"); }
  
  execute(stack) {
    let [el1, el2] = super.execute(stack);
    this.checkNaN(stack, el1 ** el2);
  }
}

export class And_stackOp extends Math_stackOp {
  constructor(ID) { super(ID, "&&"); }
  
  execute(stack) {
    let [el1, el2] = super.execute(stack);
    this.checkNaN(stack, 1 * (el1 && el2));
  }
}

export class Band_stackOp extends Math_stackOp {
  constructor(ID) { super(ID, "&"); }
  
  execute(stack) {
    let [el1, el2] = super.execute(stack);
    this.checkNaN(stack, 1 * (el1 & el2));
  }
}

export class Or_stackOp extends Math_stackOp {
  constructor(ID) { super(ID, "||"); }
  
  execute(stack) {
    let [el1, el2] = super.execute(stack);
    this.checkNaN(stack, 1 * (el1 || el2));
  }
}

export class Bor_stackOp extends Math_stackOp {
  constructor(ID) { super(ID, "|"); }

  execute(stack) {
    let [el1, el2] = super.execute(stack);
    this.checkNaN(stack, 1 * (el1 | el2));
  }
}

export class Xor_stackOp extends Math_stackOp {
  constructor(ID) { super(ID, "xor"); }
  
  execute(stack) {
    let [el1, el2] = super.execute(stack);
    this.checkNaN(stack, 1 * ((el1 || el2) && !(el1 && el2)));
  }
}

export class Grt_stackOp extends Math_stackOp {
  constructor(ID) { super(ID, ">"); }
  
  execute(stack) {
    let [el1, el2] = super.execute(stack);
    this.checkNaN(stack, 1 * (el1 > el2));
  }
}

export class Lst_stackOp extends Math_stackOp {
  constructor(ID) { super(ID, "<"); }
  
  execute(stack) {
    let [el1, el2] = super.execute(stack);
    this.checkNaN(stack, 1 * (el1 < el2));
  }
}

export class Eqs_stackOp extends Math_stackOp {
  constructor(ID) { super(ID, "==", ["number", "string"]); }
  
  execute(stack) {
    let [el1, el2] = super.execute(stack);
    this.checkNaN(stack, 1 * (el1 == el2));
  }
}

export class Rshft_stackOp extends Math_stackOp {
  constructor(ID) { super(ID, ">>"); }
  
  execute(stack) {
    let [el1, el2] = super.execute(stack);
    this.checkNaN(stack, 1 * (el1 >> el2));
  }
}

export class Lshft_stackOp extends Math_stackOp {
  constructor(ID) { super(ID, "<<"); }
  
  execute(stack) {
    let [el1, el2] = super.execute(stack);
    this.checkNaN(stack, 1 * (el1 << el2));
  }
}

//########################################################################################################

export class Not_stackOp extends StackOp {
  constructor(ID) { super(ID, "!"); }
  
  execute(stack) {
    this.check_minLength(stack, 1);
    let el1 = stack.pop();
    if(StackValue.prototype.get_type(el1) != "number") return this.throw_unsupportedTypes_error(["<number>"], [type1]);
    stack.push(1 * !el1);
  }
}

export class Bnot_stackOp extends StackOp {
  constructor(ID) { super(ID, "~"); }
  
  execute(stack) {
    this.check_minLength(stack, 1);
    let el1 = stack.pop();
    if(StackValue.prototype.get_type(el1) != "number") return this.throw_unsupportedTypes_error(["<number>"], [type1]);
    stack.push(1 * ~el1);
  }
}

export class Dup_stackOp extends StackOp {
  constructor(ID) { super(ID, "dup"); }
  
  execute(stack) {
    this.check_minLength(stack, 1);
    stack.push(stack[stack.length - 1]);
  }
}

export class Size_stackOp extends StackOp {
  constructor(ID) { super(ID, "size"); }
  
  execute(stack) {
    stack.push(stack.length);
  }
}

export class RotL_stackOp extends StackOp {
  constructor(ID) { super(ID, "rot<"); }
  
  execute(stack) {
    this.check_minLength(stack, 2);
    stack.push(stack.shift());
  }
}

export class RotR_stackOp extends StackOp {
  constructor(ID) { super(ID, "rot>"); }
  
  execute(stack) {
    this.check_minLength(stack, 2);
    stack.unshift(stack.pop());
  }
}

export class Spill_stackOp extends StackOp {
  constructor(ID) { super(ID, "spill"); }
  
  execute(stack) {
    this.check_minLength(stack, 1);
    let el1 = stack.pop();
    let type1 = StackValue.prototype.get_type(el1);
    switch(type1) {
      case "string" : stack.push(...el1.split("")); break;
      case "list" :   stack.push(...el1); break;
      default :       return this.throw_unsupportedTypes_error(["<list>", "<string>"], [type1]);
    }
  }
}
  
export class Type_stackOp extends StackOp {
  constructor(ID) { super(ID, "type"); }
  
  execute(stack) {
    this.check_minLength(stack, 1);
    stack.push(StackValue.prototype.get_type(stack.pop()));
  }
}

export class Swap_stackOp extends StackOp {
  constructor(ID) { super(ID, "swap"); }
  
  execute(stack) {
    this.check_minLength(stack, 2);
    let el1 = stack.pop();
    let el2 = stack.pop();
    stack.push(el1, el2);
  }
}

export class Drop_stackOp extends StackOp {
  constructor(ID) { super(ID, "drop"); }
  
  execute(stack) {
    this.check_minLength(stack, 1);
    stack.pop();
  }
}

export class Inp_stackOp extends StackOp {
  constructor(ID) { super(ID, "inp"); }
  
  execute(stack) {
    let res = prompt("GLIDE Compiler requested user input:");
    if(res === null) throw new Errors.RuntimeError(this.ID, `unhandled user input, don't cancel input prompts!`);
    let fres = Number(res);
    stack.push(isNaN(fres) ? res : fres);
  }
}

export class Over_stackOp extends StackOp {
  constructor(ID) { super(ID, "over"); }
  
  execute(stack) {
    this.check_minLength(stack, 3);
    stack.push(...stack.splice(-3, 1));
  }
}

export class Rand_stackOp extends StackOp {
  constructor(ID) { super(ID, "rand"); }
  
  execute(stack) {
    this.check_minLength(stack, 1);
    stack.push(stack[Math.floor(Math.random() * stack.length)]);
  }
}

export class Pop_stackOp extends StackOp {
  constructor(ID) { super(ID, "pop"); }
  
  execute(stack) {
    this.check_minLength(stack, 1);
    stack.unshift(stack.pop());
    stack.length = 1;
  }
}

//########################################################################################################
class Cast_stackOp extends StackOp {
  constructor(ID, type, acceptedTypes) {
    super(ID, type);
    this.acceptedTypes = acceptedTypes;
  }
  
  execute(stack) {
    if(!this.acceptedTypes.includes("none")) this.check_minLength(stack, 1);
    let el;
    let type = "many";
    if(this.acceptedTypes.includes("many") && stack.length > 1) {
      el = [...stack];
      stack.length = 0;
    }
    else {
      el = stack.pop();
      type = StackValue.prototype.get_type(el);
      if(!this.acceptedTypes.includes(type)) Errors.RuntimeError(this.ID, `Invalid casting attempt from ${type} to ${this.type}, expected ${this.acceptedTypes.join("or ")}`);
    }
    stack.push(this.cast(el, type));
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
  constructor(ID) { super(ID, "list", ["number", "string", "list", "many"]); }

  cast(el, type) {
    switch(type) {
      case "list": return el;
      case "many": return [...el];
      default    : return [el];
    }
  }
}

//########################################################################################################

/* TEMPLATE BELOW :
export class _stackOp extends StackOp {
  constructor(ID) { super(ID, ""); }
  
  execute(stack) {
    this.check_minLength(stack, 1);
    
  }
}
*/

/* DEPRECATED OPS BELOW:
export class Mod_stackOp extends Math_stackOp {  // Deprecated: the basic stack ops module replaces this function
  constructor(ID) { super(ID, "%"); }
  
  execute(stack) {
    let [el1, el2] = super.execute(stack);
    this.checkNaN(stack, el1 % el2);
  }
}
export class Gre_stackOp extends Math_stackOp {  // Deprecated: the basic stack ops module replaces this function
  constructor(ID) { super(ID, ">="); }
  
  execute(stack) {
    let [el1, el2] = super.execute(stack);
    this.checkNaN(stack, 1 * (el1 >= el2));
  }
}
export class Lse_stackOp extends Math_stackOp {  // Deprecated: the basic stack ops module replaces this function
  constructor(ID) { super(ID, "<="); }
  
  execute(stack) {
    let [el1, el2] = super.execute(stack);
    this.checkNaN(stack, 1 * (el1 <= el2));
  }
}
export class Neq_stackOp extends Math_stackOp {  // Deprecated: the basic stack ops module replaces this function
  constructor(ID) { super(ID, "!=", ["number", "string"]); }
  
  execute(stack) {
    let [el1, el2] = super.execute(stack);
    this.checkNaN(stack, 1 * (el1 != el2));
  }
}
*/