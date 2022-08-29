import TextEditor from "./TEXT EDITOR/texteditor.js";
import Compiler   from "./COMPILER UTILS/compiler.js";
import { loadFile } from "./FILES & MODULES/file loader.js";

const preloadedModuleList = {
    "basic stack ops"   : (await(await fetch(`./FILES & MODULES/basic stack ops.GL`)).text()).split("\r").join(""),
    "std GLib"          : (await(await fetch(`./FILES & MODULES/std GLib.GL`)).text()).split("\r").join(""),
    "Vector2D"          : (await(await fetch(`./FILES & MODULES/Vector2D.GL`)).text()).split("\r").join(""),
    //add here all the files you intend to load with the "use" procedure.
};

const printAction = () => {
  console.clear();
  console.log(textEditor.printText());
}

const usedFilePath = "test"; //"EXAMPLES/presentation";

const GLC = new Compiler(usedFilePath, preloadedModuleList);
const textEditor = new TextEditor(await loadFile(usedFilePath));

document.getElementById("run_button").onclick   = (() => GLC.run(textEditor.printText()));
document.getElementById("print_button").onclick = printAction;
textEditor.begin_draw();

/* TODO:
    Utmost priority:
      use object syntax to load modules and apply labels to function names

    Mid priority:
      finish std GLib
      fix the fucking editor: add manual scrolling

    Low priority:
      

    Vague ideas:
      
*/