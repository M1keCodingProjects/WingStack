import tokenize from "../COMPILER/PARSING/tokenizer.js";
import Console  from './console.js';
const GUIfileTab = document.querySelector(".openFilesContainer .fileName");

import iota from "../../UTILS/general.js";
const HIGHLIGHT_COLORS = {
    "comment"    : iota(),
    "str"        : iota(),
    "num"        : iota(),
    "keyword"    : iota(),
    "stackOp"    : iota(),
    "errorClass" : iota(),
    "instance"   : iota(),
};

export default class Editor {
    constructor() {
       [this.textTarget,
        this.textContainer,
        this.lineCounter ] = document.querySelectorAll(".editorContainer > .shownEditor, .editor, .lineCounter");
        this.console       = new Console();
        this.fileIsSaved   = false;
        this.currentLineID = 0;

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

    onkeydown(event) {
        switch(event.key) {
            case "Enter" : this.startNewline(event); break;
            case "Tab" : this.insertTab(event); break;
            case "ArrowDown":
            case "ArrowUp":
            case "ArrowRight":
            case "ArrowLeft":
                this.updateCurrentLine(event); break;
        }
    }

    _getCurrentLine(event, cursorPos) {
        return event.target.value.substring(0, cursorPos).split("\n").pop();
    }

    _addTextManuallyAfterPointerPos(event, cursorPos, textToAdd) {
        event.target.value = event.target.value.substring(0, cursorPos) + textToAdd + event.target.value.substring(cursorPos);
    }

    _manuallySetPointerPos(event, newCursorPos) {
        event.target.selectionStart = newCursorPos;
        event.target.selectionEnd   = newCursorPos;
    }

    startNewline(event) {
        const oldCursorPos = event.target.selectionStart;
        const currentLine  = this._getCurrentLine(event, oldCursorPos);
        const newLineTrail = currentLine.match(/^ */)[0] + " ".repeat(2 * (event.target.value[oldCursorPos - 1] == "{")); 
        this._addTextManuallyAfterPointerPos(event, oldCursorPos, `\n${newLineTrail}`);
        this._manuallySetPointerPos(event, oldCursorPos + 1 + newLineTrail.length);
        this.updateText(event);
        event.preventDefault();
    }

    insertTab(event) {
        const oldCursorPos = event.target.selectionStart;
        this._addTextManuallyAfterPointerPos(event, oldCursorPos, "  ");
        this.updateText(event);
        this._manuallySetPointerPos(event, oldCursorPos + 2);
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
        this.textTarget.innerHTML = this.highlight(event.target.value);
        this.updateSaveState(false);
        this.updateLineCounter(event);
        if(!event.isMock) this.updateCurrentLine(event);
    }

    replaceCharacters(text) {
        let result = "";
        for(const char of text) {
            switch(char) {
                case "&"  : result += "&amp;";  break;
                case "<"  : result += "&lt;";   break;
                case ">"  : result += "&gt;";   break;
                case " "  : result += "&nbsp;"; break;
                case "\n" : result += "<br>";   break;
                default   : result += char;     break;
            }
        }
        return result;
    }

    highlight(text) {
        const result = [];
        tokenize(text, (match, tokenType, result) => {
            result.push(
                tokenType in HIGHLIGHT_COLORS ?
                `<span style="color : var(--${tokenType}-col);">${match}</span>` :
                this.replaceCharacters(match)
            );
        }, result);
        return result.join("");
    }

    onscroll(event) {
        this.textTarget.scrollLeft = event.target.scrollLeft;
        this.textTarget.scrollTop  = event.target.scrollTop;
        this.lineCounter.scrollTop = event.target.scrollTop;
    }
}