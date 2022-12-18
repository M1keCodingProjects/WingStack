const GUIfileTab = document.querySelector("#GUI .openFilesContainer .fileName");

export default class Editor {
    constructor(cconsole) {
       [this.textTarget,
        this.textContainer,
        this.lineCounter ] = document.querySelectorAll(".editorContainer > .shownEditor, .editor, .lineCounter");
        this.console       = cconsole;
        this.fileIsSaved   = false;

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
            [/^\=/, "="],
            [/^,/, ","],
            [/^\./, "."],
            [/^\:/, ":"],
            [/^\|/, "|"],
            [/^\"[^\"\n]*\"/, "str"],
            [/^-?\d+(\.\d+)?/, "num"],
            [/^(print|make|macro|expand|loop|when|else|fun|exit|next|typenum|use)[^\w]/, "keyword"],
            [/^(with|global|dynamic|class|then)[^\w]/, "specifier"],
            [/^(me)[^\w]/, "me"],
            [/^(rot\<|rot\>|dup|drop|num|str|list|obj|many|void|pack|spill|swap|over|and|or|not|type|size|pop|inp)[^\w]/, "stackOp"],
            [/^(\>|\+|\-|\*|\/)/, "op"],
            [/^\@\w+/, "iterator"],
            [/^-?[a-zA-Z_]\w*/, "WORD"],
            [/^[^ ]+ */, "any"],
        ];

        this.colors = ["comment", "str", "num", "keyword", "stackOp", "me", "iterator", "specifier"];

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
        const mockEvent = {target : {value : this.textContainer.value}};
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

    onkeydown(event) {
        switch(event.key) {
            case "Tab" : this.insertTab(event); break;
            //...
        }
        this.updateCurrentLine(event);
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

    updateCurrentLine(event) {
        let cursorPos = event.target.selectionStart;
        switch(event.key) {
            case "ArrowRight" : cursorPos++; break;
            case "ArrowLeft"  : cursorPos--; break;
            case "ArrowUp"    : cursorPos -= event.target.value.substring(0, event.target.selectionStart).split("\n").pop().length + 1; break;
            case "ArrowDown"  : cursorPos += event.target.value.substring(event.target.selectionStart).split("\n").shift().length + 1;  break;
        }
        this.textTarget.style.setProperty("--current-line-ID", event.target.value.substring(0, cursorPos).split("\n").length);
    }

    updateText(event) {
        this.textTarget.innerHTML = this.highlight(event.target.value + " ");
        this.updateSaveState(false);
        this.updateLineCounter(event);
        this.updateCurrentLine(event);
    }

    highlight(text) {
        let result = "";
        let cursor = 0;
        while(cursor < text.length) {
            let stream = text.substring(cursor);
            const oldCursor = cursor;    
            for(let [regExp, tokenType] of this.tokenPatterns) {
                let match = stream.match(regExp);
                if(match === null) continue;
                match = match[1 * (match[1] != undefined && tokenType !== "num")];
                cursor += match.length;
                match = match.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>").replace(/ /g, "&nbsp;").replace(/\-/g, "&#8209;");
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