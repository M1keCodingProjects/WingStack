import Console     from './EDITOR/console.js';
import Editor      from './EDITOR/editor.js';
import FileManager from './FILES/fileManager.js';

import Compiler   from "./COMPILER UTILS/compiler.js";
import { loadFile } from "./FILES/file loader.js";

const preloadedModuleList = {
    "basic stack ops"   : (await(await fetch(`./FILES/basic stack ops.GL`)).text()).split("\r").join(""),
    "std GLib"          : (await(await fetch(`./FILES/std GLib.GL`)).text()).split("\r").join(""),
    "std GList"         : (await(await fetch(`./FILES/std GList.GL`)).text()).split("\r").join(""),
    "Vector2D"          : (await(await fetch(`./FILES/Vector2D.GL`)).text()).split("\r").join(""),
};
const usedFilePath = "EXAMPLES/presentation";

const GLC = new Compiler(usedFilePath, preloadedModuleList);

const cconsole    = new Console();
const editor      = new Editor(cconsole);
const fileManager = new FileManager();

//GUI Buttons setup
const openFileBtn   = document.getElementById("Open");
const saveFileBtn   = document.getElementById("Save");
const saveFileAsBtn = document.getElementById("SaveAs");

openFileBtn.onclick = async _=> {
    await fileManager.openFile();
    const [fileName, fileContents] = await fileManager.readFile();
    editor.loadText(fileName, fileContents);
};

saveFileBtn.onclick = async _=> {
    await fileManager.saveFile(editor.getText());
};

saveFileAsBtn.onclick = async _=> {
    await fileManager.saveFileAs(editor.getText());
};