export default class FileManager {
    constructor() {
        this.fileHandle = null;
    }

    async openFile() {
        [this.fileHandle] = await window.showOpenFilePicker({
            multiple: false,
            excludeAcceptAllOption: true,
            types: [{ accept: { "text/plain" : [".GL"] } }],
        });
    }

    async readFile() {
        const fileObj      = await this.fileHandle.getFile();
        const fileName     = fileObj.name.slice(0, -3);
        const fileContents = await fileObj.text();
        return [fileName, fileContents];
    }

    async saveFile(data) {
        if(!this.fileHandle) await this.openFile();
        let writableStream = await this.fileHandle.createWritable();
        await writableStream.write(data);
        await writableStream.close();
    }

    async saveFileAs(data) {
        this.fileHandle = await window.showSaveFilePicker();
        this.saveFile(data);
    }
}