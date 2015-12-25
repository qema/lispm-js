function parenLevel(s) {
  var level = 0;
  for (var i = 0; i < s.length; i++) {
    var c = s.charAt(i);
    if (c == "(" || c == "[") {
      level++;
    } else if (c == ")" || c == "]") {
      level--;
    }
  }
  return level;
}

function LispM(opt) {
  const INDENT_LENGTH = 2;
  const FG_DEFAULT = 0x000000, BG_DEFAULT = 0xffffff;
  
  this.terminal = new Terminal(opt);
  this.display = this.terminal.view;

  this.running = false;

  var bscheme;
  var fg = FG_DEFAULT, bg = BG_DEFAULT;
  this.terminal.ready = function() {
    this.running = true;

    this.clear(fg, bg);

    // set up interpreter
    bscheme = new BiwaScheme.Interpreter(function(e, state) {
      this.printString(e.message + "\n");
    }.bind(this));

    puts = function(s, no_newline) {
      this.printString(s + (no_newline ? "" : "\n"));
    }.bind(this);

    BiwaScheme.define_libfunc("clear", 0, 0, function(args) {
      this.clear(fg, bg);
      return BiwaScheme.undef;
    }.bind(this));

    BiwaScheme.define_libfunc("color", 2, 2, function(args) {
      fg = args[0];
      bg = args[1];
    });

    // setup repl loop
    var replIter;
    var wholeString = "", indent = 0;
    replIter = function() {
      if (wholeString == "") {
        this.printString("> ");
      } else {
	this.printString(".." + (new Array(indent + 1).join(" ")));
      }
      this.input(function(s) {
	wholeString += s;
	var level = parenLevel(wholeString);
	if (level == 0) {
	  try {
	    bscheme.evaluate(wholeString, function(result) {
	      wholeString = "";
	      indent = 0;
	      if (result !== undefined && result !== BiwaScheme.undef) {
		this.printString("=> " + BiwaScheme.to_write(result) + "\n");
	      }
	    }.bind(this));
	  } catch(e) {
	    wholeString = "";
	    indent = 0;
	    this.printString(e.message + "\n");
	  }
	} else {
	  indent = INDENT_LENGTH * level;
	}
	replIter();
      }.bind(this));
    }.bind(this)
    replIter();
  }.bind(this);


  var curX = 0, curY = 0;
  this.clear = function(fg, bg) {
    this.terminal.clear(fg, bg);
    this.moveCursor(0, 0);
    recalibrateCursor = true;
  }
  
  this.printString = function(s, f, b) {
    if (typeof f === "undefined") { f = fg };
    if (typeof b === "undefined") { b = bg };
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i);
      if (c == "\n") {
	this.cursorNewline();
      } else {
        this.terminal.putChar(curX, curY, c, f, b);
	this.cursorForward();
      }
    }
  };

  this.cursorNewline = function() {
    curX = 0;
    curY++;
    if (curY >= this.terminal.height) {
      this.scrollDown();
    }
  };

  this.cursorForward = function() {
    curX++;
    if (curX >= this.terminal.width) {
      curX = 0;
      curY++;
    }
    if (curY >= this.terminal.height) {
      this.scrollDown();
    }
  };

  this.scrollDown = function() {
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
      this.terminal.putChar(x, this.terminal.height - 1, 0, fg, bg);
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
      } else if (code == (37 | 0xff00)) {  // left arrow
	if (index > 0) {
	  index--;
  	  this.cursorBackward();
	}
      } else if (code == (39 | 0xff00)) {  // right arrow
	if (index < s.length) {
	  index++;
	  this.cursorForward();
	}
      } else if (code == (38 | 0xff00) || code == (40 | 0xff00)) { // up/down
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

  var lastX, lastY, lastAtt, att, lastShow = false, recalibrateCursor = true;
  this.terminal.update = function() {
    if (curX != lastX || curY != lastY || lastShow != this.showCursor) {
      att = {
	value: this.terminal.getChar(curX, curY),
	fg: fg,
	bg: bg
      };
      if (recalibrateCursor) {
	recalibrateCursor = false;
      } else {
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
	callback(event.keyCode | 0xff00);
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
