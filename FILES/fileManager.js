export default class FileManager {
    constructor() {
        this.fileHandle = null;
    }

    async openFile() {
        [this.fileHandle] = await window.showOpenFilePicker({
            multiple: false,
            excludeAcceptAllOption: true,
            types: [{ accept: { "text/plain" : [".wing"] } }],
        });
    }

    async readFile() {
        const fileObj      = await this.fileHandle.getFile();
        const fileContents = await fileObj.text();
        return [fileObj.name, fileContents];
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
        return await this.fileHandle.getFile().name;
    }
}