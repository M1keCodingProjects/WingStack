import TextEditor from "./TEXT EDITOR/texteditor.js";
import Compiler   from "./COMPILER UTILS/compiler.js";
import { loadFile } from "./FILES & MODULES/file loader.js";

const preloadedModuleList = {
    "basic stack ops"   : (await(await fetch(`./FILES & MODULES/basic stack ops.GL`)).text()).split("\r").join(""),
    "std GLib"          : (await(await fetch(`./FILES & MODULES/std GLib.GL`)).text()).split("\r").join(""),
    //add here all the files you intend to load with the "use" procedure.
};

const usedFilePath = "test";

const GLC = new Compiler(usedFilePath, preloadedModuleList);
const textEditor = new TextEditor(await loadFile(usedFilePath));

document.getElementById("run_button").onclick   = (() => GLC.run(textEditor.printText()));
document.getElementById("print_button").onclick = (() => console.log(textEditor.printText()));
textEditor.begin_draw();

/* What's new:
    Editor:
      improved aesthetics

    Bug fixing:
      fixed bug where functions with no arguments would throw a syntax error upon calling because they require an empty stackExpr
      fixed bug where a compile-time error would make any subsequent runtime throw a "module already loaded" error on used modules because compiler.resetExec() wasn't getting called

    General polish:

*/

/* TODO:
    Utmost priority:
      fix the fucking editor: add scrolling and the custom console
      clean the parser

    Mid priority:
      finish std GLib

    Low priority:
      introduce object syntax support and use it to load modules and apply labels to function names

    Vague ideas:
      
*/