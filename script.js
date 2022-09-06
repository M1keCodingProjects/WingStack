import TextEditor from "./TEXT EDITOR/texteditor.js";
import Compiler   from "./COMPILER UTILS/compiler.js";
import { loadFile } from "./FILES & MODULES/file loader.js";

const preloadedModuleList = {
    "basic stack ops"   : (await(await fetch(`./FILES & MODULES/basic stack ops.GL`)).text()).split("\r").join(""),
    "std GLib"          : (await(await fetch(`./FILES & MODULES/std GLib.GL`)).text()).split("\r").join(""),
    "std GList"         : (await(await fetch(`./FILES & MODULES/std GList.GL`)).text()).split("\r").join(""),
    "Vector2D"          : (await(await fetch(`./FILES & MODULES/Vector2D.GL`)).text()).split("\r").join(""),
    //add here all the files you intend to load with the "use" procedure.
};

const usedFilePath = "EXAMPLES/presentation";

const GLC = new Compiler(usedFilePath, preloadedModuleList);
const textEditor = new TextEditor(await loadFile(usedFilePath));

document.getElementById("run_button").onclick   = (() => GLC.run(textEditor.printText()));
document.getElementById("print_button").onclick = (() => {
  console.clear();
  console.log(textEditor.printText());
});

textEditor.begin_draw();

console.log(textEditor.styleFile);
const allSnippets    = Array.from(document.getElementsByClassName("codeSnippet"));
const wordDelimiters = [" ", ".", "[", "\n"];

const coerceChar = (char) => char == "\n" ? "<br>" : char;

for(const snippet of allSnippets) {
  const text = snippet.firstChild.innerHTML.replace(/<br>/g, "\n");
  snippet.innerHTML = "";
  let word = "";
  let insideDelimiter = false;

  for(const char of text.split("")) {
    if(insideDelimiter) {
      if(insideDelimiter.ends.includes(char)) {
        snippet.innerHTML += `<font color="${insideDelimiter.color}">${word + coerceChar(char)}</font>`;
        word = "";
        insideDelimiter = false;
        continue;
      }
    }
    else {
      if(char in textEditor.styleFile.delimiters) insideDelimiter = textEditor.styleFile.delimiters[char];
      if(wordDelimiters.includes(char)) {
        if(word in textEditor.styleFile.keywords) snippet.innerHTML += `<font color="${textEditor.styleFile.keywords[word]}">${word}</font>`;
        else if(word.replace(/\s/g, "").length && !isNaN(word)) snippet.innerHTML += `<font color="${textEditor.styleFile.numbers}">${word}</font>`;
        else snippet.innerHTML += word;
        word = "";
        snippet.innerHTML += coerceChar(char);
        continue;
      }
    }
    word += char;
  }
}

/* TODO:
    Utmost priority:
      See if anything can be done for the way replace procedures "work"

    Mid priority:
      fix the fucking editor: add manual scrolling

    Low priority:
      finish std GLib

    Vague ideas:
      
*/