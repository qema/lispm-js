function LispM(opt) {
  this.terminal = new Terminal(opt);
  this.display = this.terminal.view;

  this.running = false;
  this.terminal.ready = function() {
    this.running = true;
    var replIter;
    replIter = function() {
      this.printString("> ");
      this.input(function(s) {
	this.printString("Output: " + s + "\n");
	replIter();
      }.bind(this));
    }.bind(this)
    replIter();
  }.bind(this);

  var curX = 0, curY = 0;
  this.printString = function(s, fg, bg) {
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i);
      if (c == "\n") {
	this.cursorNewline();
      } else {
        this.terminal.putChar(curX, curY, c, fg, bg);
	this.cursorForward();
      }
    }
  };

  this.cursorNewline = function() {
    curX = 0;
    curY++;
    if (curY >= this.terminal.height) {
      this.scroll();
    }
  };

  this.cursorForward = function() {
    curX++;
    if (curX >= this.terminal.width) {
      curX = 0;
      curY++;
    }
    if (curY >= this.terminal.height) {
      this.scroll();
    }
  };

  this.scroll = function() {
    curY--;
    lastY--;
    for (var y = 1; y < this.terminal.height; y++) {
      for (var x = 0; x < this.terminal.width; x++) {
	var c = this.terminal.getChar(x, y);
	var fg = this.terminal.getCharFG(x, y);
	var bg = this.terminal.getCharBG(x, y);
	this.terminal.putChar(x, y - 1, c, fg, bg);
      }
    }
    for (var x = 0; x < this.terminal.width; x++) {
      this.terminal.putChar(x, this.terminal.height - 1, 0);
    }
  };

  this.cursorBackward = function() {
    curX--;
    if (curX < 0) {
      curX = this.terminal.width - 1;
      if (curY > 0) {
        curY--;
      }
    }
  };
  
  this.moveCursor = function(x, y) {
    curX = x;
    curY = y;
  };

  this.showCursor = false;
  this.input = function(callback, fg, bg) {
    var getchLoop;
    var s = "", index = 0, startX = curX, startY = curY;
    getchLoop = function(code) {
      var done = false;
      if (code == 13) {  // enter
	done = true;
      } else if (code == 8) {  // backspace
	if (s.length > 0) {
	  s = s.substring(0, s.length - 1);
	  this.cursorBackward();
	  this.terminal.putChar(curX, curY, 0, fg, bg);
	}
      } else if (code == 37) {  // left arrow
	if (index > 0) {
	  index--;
  	  this.cursorBackward();
	}
      } else if (code == 39) {  // right arrow
	if (index < s.length) {
	  index++;
	  this.cursorForward();
	}
      } else if (code == 38 || code == 40) { // up or down
      } else {
	var left = s.substring(0, index);
	var right = s.substring(index, s.length);
	s = left + String.fromCharCode(code) + right;
	index++;
	this.cursorForward();
      }
      var oldX = curX, oldY = curY;
      this.moveCursor(startX, startY);
      this.printString(s, fg, bg);
      this.moveCursor(oldX, oldY);
      
      if (done) {
	this.printString("\n", fg, bg);
	this.showCursor = false;
	callback(s);
      } else {
        this.getch(getchLoop);
      }
    }.bind(this);
    this.showCursor = true;
    this.getch(getchLoop);
  };

  var lastX = -1, lastY, lastAtt, att, lastShow = false;
  this.terminal.update = function() {
    if (curX != lastX || curY != lastY || lastShow != this.showCursor) {
      att = this.terminal.getCharAttribs(curX, curY);
      if (lastX >= 0) {
	var c = this.terminal.getChar(lastX, lastY);
        this.terminal.putChar(lastX, lastY, c, lastAtt.fg, lastAtt.bg);
      }
      lastShow = this.showCursor;
      lastAtt = att;
      lastX = curX;
      lastY = curY;
    }
    if (this.showCursor) {
      this.terminal.putChar(curX, curY, att.value, att.bg, att.fg);
    }
  }.bind(this);
  
  var getchQueue = [];
  this.getch = function(callback) {
    getchQueue.push(callback);
  };

  document.addEventListener("keydown", function(event) {
    if (event.keyCode >= 37 && event.keyCode <= 40) { // arrow keys
      if (getchQueue.length > 0) {
	var callback = getchQueue.shift();
	callback(event.keyCode);
      }
    }
  });

  document.addEventListener("keypress", function(event) {
    if (getchQueue.length > 0) {
      var callback = getchQueue.shift();
      callback(event.charCode);
    }
  });
}




/*

  this.terminal.ready = function() {
    this.printString("> ");
    var repl_loop;
    repl_loop = function() {
      this.input(function(s) {
	this.printString(s + "\n");
	repl_loop();
        this.printString("> ");
      }.bind(this))
    }.bind(this);
    this.running = true;
    repl_loop();
  }.bind(this);
*/
