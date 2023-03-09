import Compiler    from "./COMPILER/new_compiler.js";
import FileManager from './FILES/fileManager.js';

//old code
import { loadFile } from "./FILES/file loader.js";

const preloadedModuleList = {
    "basic stack ops"   : (await(await fetch(`./FILES/basic stack ops.GL`)).text()).split("\r").join(""),
    "std GLib"          : (await(await fetch(`./FILES/std GLib.GL`)).text()).split("\r").join(""),
    "std GList"         : (await(await fetch(`./FILES/std GList.GL`)).text()).split("\r").join(""),
    "Vector2D"          : (await(await fetch(`./FILES/Vector2D.GL`)).text()).split("\r").join(""),
};
const usedFilePath = "EXAMPLES/presentation";
//end

const GLC         = new Compiler("debug");
const fileManager = new FileManager();

//GUI Buttons setup
const [saveFileBtn, saveFileAsBtn, openFileBtn] = Array.from(document.querySelectorAll("#File-dropdown > .dropdown-opts > .dropdown-option"));

openFileBtn.onclick = async _=> {
    await fileManager.openFile();
    const [fileName, fileContents] = await fileManager.readFile();
    GLC.editor.loadText(fileName, fileContents);
};

saveFileBtn.onclick = async _=> {
    await fileManager.saveFile(GLC.editor.getText());
};

saveFileAsBtn.onclick = async _=> {
    await fileManager.saveFileAs(GLC.editor.getText());
};


const [compileBtn, runBtn, buildBtn] = Array.from(document.querySelectorAll("#Code-dropdown > .dropdown-opts > .dropdown-option"));

compileBtn.onclick =_=> {
    GLC.compile();
}

runBtn.onclick =_=> {
    GLC.run();
}

buildBtn.onclick =_=> {
    GLC.build();
};