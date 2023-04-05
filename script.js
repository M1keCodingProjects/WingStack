import { GLC } from "./COMPILER/new_compiler.js";
import Editor  from "./EDITOR/editor.js";

const IDE = new Editor();

const [ // re-work, I hate this:
    compileBtn,
    runBtn,
    buildBtn
] = Array.from(document.querySelectorAll("#Code-dropdown > .dropdown-opts > .dropdown-option"));

compileBtn.onclick =_=> {
    const text = IDE.getText(false); // get text, don't save file
    GLC.build(text); // parse text into AST, save expressions
}

runBtn.onclick =_=> {
    GLC.run();
}

buildBtn.onclick =_=> {
    const text = IDE.getText(false);
    GLC.build_and_run(text);
};

/* old code:
import { loadFile } from "./FILES/file loader.js";

const preloadedModuleList = {
    "basic stack ops"   : (await(await fetch(`./FILES/basic stack ops.GL`)).text()).split("\r").join(""),
    "std GLib"          : (await(await fetch(`./FILES/std GLib.GL`)).text()).split("\r").join(""),
    "std GList"         : (await(await fetch(`./FILES/std GList.GL`)).text()).split("\r").join(""),
    "Vector2D"          : (await(await fetch(`./FILES/Vector2D.GL`)).text()).split("\r").join(""),
};
const usedFilePath = "EXAMPLES/presentation";
*/

import FileManager from './FILES/fileManager.js';
const fileManager = new FileManager();

//GUI Buttons setup
const [saveFileBtn, saveFileAsBtn, openFileBtn] = Array.from(document.querySelectorAll("#File-dropdown > .dropdown-opts > .dropdown-option"));

openFileBtn.onclick = async _=> {
    await fileManager.openFile();
    const [fileName, fileContents] = await fileManager.readFile();
    IDE.loadText(fileName, fileContents);
};

saveFileBtn.onclick = async _=> {
    await fileManager.saveFile(IDE.getText());
};

saveFileAsBtn.onclick = async _=> {
    await fileManager.saveFileAs(IDE.getText());
};