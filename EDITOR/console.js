export default class Console {
    constructor() {
        [this.log, this.input] = document.querySelectorAll("#mainConsole > .console-log, .console-input");
        this.inputRequested = false;
        this.savedInputResponse = "";
        this.init();
    }

    init() {
        this.input.onkeyup = this.submit.bind(this);
    }

    submit(event) {
        if(event.key != "Enter") return;

        let newLog = this.input.value;
        if(this.inputRequested) {
            this.savedInputResponse = newLog;
            this.inputRequested = false;
            newLog = "The User responded with: " + newLog;
        }
        
        this.appendLog(newLog);
        this.input.value = "";
    }

    appendLog(text) {
        if(text == "") return;
        text = text.replace(/\n/g, "<br>").replace(/ /g, "&nbsp;");
        this.log.innerHTML += `&gt;&gt;&nbsp;${text}<br>`;
        if(text == "\\clear") this.clearLog();
        this.log.scrollTop  = this.log.scrollHeight;
        this.log.scrollLeft = 0;
    }

    clearLog() {
        this.log.innerHTML = "";
    }

    requestInput(callback, ...args) {
        this.inputRequested = true;
        this.appendLog(`The program requested input: `);    
        waitForResponse.call(this);

        function waitForResponse() {
            if(this.inputRequested) return setTimeout(waitForResponse.bind(this), 0);
            const response = this.savedInputResponse;
            this.savedInputResponse = "";
            callback(...args, response);
        }
    }
}