import { GLC } from "./COMPILER/new_compiler.js";
import { IDE } from "./EDITOR/editor.js";

const [ // re-work, I hate this:
    compileBtn,
    runBtn,
    buildBtn
] = document.querySelector("#editor-container #circle-btns-container").children;

compileBtn.onclick = async _=> {
    const text = IDE.getText(false); // get text, don't save file
    GLC.build(text); // parse text into AST, save expressions
}

runBtn.onclick = async _=> {
    GLC.run(true);
}

buildBtn.onclick = async _=> {
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
const [saveFileBtn, saveFileAsBtn, openFileBtn] = document.querySelector("#File-dropdown .dropdown-opts").children;

openFileBtn.onclick = async _=> {
    await fileManager.openFile();
    const [fileName, fileContents] = await fileManager.readFile();
    IDE.loadText(fileName, fileContents);
};

saveFileBtn.onclick = async _=> {
    await fileManager.saveFile(IDE.getText());
};

saveFileAsBtn.onclick = async _=> {
    const fileName = await fileManager.saveFileAs(IDE.getText());
    IDE.updateFileName(fileName);
};