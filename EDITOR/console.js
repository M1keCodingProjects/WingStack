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
        return userInput;
    }

    appendLog(text, style) {
        if(text == "") return;
        text = text.replace(/\n/g, "<br>").replace(/ /g, "&nbsp;");
        switch(style) {
            case "Error" : text = `<span style="color:var(--error-col)">${text}</span>`; break;
        }
        this.log.innerHTML += `&gt;&gt;&nbsp;${text}<br>`;
        if(text == "\\clear") this.clearLog();
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