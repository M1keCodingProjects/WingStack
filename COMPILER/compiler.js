import Parser from "../PARSING/parser.js";
import * as ProcClasses from "./procedures.js";
import * as StackClasses from "./stack operators.js";
import {Assignment, FuncCall} from "./arguments.js";
import * as Errors from "./errors.js";

export default class Compiler {
    constructor(usedFilePath, preloadedModuleList) {
        this.procKeywords = {
          print   : ((compilerRef, line) => new ProcClasses.PrintProc(compilerRef,   line)),
          make    : ((compilerRef, line) => new ProcClasses.MakeProc(compilerRef,    line)),
          free    : ((compilerRef, line) => new ProcClasses.FreeProc(compilerRef,    line)),
          replace : ((compilerRef, line) => new ProcClasses.ReplaceProc(compilerRef, line)),
          loop    : ((compilerRef, line) => new ProcClasses.LoopProc(compilerRef,    line)),
          use     : ((compilerRef, line) => new ProcClasses.UseProc(compilerRef,     line)),
          when    : ((compilerRef, line) => new ProcClasses.WhenProc(compilerRef,    line)),
          next    : ((compilerRef, line) => new ProcClasses.NextProc(compilerRef,    line)),
          exit    : ((compilerRef, line) => new ProcClasses.ExitProc(compilerRef,    line)),
          def     : ((compilerRef, line) => new ProcClasses.DefProc(compilerRef,     line)),
          match   : ((compilerRef, line) => new ProcClasses.MatchProc(compilerRef,   line)),
          else    : 0,
          with    : 0,
        };

        this.constants = {
          "TRUE"  : 1,
          "FALSE" : 0,
          "PI"    : Math.PI,
          "INF"   : Infinity,
        };
        
        this.assignmentSymbols = ["=", "+=", "-=", "*=", "/="];

        this.modules = preloadedModuleList;
        this.currentFile = usedFilePath;

        this.resetComp();
        this.resetExec();

        this.parser = new Parser(this);
    }

    resetComp() {
        this.AST   = [];
        this.lines = [];
        this.loadedModules = [this.currentFile];
        this.stackOps = {
          dup    : ((ID) => new StackClasses.Dup_stackOp(ID)),
          size   : ((ID) => new StackClasses.Size_stackOp(ID)), 
          "rot<" : ((ID) => new StackClasses.RotL_stackOp(ID)),
          "rot>" : ((ID) => new StackClasses.RotR_stackOp(ID)),
          swap   : ((ID) => new StackClasses.Swap_stackOp(ID)),
          drop   : ((ID) => new StackClasses.Drop_stackOp(ID)),
          inp    : ((ID) => new StackClasses.Inp_stackOp(ID)),
          spill  : ((ID) => new StackClasses.Spill_stackOp(ID)),
          rand   : ((ID) => new StackClasses.Rand_stackOp(ID)),
          over   : ((ID) => new StackClasses.Over_stackOp(ID)),
          "type" : ((ID) => new StackClasses.Type_stackOp(ID)),
          pop    : ((ID) => new StackClasses.Pop_stackOp(ID)),
          and    : ((ID) => new StackClasses.And_stackOp(ID)),
          "&"    : ((ID) => new StackClasses.Band_stackOp(ID)),
          or     : ((ID) => new StackClasses.Or_stackOp(ID)), 
          "|"    : ((ID) => new StackClasses.Bor_stackOp(ID)),
          xor    : ((ID) => new StackClasses.Xor_stackOp(ID)),
          not    : ((ID) => new StackClasses.Not_stackOp(ID)),
          "!"    : ((ID) => new StackClasses.Bnot_stackOp(ID)),
          ">"    : ((ID) => new StackClasses.Grt_stackOp(ID)),
          "<"    : ((ID) => new StackClasses.Lst_stackOp(ID)),
          "=="   : ((ID) => new StackClasses.Eqs_stackOp(ID)),
          "+"    : ((ID) => new StackClasses.Add_stackOp(ID)),
          "-"    : ((ID) => new StackClasses.Sub_stackOp(ID)),
          "*"    : ((ID) => new StackClasses.Mult_stackOp(ID)),
          "/"    : ((ID) => new StackClasses.Div_stackOp(ID)),
          "//"   : ((ID) => new StackClasses.Idiv_stackOp(ID)),
          "**"   : ((ID) => new StackClasses.Pow_stackOp(ID)),
          ">>"   : ((ID) => new StackClasses.Rshft_stackOp(ID)),
          "<<"   : ((ID) => new StackClasses.Lshft_stackOp(ID)),
          num    : ((ID) => new StackClasses.NumCast_stackOp(ID)),
          str    : ((ID) => new StackClasses.StrCast_stackOp(ID)),
          pack   : ((ID) => new StackClasses.LstCast_stackOp(ID)),
          obj    : ((ID) => new StackClasses.ObjCast_stackOp(ID)),
          ","    : ((ID) => new StackClasses.Limit_stackOp(ID)),
        };
    }
    
    resetExec() {
        this.currentID  = 0;
        this.scopeDepth = 0;
        this.skipIter   = false;
        this.exitStatus = false;
        this.EOF = this.lines.length;
        this.callStack = [];
        this.openLoops = [];
        this.vars      = [];
    }
    
    load(fileNameToken) {
      const fileName = fileNameToken.value;
      if(!this.modules[fileName]) throw new Error(`at line ${fileNameToken.ID}: couldn't find module "${fileName}" in the available modules list`);
      if(this.loadedModules.includes(fileName)) {
        console.warn(`at line ${fileNameToken.ID}: module "${fileName}" already loaded`);
        return false;
      }
      this.loadedModules.push(fileName);
      return this.modules[fileName];
    }

    printAST() {
      console.log(JSON.stringify(this.AST, null, 2));
      console.log(this.lines);
    }

    run(fileContent) {
        console.clear();
        this.compile(fileContent);
        if(this.lines.length) this.execute();
    }
    
    compile(fileContent) {
        this.resetComp();
        this.AST = this.parser.parse(fileContent).body;
        if(!this.AST.length) return;
        console.log("Done parsing");
        this.printAST();
        this.lines = this.tokenize(this.AST);
        console.log("Compilation terminated successfully.");
    }

    compileModule(moduleNameToken, flag) {
      const loadedModule = this.load(moduleNameToken);
      if(!loadedModule) return null;
      return new Parser(this).parse(loadedModule, flag).body;
    }
    
    tokenize(lines) {
      const tokenizedLines = [];
      for(let line of lines) {
        let type = line.type instanceof Array ? line.type[0] : line.type;
        switch(type) {
          case "Procedure"  : tokenizedLines.push(this.procKeywords[line.type.pop()](this, line)); break;
          case "Assignment" : tokenizedLines.push(new Assignment(line.ID, this, line));            break;
          case "FuncCall"   : tokenizedLines.push(new FuncCall(line.ID, this, line));              break;
          case "Helper"     : tokenizedLines.push(new ProcClasses.HelperExpr(this, line));         break;
          default           : throw new Error(`AST contains line I cannot yet tokenize of type ${line.type}`);
        }
      }
      return tokenizedLines;
    }

    execute() {
        this.resetExec();
        while(this.currentID < this.EOF) this.lines[this.currentID++].execute();
        console.log("Execution terminated successfully.");
    }

    createVariableInstance(name, scope = this.scopeDepth) {
      const variable = new Variable(name, scope);
      this.vars.push(variable);
      return variable;
    }

    makeVar(targetToken, asGlobal = false) {
      if(targetToken.name === "me") throw new Errors.RuntimeError(targetToken.ID, `cannot use reserved word "me" as variable name`);
      if(asGlobal && this.scopeDepth === 0) console.warn(`Warning at line ${targetToken.ID} : creating global instance in global scope is redundant`);
      const usedScope = asGlobal ? 0 : this.scopeDepth;
      if(this.vars.filter(v => v.name === targetToken.name && v.depth === usedScope).length) throw new Errors.RuntimeError(targetToken.ID, `a variable named "${targetToken.name}" already exists in this scope`);
      if(targetToken.name in this.stackOps) throw new Errors.RuntimeError(targetToken.ID, `cannot use reserved <stackOperand> word "${targetToken.name}" as variable name`);
      return this.createVariableInstance(targetToken.name, usedScope);
    }

    makeFunc(defProc) {
      if(this.vars.find(v => v.name === defProc.name)) throw new Errors.RuntimeError(defProc.ID, `a declared variable also named "${defProc.name}" conflicts with the creation of this function`);
      if(defProc.name in this.stackOps) throw new Errors.RuntimeError(defProc.ID, `cannot use reserved <stackOperand> word "${defProc.name}" as function name`);
      if(defProc.name === "me") throw new Errors.RuntimeError(defProc.ID, `cannot use reserved word "me" as function name`);
      defProc.depth = this.scopeDepth;
      this.vars.push(defProc);
    }

    searchVar(targetToken) {
      const sameName = this.vars.filter(v => v.name === targetToken.name);
      if(!sameName.length) throw new Errors.RuntimeError(targetToken.ID, `cannot get unknown item "${targetToken.name}"`); 
      if(sameName.filter(v => v instanceof ProcClasses.DefProc).length) throw new Errors.RuntimeError(targetToken.ID, `function "${targetToken.name}" was addressed as if it was a variable`);
      return sameName.reduce((acc, v) => v.depth > acc.depth ? v : acc);
    }

    searchFunc(name, callID) {
      const func = this.vars.filter( v => v.name === name && v instanceof ProcClasses.DefProc);
      if(!func.length) throw new Errors.RuntimeError(callID, `cannot get unknown function item "${name}"`);
      return func[0];
    }

    removeVar(targetToken) {
      const variable = this.searchVar(targetToken);
      this.vars.splice(this.vars.indexOf(variable), 1);
    }

    clearLocalDepth() {
      this.vars = this.vars.filter(v => v.depth < this.scopeDepth);
    }
}

class Variable {
  constructor(name, depth) {
    this.name = name;
    this.depth = depth;
    this.value = null;
  }
}