const enumerate = (...keys) => keys.reduce((acc, key, i) => ({...acc, [key] : i}), {});
const STYLED_TEXT_STATE = enumerate("INSIDE_STYLEDEF", "INSIDE_STYLED_TEXT", "OUTSIDE");

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
            case 'string': return text.indexOf("$(") >= 0 ? this.format_styledStr(text) : this.format_strText(text);
            case 'number': return `${text}`;
            case 'object': return text instanceof Array ? this.format_listText(text, firstCall) : "{...}";
        }
    }

    format_styledStr(text) {
        let i = 0
        let formattedText = "";
        let position = STYLED_TEXT_STATE.OUTSIDE;

        while(i < text.length) {
            const textCopy = text.substring(i);
            //console.log(textCopy, formattedText, i, position);
            switch(position) {
                case STYLED_TEXT_STATE.INSIDE_STYLEDEF: {
                    const parsedStyleObj = this.parse_styleDefinition(textCopy);
                    if(!parsedStyleObj) return this.format_strText(text);
                    formattedText += "<span style = '";
                    if(parsedStyleObj.color)  formattedText += `color : ${parsedStyleObj.color};`;
                    if(parsedStyleObj.bold)   formattedText += `font-weight : bold;`;
                    if(parsedStyleObj.italic) formattedText += `font-style : italic;`;
                    formattedText += "'>";
                    position = STYLED_TEXT_STATE.INSIDE_STYLED_TEXT;
                    i += parsedStyleObj.len;
                    break;
                }

                case STYLED_TEXT_STATE.INSIDE_STYLED_TEXT: {
                    const styleDefEnd = textCopy.match(/\$[^\(]?/);
                    if(!styleDefEnd) return this.format_strText(text);
                    formattedText += `${
                        this.format_strText(textCopy.substr(0, styleDefEnd.index), false)
                    }</span>`;
                    position = STYLED_TEXT_STATE.OUTSIDE;
                    i += styleDefEnd.index + 1;
                    break;
                }

                case STYLED_TEXT_STATE.OUTSIDE : {
                    const styleDefStart = textCopy.match(/\$\(/);
                    formattedText += this.format_strText(textCopy.substr(0, styleDefStart?.index), false);
                    position = STYLED_TEXT_STATE.INSIDE_STYLEDEF;
                    i += styleDefStart ? styleDefStart.index + 2 : text.length;
                    break;
                }
            }
        }

        return formattedText;
    }

    parse_styleDefinition(text) {
        const currentStyle = {
            bold   : false,
            italic : false,
            color  : "",
            len    : 1,
        };
        
        for(let i = 0; i < 3; i++) {
            const styleWord = text.match(/^(#[0-9a-f]{6}|bold|italic)/)?.[0];

            if(!styleWord || currentStyle[styleWord]) return; // invalid style or already set
            if(styleWord[0] != "#") currentStyle[styleWord] = true;
            else if(currentStyle.color) return; // color already set
            else currentStyle.color = styleWord;
            
            text = text.substring(styleWord.length);
            currentStyle.len += styleWord.length;

            const separatorLen = text.match(/^, */)?.[0]?.length || 0;
            text = text.substring(separatorLen);
            currentStyle.len += separatorLen;

            if(text[0] == ")") return currentStyle; // having a separator at the end is fine!
            if(!separatorLen) return; // if no separator is found after a styleWord and the styleDefinition doesn't end, it's a mistake.
        }
        
        if(text[0] == ")") return currentStyle;
    }

    format_strText(text, addQuotes = true) {
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

        return addQuotes ? `"${formattedText}"` : formattedText;
    }

    format_listText(text, firstCall = true) {
        return firstCall ? `[${text.map(el => this.format(el, false)).join(", ")}]` :
                           `[List:${text.length}]`;
    }

    appendLog(text, style) {
        const original_text = text;
        text = this.format(text);
        switch(style) {
            case "Error" : {
                text = `<span style="color:var(--error-col)">${text}</span>`;
                console.clear();
                break;
            }
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