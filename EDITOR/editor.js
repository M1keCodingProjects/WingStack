import Console from './console.js';
const GUIfileTab = document.querySelector("#GUI .openFilesContainer .fileName");

export default class Editor {
    constructor() {
       [this.textTarget,
        this.textContainer,
        this.lineCounter ] = document.querySelectorAll(".editorContainer > .shownEditor, .editor, .lineCounter");
        this.console       = new Console();
        this.fileIsSaved   = false;
        this.currentLineID = 0;
        this.tokens        = [];

        this.tokenPatterns = [
            [/^ +/, "space"],
            [/^#.*/, "comment"],
            [/^\n+/, "EOL"],
            [/^\{\n*/, "{"],
            [/^\}/, "}"],
            [/^\[/, "["],
            [/^\]/, "]"],
            [/^\(/, "("],
            [/^\)/, ")"],
            [/^\=\>/, "=>"],
            [/^\=/, "="],
            [/^,/, ","],
            [/^\./, "."],
            [/^\:/, ":"],
            [/^\|/, "|"],
            [/^\"[^\"\n]*\"?/, "str"],
            [/^-?\d+(\.\d+)?/, "num"],
            [/^(print|make|macro|expand|loop|when|else|free|fun|exit|next|typenum|use)[^\w]/, "keyword"],
            [/^(with|global|dynamic|class|frozen|then)[^\w]/, "specifier"],
            [/^(PI|INF)/, "constant"],
            [/^(me|origin)[^\w]/, "instance"],
            [/^(rot\<|rot\>|dup|drop|num|int|float|str|list|obj|void|spill|swap|over|and|or|not|type|size|pop|inp)[^\w]/, "stackOp"],
            [/^(\>|\<|\+|\-|\*|\/)/, "op"],
            [/^((Type|Property|Value)?Error)/, "errorClass"],
            [/^-?[a-zA-Z_]\w*/, "WORD"],
            [/^[^ ]+ */, "any"],
        ];

        this.colors = ["comment", "str", "num", "constant", "keyword", "stackOp", "instance", "errorClass", "specifier"];

        this.charSubstitutions = {
            "&"  : "&amp;",
            "<"  : "&lt;",
            ">"  : "&gt;",
            " "  : "&nbsp;",
            "\n" : "<br>",
        };

        this.init();
    }

    init() {
        this.textContainer.onkeydown = this.onkeydown.bind(this);
        this.textContainer.oninput   = this.updateText.bind(this);
        this.textContainer.onscroll  = this.onscroll.bind(this);
        this.textContainer.onmouseup = this.updateCurrentLine.bind(this);
        this.updateBaseline();
    }

    updateBaseline() {
        const mockEvent = {target : {value : this.textContainer.value}, isMock : true};
        this.updateText(mockEvent);
    }

    updateSaveState(fileIsSaved) {
        if(fileIsSaved == this.fileIsSaved) return;
        if(fileIsSaved) GUIfileTab.setAttribute("saved", "");
        else GUIfileTab.removeAttribute("saved");
        this.fileIsSaved = fileIsSaved;
    }

    updateFileName(fileName) {
        GUIfileTab.innerHTML = fileName;
    }

    loadText(fileName, text) {
        this.textContainer.value = text.replace(/\t/g, "  ");
        this.updateBaseline();
        this.updateFileName(fileName);
        this.updateSaveState(true);
    }

    getText() {
        this.updateSaveState(true);
        return this.textContainer.value;
    }

    sendTokens() {
        if(this.tokens[this.tokens.length - 1]?.type == "space") this.tokens.pop();
        return [
            { type : "{", value : "{" },
            ...this.tokens.map(token => ({...token})),
            { type : "}", value : "}" },
        ];
    }

    onkeydown(event) {
        switch(event.key) {
            case "Tab" : this.insertTab(event); break;
            case "ArrowDown":
            case "ArrowUp":
            case "ArrowRight":
            case "ArrowLeft":
                this.updateCurrentLine(event); break;
        }
    }

    insertTab(event) {
        const oldCursorPos = event.target.selectionStart;
        event.target.value = event.target.value.substring(0, oldCursorPos) + "  " + event.target.value.substring(oldCursorPos);
        this.updateText(event);
        event.target.selectionStart = oldCursorPos + 2;
        event.target.selectionEnd   = oldCursorPos + 2;
        event.preventDefault();
    }

    updateLineCounter(event) {
        const linesAmt = event.target.value.split("\n").length;
        if(linesAmt != this.lineCounter.childElementCount) this.lineCounter.innerHTML = Array(linesAmt).fill("<span></span>").join("");
    }

    updateCurrentLine(event) { // DO NOT TOUCH THIS!! It's magic and cannot be changed.
        let cursorPos = event.target.selectionStart;
        switch(event.key) {
            case "ArrowRight" : cursorPos++; break;
            case "ArrowLeft"  : cursorPos--; break;
            case "ArrowUp"    : cursorPos -= event.target.value.substring(0, event.target.selectionStart).split("\n").pop().length + 1; break;
            case "ArrowDown"  : cursorPos += event.target.value.substring(event.target.selectionStart).split("\n").shift().length  + 1; break;
            case "Tab"        : return;
        }
        this.currentLineID = event.target.value.substring(0, cursorPos).split("\n").length;
        this.textTarget.style.setProperty("--current-line-ID", this.currentLineID);
    }

    updateText(event) {
        this.textTarget.innerHTML = this.highlight(event.target.value + " ");
        this.updateSaveState(false);
        this.updateLineCounter(event);
        if(!event.isMock) this.updateCurrentLine(event);
    }

    highlight(text) {
        let result = "";
        let cursor = 0;
        this.tokens = [];
        while(cursor < text.length) {
            let stream = text.substring(cursor);
            const oldCursor = cursor;
            for(let [regExp, tokenType] of this.tokenPatterns) {
                let match = stream.match(regExp);
                if(match === null) continue;
                match = match[1 * (match[1] != undefined && tokenType !== "num")];
                cursor += match.length;
                
                this.tokens.push({
                    type  : tokenType == "op" ? "stackOp" : tokenType,
                    value : tokenType == "num" ? Number(match) : match,
                });

                let temp = "";
                for(const char of match) {
                    temp += char in this.charSubstitutions ? this.charSubstitutions[char] : char;
                }
                match = temp;

                if(match == "FALSE" || match == "TRUE") tokenType = "constant";
                result += this.colors.includes(tokenType) ? `<span style="color : var(--${tokenType}-col);">${match}</span>` : match;
                break;
            }
            if(oldCursor == cursor) throw new Error("Something went really wrong here!");
        }
        return result;
    }

    onscroll(event) {
        this.textTarget.scrollLeft = event.target.scrollLeft;
        this.textTarget.scrollTop  = event.target.scrollTop;
        this.lineCounter.scrollTop = event.target.scrollTop;
    }
}