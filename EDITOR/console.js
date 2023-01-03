export default class Console {
    constructor() {
        [this.log, this.input] = document.querySelectorAll("#mainConsole > .console-log, .console-input");
        this.inputRequested = false;
        this.init();
    }

    init() {
        this.input.onkeyup = this.submit.bind(this);
    }

    submit(event) {
        if(event.key != "Enter") return null;
        const userInput = this.input.value;
        this.input.value = "";
        
        if(!this.inputRequested) this.appendLog(userInput);
        return userInput.match(/^-?\d+(\.\d+)?/)?.[0] == userInput ? Number(userInput) : userInput;
    }

    format(text, firstCall = true) {
        switch(typeof text) {
            case 'string': return `"${text}"`;
            case 'number': return `${text}`;
            case 'object': return firstCall ? `[${text.map(el => this.format(el, false)).join(", ")}]` : `[List:${text.length}]`;
        }
    }

    appendLog(text, style) {
        if(text === "") return;
        const original_text = text;
        text = this.format(text).replace(/\n/g, "<br>").replace(/ /g, "&nbsp;");
        switch(style) {
            case "Error" :
                text = `<span style="color:var(--error-col)">${text}</span>`;
                console.clear(); break;
        }
        
        if(original_text == "\\clear") {
            this.clearLog();
            console.clear();
            return;
        }
        this.log.innerHTML += `&gt;&gt;&nbsp;${text}<br>`;
        console.log(original_text);
        this.log.scrollTop  = this.log.scrollHeight;
        this.log.scrollLeft = 0;
    }

    clearLog() {
        this.log.innerHTML = "";
    }

    async requestInput() {
        this.inputRequested = true;
        this.appendLog(`The program requested input: `); 
        return new Promise((resolve) => {
            this.input.onkeyup = (e => {
                const userInput = this.submit(e);
                if(userInput === null || !this.inputRequested) return;
                this.inputRequested = false;
                resolve(userInput);
            }).bind(this);
        })
        .then((result => {
            this.init();
            return result;
        }).bind(this));
    }
}