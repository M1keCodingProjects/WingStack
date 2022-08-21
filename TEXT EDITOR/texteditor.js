import styleData  from "./syntaxhighlightingdata.JSON" assert { type : "json" };

const TEXT_SIZE = 20;
const TEXT_SPACING_H   = TEXT_SIZE * 0.7;
const TEXT_SPACING_V   = TEXT_SIZE * 1.3;
const OVERALL_TRANSL_X = TEXT_SIZE * 1.3 + 5;
const OVERALL_TRANSL_Y = TEXT_SIZE * 0.3 + 5;
const CARET_TRANSL_Y   = TEXT_SIZE * 0.0;
const CARET_TRANSL_X   = TEXT_SIZE / -16;

//some of these constants are deprecated due to the new version of the Caret class, yet I decided to use these to get something working.
//Future me will probably fix this

export default class TextEditor {
    constructor(initText = "", canvasWidth = window.innerWidth * 0.99, canvasHeight = window.innerHeight * 0.6, crispScl = 4) {
        this.loadText(initText);
        this.scl = crispScl;
        this.canvas = document.createElement('canvas');
        this.canvas.style.cssText = `width : ${canvasWidth}; height : ${canvasHeight};`;
        this.canvas.innerHTML = "fallback text";
        this.canvas.width = canvasWidth * this.scl;
        this.canvas.height = canvasHeight * this.scl;
        document.getElementById("EditorContainer").appendChild(this.canvas);
        
        this.caret = new Caret(this, CARET_TRANSL_X, CARET_TRANSL_Y);
        
        this.styleFile = this.finalizeData(styleData);
        this.looping = true;
    }

    loadText(initText) {
      this.text = initText.split("\n").map(l => l.split(""));
    }

    finalizeData(jsonData) {
        let finalizedKWData = {};
        Object.assign(finalizedKWData, ...Object.entries(jsonData["keywords"]).map(e => e[1].reduce((a,kw) => ({...a , [kw] : e[0]}),{})));
        jsonData["keywords"] = finalizedKWData;
        return jsonData;
    }

    printText() {
      return this.text.map(l => l.join("")).join("\n").replace("\\n", "\n");
    }

    getRGBA(r, g, b, a = 255) { return b === undefined ? `rgba(${r}, ${r}, ${r}, ${g === undefined ? 255 : g / 255})` : `rgba(${r}, ${g}, ${b}, ${a / 255})`; }

    set_textSize(ctx, size) {
        ctx.font = `bold ${TEXT_SIZE}px monospace`;
    }

    set_textAlign(ctx, alignConstH, alignConstV) {
        ctx.textAlign = alignConstH;
        ctx.textBaseline = alignConstV;
    }

    display_background(ctx) {
        ctx.save();
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.restore();
    }

    display_lineCounter(ctx) {
        ctx.save();
        ctx.translate(5, 0);
        ctx.fillStyle = this.getRGBA(200, 10);
        ctx.fillRect(0, 0, TEXT_SIZE, this.canvas.height);
        ctx.translate(0, OVERALL_TRANSL_Y);
        ctx.fillRect(TEXT_SIZE, this.caret.y * TEXT_SPACING_V - TEXT_SIZE / 15, this.canvas.width, TEXT_SIZE);
        ctx.fillStyle = this.getRGBA(200, 40);
        this.set_textAlign(ctx, "center", "top");
        this.set_textSize(ctx, TEXT_SIZE);
        
        for(let y = 0; y < this.canvas.height / TEXT_SPACING_V; y++) {
            if(y >= this.text.length) break;
            ctx.fillStyle = this.getRGBA(220, 220 - 150 * (this.caret.y == y), 220, 40 + 40 * (this.caret.y == y));
            ctx.fillText("" + y, TEXT_SIZE / 2, y * TEXT_SPACING_V + CARET_TRANSL_Y);
        }
        ctx.restore();
    }

    display_text(ctx) {
        ctx.save();
        let delimiterOpen = false;
        for(let y = 0; y < this.text.length; y++) {
            let lineArr = [...this.text[y]];
            lineArr.push("\n");
            let word = "";
            
            for(let x = 0; x < lineArr.length; x++) {
              let ch = lineArr[x];
              if(ch in this.styleFile["delimiters"] && delimiterOpen == false) delimiterOpen = [ch, x];
              if(delimiterOpen == false) {
                if(ch == " " || ch == "\n") { 
                  if(word != "") this.colorcode_word(ctx, word, x, y);
                  word = "";
                }
                else word += ch;
              }
              else if(x != delimiterOpen[1] && this.styleFile["delimiters"][delimiterOpen[0]].ends.includes(ch)) {
                delimiterOpen = false;
                word = "";
              }
              ctx.fillStyle = delimiterOpen ? this.styleFile["delimiters"][delimiterOpen[0]].color : ch in this.styleFile["delimiters"] ? this.styleFile["delimiters"][ch].color : "rgb(220, 220, 220)";
              if(ch == " ") {
                ctx.fillStyle = "#222";
                ch = "•";
              }
              ctx.fillText(ch, x * TEXT_SPACING_H, y * TEXT_SPACING_V);
            }
        }
        ctx.restore();
    }

    colorcode_word(ctx, word, x, y) {
        if(word in this.styleFile["keywords"]) ctx.fillStyle = this.styleFile["keywords"][word];
        else if(!isNaN(word)) ctx.fillStyle = this.styleFile["numbers"];
        else return;
        word = word.split("");
        for(let i = 0; i < word.length; i++) ctx.fillText(word[i], (x - (word.length - i)) * TEXT_SPACING_H, y * TEXT_SPACING_V);
    }

    display_lineHighlight(ctx, lineID, fromXID, toXID) {
        ctx.save();
        ctx.fillStyle = this.getRGBA(255, 50);
        ctx.fillRect(fromXID * TEXT_SPACING_H, lineID * TEXT_SPACING_V, (toXID - fromXID) * TEXT_SPACING_H, TEXT_SIZE);
        ctx.restore();
    }

    draw(objRef = this) {
        const ctx = objRef.canvas.getContext("2d");
        if(!this.looping) return;
        ctx.save();
        this.display_background(ctx);
        this.display_lineCounter(ctx);
        ctx.translate(OVERALL_TRANSL_X, OVERALL_TRANSL_Y);
        ctx.fillStyle = this.getRGBA(220);
        this.display_text(ctx);
        this.caret.show(ctx);
        ctx.restore();
        window.requestAnimationFrame(this.draw.bind(objRef, this));
    }

    begin_draw() {
        const ctx = this.canvas.getContext("2d");
        ctx.scale(this.scl, this.scl);
        this.set_textAlign(ctx, "left", "top");
        this.set_textSize(ctx, TEXT_SIZE * 0.8);
        this.draw();
    }
}

class Caret {
    constructor(containerElement, textAreaTLx, textAreaTLy) {
      this.NO_BEHAVIOUR = ["Unidentified", "Shift", "Alt", "Control", "AltGraph", "CapsLock", "Escape", "NumLock", "Home", "PageUp", "Clear", "End", "PageDown", "Insert", "Meta"];
      
      this.worldX = textAreaTLx;
      this.worldY = textAreaTLy;
      
      this.y = containerElement.text.length - 1;
      this.x = containerElement.text[this.y].length;
      this.container = containerElement;
      
      this.manage_inputEvents(containerElement.canvas);
      this.calibrate();
    }
    
    overwrite_behaviour(funcName, newCallback) { this[funcName] = newCallback; }
    
    manage_inputEvents(canvasDOM_El) {
        canvasDOM_El.setAttribute("tabindex", 1);
        canvasDOM_El.addEventListener('keydown', this.on_keyWritten_inputEvent.bind(null, this));

        this.mouseDown = false;
        canvasDOM_El.addEventListener('mouseup', (() => this.mouseDown = false).bind(null, this));
        canvasDOM_El.addEventListener('mousedown', ((caretObj, event) => { this.mouseDown = true; this.on_clickDown_inputEvent(caretObj, event); } ).bind(null, this));
        canvasDOM_El.addEventListener('mousemove', ((caretObj, event) => { if(this.mouseDown) this.on_drag_inputEvent(caretObj, event); } ).bind(null, this));
    }
    
    on_clickDown_inputEvent(caretObj, event) {
      caretObj.position_manually(event);
      caretObj.calibrate();
      if(event.detail == 2) caretObj.select_word();
    }
    
    on_drag_inputEvent(caretObj, event) {
        caretObj.make_newSelection(event);
    }

    on_keyWritten_inputEvent(caretObj, event) {
      if(caretObj.NO_BEHAVIOUR.includes(event.key)) return false;
      switch(event.key) {
        case "Enter"      : caretObj.go_newLine(); break;
        case "Backspace"  : caretObj.delete(); break;
        case "Tab"        : caretObj.write(" ");
                            caretObj.write(" "); break;
      
        case "ArrowUp"    : caretObj.go_up(); break;
        case "ArrowLeft"  : caretObj.go_left(); break;
        case "ArrowDown"  : caretObj.go_down(); break;
        case "ArrowRight" : caretObj.go_right(); break;
      
        default           : caretObj.write(event.key); break;
      }

      caretObj.calibrate();
      event.preventDefault();
    }
    
    correct_xUnderflow() { this.x = this.y > 0 ? this.container.text[this.y - 1].length : 0; }
    
    go_up() {
      this.y--;              //could implement "this.oldIndentX" or something, so that it's a bit nicer to use.
      if(this.y < 0) {
        this.y = 0;
        this.x = 0;
      }
      if(this.x > this.container.text[this.y].length) this.x = this.container.text[this.y].length;
    }
    
    go_left() {
      this.x--;
      if(this.x < 0) {
        this.correct_xUnderflow();
        if(this.y > 0) this.y--;
      }
    }
    
    go_down() {
      this.y++;
      if(this.y >= this.container.text.length) {
        this.y = this.container.text.length - 1;
        this.x = this.container.text[this.y].length;
      }
      if(this.x > this.container.text[this.y].length) this.x = this.container.text[this.y].length;
    }
    
    go_right() {
      this.x++;
      if(this.x > this.container.text[this.y].length) {
        if(this.y < this.container.text.length - 1) {
          this.x = 0;
          this.y++;
        }
        else this.x--;
      }
    }
    
    flush() { //UNSAFE:: used only when caret is part of console-type TextEditor textbox, as overwrite for go_newLine
      if(this.selection) this.delete_selection();
      this.container.print(this.container.text.map(l => l.join("")).join(""));
      this.container.text = [[]];
      this.x = 0;
      this.y = 0;
    }
    
    go_newLine() {
      if(this.selection) this.delete_selection();
      let currentLine = this.container.text[this.y];
      let indent = currentLine.join("").search(/[^ ]/);
      indent = " ".repeat(indent >= 0 ? indent : currentLine.length).split("");
      
      if(this.x == currentLine.length) {
        if(this.y == this.container.text.length - 1) this.container.text.push(indent);
        else this.container.text.splice(this.y + 1, 0, indent);
      }
      else {
        let newLineContent = [...indent, ...currentLine.splice(this.x)];
        if(this.y == this.container.text.length) this.container.text.push(newLineContent);
        else this.container.text.splice(this.y + 1, 0, newLineContent);
        this.container.text[this.y] = [...currentLine];
      }
      this.y++;
      this.x = indent.length;
    }
    
    write(letter) {
      if(this.selection) this.delete_selection();
      let currentLine = this.container.text[this.y];
      if(this.x == currentLine.length) this.container.text[this.y].push(letter);
      else this.container.text[this.y].splice(this.x, 0, letter);
      this.x++;
    }
    
    delete_selection() {
      let start, end;
      if(this.selection.start[1] < this.selection.end[1]) {
        start = this.selection.start;
        end = this.selection.end;
      }
      else {
        start = this.selection.end;
        end = this.selection.start;
      }
      
      if(start[1] == end[1]) {
        if(start[0] > end[0]) [start[0], end[0]] = [end[0], start[0]];
        this.container.text[start[1]].splice(start[0], end[0] - start[0] - 1);
      }
      else {
        this.container.text[end[1]].splice(0, end[0]);
        if(this.selection.IDs.length) this.container.text = this.container.text.filter((l,i) => !this.selection.IDs.includes(i));
        this.container.text[start[1]].splice(start[0]);
      }
      
      this.y = start[1];
      this.x = start[0];
      this.selection = false;
      this.go_right();
      this.delete();
    }
    
    delete() {
      if(this.selection) this.delete_selection();
      else {
        let currentLine = this.container.text[this.y];
        if(this.x == currentLine.length) this.container.text[this.y].pop();
        else if(this.x > 0) this.container.text[this.y].splice(this.x - 1, 1);
        this.x--;
        if(this.x < 0) {
          this.correct_xUnderflow();
          if(this.y > 0) {
            let nextLine = this.container.text.splice(this.y, 1)[0];
            this.y--;
            if(nextLine.length) this.container.text[this.y].push(...nextLine);
          }
        }
      }
    }
    
    worldCoords_toCaretCoords(x, y) {
      let rect = this.container.canvas.getBoundingClientRect();
      return [Math.round((x - rect.left - this.worldX - OVERALL_TRANSL_X) / TEXT_SPACING_H),
              Math.floor((y - rect.top  - this.worldY - OVERALL_TRANSL_Y) / TEXT_SPACING_V)
             ];
    }
    
    get_worldCoords() {
      let rect = this.container.canvas.getBoundingClientRect();
      return [this.x * TEXT_SPACING_H + this.worldX + OVERALL_TRANSL_X + rect.left, this.y * TEXT_SPACING_V + this.worldY + OVERALL_TRANSL_Y + rect.top/* + verticalScroll*/];
    }
    
    position_manually(event) {
      let [worldX, worldY] = this.worldCoords_toCaretCoords(event.clientX, event.clientY);
      let x = worldX;
      let y = worldY;
      if(this.container.text.length <= y || y < 0) return;
      this.y = y;
      if(x < 0) return;
      this.x = x;
      if(this.x > this.container.text[this.y].length) this.x = this.container.text[this.y].length;
    }
    
    select_word() {
      let wordStart, wordEnd;
      let currentLine = this.container.text[this.y];
      let i = this.x;
      
      if(currentLine[i] == " ") i--;
      if(currentLine[i] == " ") return;
      while(currentLine[i] != " " && i >= 0) i--;
      wordStart = i + 1;
      i = this.x;
      while(currentLine[i] != " " && i < currentLine.length) i++;
      wordEnd = i; 
      
      this.selection = {
        start: [wordStart, this.y],
        IDs  : [],
        end  : [wordEnd, this.y]
      };
    }
    
    calibrate() {
      this.animationBuffer = 1;
      this.flickerAnimation = Math.PI / 2; //makes the caret bright on release
      this.selection = false;
    }
    
    make_newSelection(event) {
      let [worldX, worldY] = this.get_worldCoords();
      let w = Math.round((event.clientX - worldX) / TEXT_SPACING_H);
      let h = Math.floor((event.clientY - worldY) / TEXT_SPACING_V);
  
      if(h < -this.y) h = -this.y;
      if(h >= this.container.text.length - this.y) h = this.container.text.length - this.y - 1;
      if(w < -this.x) w = -this.x;
      if(w > this.container.text[this.y + h].length - this.x) w = this.container.text[this.y + h].length - this.x;
  
      if(!h) {
        this.selection = w ? {
          start: [this.x, this.y],
          IDs  : [],
          end  : [this.x + w, this.y]
        } : false;
        return;
      }
      
      let yIDs = [...Array(Math.abs(h))].map((e,i) => this.y + (Math.abs(h) - i) * sign(h));
      yIDs.shift();
      
      this.selection = {
        start: [this.x, this.y],
        IDs  : [...yIDs],
        end  : [this.x + w, this.y + h]
      };
    }
    
    show_selection(ctx) {
      let startX = this.selection.start[0];
      let startY = this.selection.start[1];
      let endX   = this.selection.end[0];
      let endY   = this.selection.end[1];
      let h = endY - startY;
        
      this.container.display_lineHighlight(ctx, startY, startX, h ? h > 0 ? this.container.text[startY].length : 0 : endX);
      if(!h) return;
      for(let y of this.selection.IDs) this.container.display_lineHighlight(ctx, y, 0, this.container.text[y].length);
      this.container.display_lineHighlight(ctx, endY, h > 0 ? 0 : endX, h > 0 ? endX : this.container.text[endY].length);
    }
    
    show(ctx) {
      this.animationBuffer -= 0.05;
      this.flickerAnimation += 0.1;
      if(this.animationBuffer < 0) this.animationBuffer = 0;
      if(this.selection) this.show_selection(ctx);
      ctx.save();
      this.container.set_textAlign(ctx, "center", "top");
      this.container.set_textSize(ctx, TEXT_SIZE);
      if(!this.animationBuffer) ctx.fillStyle = this.container.getRGBA(220, 255 * (Math.sin(this.flickerAnimation) > 0));
      ctx.translate(this.x * TEXT_SPACING_H + this.worldX, this.y * TEXT_SPACING_V + this.worldY);
      ctx.fillText("|", 0, 0);
      ctx.restore();
    }
}

const sign = (n) => n ? n / Math.abs(n) : 0;