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
        let userInput = this.input.value;
        userInput = userInput.match(/^-?\d+(\.\d+)?/)?.[0] == userInput ? Number(userInput) : userInput;
        this.input.value = "";
        
        if(!this.inputRequested && userInput) this.appendLog(userInput);
        return userInput;
    }

    format(text, firstCall = true) {
        switch(typeof text) {
            case 'string': return this.format_strText(text);
            case 'number': return `${text}`;
            case 'object': return text instanceof Array ? this.format_listText(text, firstCall) : "{...}";
        }
    }

    format_strText(text) {
        let i             = 0
        let isOutside     = true;
        let nestingCount  = 0;
        let formattedText = "";

        while(i < text.length) {
            const textCopy        = text.substring(i);
            const styledTextStart = textCopy.match(/\$<([^>]*)>/);
            const styledTextEnd   = textCopy.match(/<\$>/);

            if(isOutside) {
                if(!styledTextStart) {
                    formattedText += this.format_plainText(textCopy);
                    i = text.length;
                    continue;
                }
                
                isOutside = false;
                nestingCount++;
                formattedText += this.format_plainText(textCopy.substring(0, styledTextStart.index)) + this.parse_styleTag(styledTextStart);
                i += styledTextStart.index + styledTextStart[0].length;
                continue;
            }
            else {
                if(!styledTextEnd) return this.format_plainText(text, true);
                if(styledTextStart?.index < styledTextEnd?.index) {
                    nestingCount++;
                    formattedText += this.format_plainText(textCopy.substring(0, styledTextStart.index)) + this.parse_styleTag(styledTextStart);
                    i += styledTextStart.index + styledTextStart[0].length;
                    continue;
                }
                
                if(!nestingCount) return this.format_plainText(text, true);
                nestingCount--;
                isOutside = !nestingCount;

                formattedText += this.format_plainText(textCopy.substring(0, styledTextEnd.index)) + "</span>"
                i += styledTextEnd.index + 3; // 3 is the length of "<$>"
                continue;
            }
        }
        return isOutside ? `"${formattedText}"` : this.format_plainText(text, true);
    }

    parse_styleTag(styleTag) {
        return `<span style = "${styleTag[1].replace(/"/g, "'")}">`;
    }

    format_plainText(text, firstCall = false) {
        let formattedText = "";
        for(let char of text) {
            switch(char) {
                case "\n" : char = "<br>";   break;
                case " "  : char = "&nbsp;"; break;
                case "<"  : char = "&lt;";   break;
                case ">"  : char = "&gt;";   break;
            }
            formattedText += char;
        }
        return firstCall ? `"${formattedText}"` : formattedText;
    }

    format_listText(text, firstCall = true) {
        return firstCall ? `[${text.map(el => this.format(el, false)).join(", ")}]` :
                           `List(${text.length})`;
    }

    appendLog(text) {
        const original_text = text;
        text = this.format(text);
        
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

    appendErrorLog(text) {
        this.appendLog(`$<color:red; text-decoration:underline;>${text}<$>`);
    }

    appendWarnLog(text) {
        this.appendLog(`$<color:orange; font-style:italic;>Warning: ${text}<$>`);
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