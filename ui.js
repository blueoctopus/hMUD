var HMUD_UI = {
    output: null,
    scrollLock: false,
    echo: true,
    focus: true,

    /* current line in output window
       for counting and limiting lines in the output window) */
    lineCount: 1,

    icons: null,
    numIconsVisible: 3,
    iconWidth: 32,
    iConnOn: null,
    iConnOff: null,
    connState: null,

    init: function () {
        var f;
        if (f = readCookie("font"))
            this.selectFont(f, false);
        else if (BrowserDetect.browser == "Chrome")
            /* Chrome does not support Fixedsys natively */
            this.selectFont("font-courier-b", false);
        else
            this.selectFont("font-fixed", false);

        this.output = document.getElementById("output");
        this.output.onscroll = function() { HMUD_UI.outputOnScroll(this); };

        this.icons = [["i-save", "Treasure-icon.gif", saveLog],
                      ["i-clear", "Rune-icon.gif", options],
                      ["i-conn-on", "Button-icon.gif", connectDisconnect],
                      ["i-conn-off", "Button-icon-off.gif", connectDisconnect]];
        this.initCmdLine();

        document.body.onclick = function(e) { HMUD_UI.bodyOnClick(e); };
        document.title = m.windowTitle;

        /* Default icons */
        var ib = document.getElementById("iconsBar");
        var getIconFn = function(i) {
            return icon.onclick = function(e) {
                if (!e) var e = window.event;
                HMUD_UI.icons[i][2]();
                e.cancelBubble = true;
                if (e.stopPropagation)
                    e.stopPropagation();
            };
        };
        for (var i = 0; i < this.icons.length; ++i) {
            var icon = document.createElement("img");
            icon.id = this.icons[i][0];
            icon.src = this.icons[i][1];
            icon.onclick = getIconFn(i);
            if (icon.id == "i-conn-on")
                icon.style.display = "none";
            ib.appendChild(icon);
        }

        document.getElementById("logSave").style.display = "none";
        document.getElementById("optionsMenu").style.display = "none";
        document.getElementById("connectionMenu").style.display = "none";

        this.iConnOn  = document.getElementById("i-conn-on");
        this.iConnOff = document.getElementById("i-conn-off");

        /*
         * When the window loses or gains focus.
         */
        if (BrowserDetect.browser == "Explorer") {
            document.onfocusin =  function() { HMUD_UI.stopTitleAlert(); HMUD_UI.setFocus(true); };
            document.onfocusout = function() { HMUD_UI.setFocus(false); };
        } else {
            window.onfocus = function() { HMUD_UI.stopTitleAlert(); HMUD_UI.setFocus(true); };
            window.onblur = function() { HMUD_UI.setFocus(false); };
        }

        window.onresize =  function() { HMUD_UI.rearrange(); };
        this.rearrange();

        this.screenWrite(m.loadingClient);
        /* try to connect when all the interface is ready */
        HMUD_Client.tryToConnect();
    },

    initCmdLine: function () {
        this.cmdline = document.getElementById("cmdline");
        this.cmdline.onfocus = function() { HMUD_UI.setFocus(true); };
        this.cmdline.focus();
    },

    /* send a command to MUD */
    command: function (cmd) {
        if (this.echo) {
            this.screenWrite(cmd.replace(/ /g, "\xA0") + "<br>");
            HMUD_History.add(cmd);
        }
        HMUD_Client.command(cmd);
    },

    scrollBottom: function () {
        this.output.scrollTop = Math.max(this.output.clientHeight, this.output.scrollHeight);
    },

    outputOnScroll: function (e) {
        if (e.scrollHeight - e.scrollTop > e.clientHeight) {
            this.scrollLock = true;
            if (e.className != "scrollLock")
                e.className = "scrollLock";
        } else {
            this.scrollLock = false;
            if (e.className != "")
                e.className = "";
        }
    },

    /* add <str> to output window (HTML format) */
    screenWrite: function (str) {
        var lastIndex = -1;
        var i;

        while ((i = str.indexOf("<br>", lastIndex + 1)) != -1) {
            this.updateLineCount(this.lineCount + 1);
            lastIndex = i + 4; /* 4 = <BR> length */
        }

        var b = document.createElement("b");
        b.innerHTML = str;
        this.output.appendChild(b);

        if (!this.focus)
            this.startTitleAlert();
        if (!this.scrollLock)
            this.scrollBottom();
    },

    clearScreen: function(l) {
        if (l == "all") {
            var cl = this.output.childNodes.length;
            for (var i = 0; i < cl; i++)
                /* childNodes is "live", so always index 0 for the next element */
                this.output.removeChild(this.output.childNodes[0]);
            this.updateLineCount(1);
            return;
        }

        var cLines;
        if (l == "half")
            cLines = (this.lineCount / 2) | 0; // (int) cast
        else if (this.lineCount >= l)
            cLines = this.lineCount - l;
        else
            return;

        /*
        for (var i = 0; i < cLines && this.output.firstChild; ++i)
            this.output.removeChild(this.output.firstChild);
        */

        cLines = this.removeLines(this.output, cLines);
        this.updateLineCount(this.lineCount - cLines);
    },

    removeLines: function(root, num) {
        var linesRemoved = 0;
        var cl = root.childNodes.length;

        for (var i = 0; i < cl; ++i) {
            if (linesRemoved == num)
                return linesRemoved;

            var n = root.childNodes[0];

            if (n.nodeType == 1) { /* it's an Element */
                if (n.nodeName.toLowerCase() == "br") { /* line break found */
                    root.removeChild(n);
                    ++linesRemoved;
                } else {
                    linesRemoved += this.removeLines(n, num - linesRemoved);

                    if (n.childNodes.length == 0) {
                        root.removeChild(n); /* the element is empty, get rid of it */
                    }
                }
            } else {
                root.removeChild(n);
            }
        }

        return linesRemoved;
    },

    updateLineCount: function(l) { 
        this.lineCount = l | 0; // yes, this casts to an integer...
        var nl = document.getElementById("numLinesInScreen");
        if (nl)
            nl.innerHTML = this.lineCount;
        return this.lineCount;
    },

    /* Rearrange UI elements.
       Elements that are dynamically positioned should be treated here */
    rearrange: function() {
        var d = getViewportDimensions();
        var p;

        /* commandline */
        var c = this.cmdline;
        c.style.width = (d.width - 20 - (this.numIconsVisible * this.iconWidth)) + "px";

        /* icons bar */
        var ib = document.getElementById("iconsBar");
        p = findPos(c);
        ib.style.top = (p[1]) + "px";

        /* output window */
        var o = this.output;
        o.style.height = (d.height - (c.offsetHeight + 1) - 40) + "px";
        o.style.width = (d.width - 40) + "px";

        /* optionsMenu */
        var ic = document.getElementById("i-clear");
        var cs = document.getElementById("optionsMenu");
        p = findPos(ic);
        cs.style.left = (p[0] - cs.offsetWidth + ic.offsetWidth) + "px";
        cs.style.top = (p[1] + 1 - cs.offsetHeight) + "px";

        /* connectionMenu */
        var icn = this.getActiveConnectionIcon();
        var cm = document.getElementById("connectionMenu");
        p = findPos(icn);
        cm.style.left = (p[0] - cm.offsetWidth + icn.offsetWidth) + "px";
        cm.style.top = (p[1] + 1 - cm.offsetHeight) + "px";
    },

    selectFont: function(name, save) {
        document.body.className = name;
        if (save)
            createCookie("font", name, 10000);
    },

    bodyOnClick: function(e) {
        var rightclick;
        if (!e) e = window.event;
    
        if (e.which) rightclick = (e.which == 3);
        else if (e.button) rightclick = (e.button == 2);
    
        /* If there's a selection, let's not change the focus */
        /* http://www.quirksmode.org/dom/range_intro.html */
        var userSelection;
        if (window.getSelection)
            userSelection = window.getSelection();
        else if (document.selection) // should come last; Opera!
            userSelection = document.selection.createRange();
    
        var selectedText = userSelection;
        if (userSelection.text)
            selectedText = userSelection.text;
        else if (selectedText.toString)
            selectedText = selectedText.toString();
        else
            selectedText = "";
    
        /* If it's not a right click and there's no text selected,
           let's automatically focus the command line */
        if (!rightclick && (!selectedText || selectedText.length < 1)) {
            if (!window.disableCmdFocus)
                this.cmdline.focus();
    
            var o;
            o = document.getElementById("optionsMenu");
            if (o.style.display != "none")
                o.style.display = "none";
            o = document.getElementById("connectionMenu");
            if (o.style.display != "none")
                o.style.display = "none";
            o = document.getElementById("logSave");
            if (o.style.display != "none")
                o.style.display = "none";
        }
    },

    /*
     * Title alert
     */
    stopTitleAlert: function() {
        if (window.titleIId) {
            clearInterval(window.titleIId);
            window.titleIId = null;
            document.title = m.windowTitle;
        }
    },

    startTitleAlert: function() {
        document.title = document.title == m.windowTitleAlert ? m.windowTitle : m.windowTitleAlert;

        if (window.titleIId == null) {
            window.titleIId = setInterval(function(){HMUD_UI.startTitleAlert();}, 1000);

            document.body.onmousemove = function() {
                HMUD_UI.stopTitleAlert();
                document.body.onmousemove = function(){};
            };
        }
    },

    /*
     * UI State
     */

    setEcho: function (b) {
        b = b ? true : false;

        if (this.echo == b)
            return;

        this.echo = b;

        // Replacing input text by password or password by text
        var newc = document.getElementById("cmdline-swap");
        newc.setAttribute("id", "cmdline");
        newc.style.display = "inline";
        this.cmdline.setAttribute("id", "cmdline-swap");
        this.cmdline.style.display = "none";
        this.cmdline = newc;
        this.initCmdLine();

        this.rearrange(); // it will resize the cmdline properly
    },

    setFocus: function (b) {
        this.focus = b ? true : false;
    },

    setConnectionState: function(state) {
        if (state == "connecting") {
            this.connState = "connecting";
            this.setIconConnecting();
            this.screenWrite(m.connecting);
        } else if (state == "connected") {
            this.connState = "connected";
            this.setIconConnected();
            this.screenWrite(m.connected);
        } else if (state == "disconnected") {
            this.connState = "disconnected";
            this.setIconDisconnected();
            this.screenWrite(m.disconnected);
        } else {
            alert("Invalid connection state!");
            return;
        }

        this.rearrange();
    },

    setIconConnecting: function () {
        clearInterval(this.connectingIId);
        this.connectingIId = setInterval(function(){HMUD_UI.swapIconConnected}, 300);
    },

    /* helper for setIconConnecting */
    swapIconConnected: function () {
        if (this.iConnOn.style.display == "none") {
            this.iConnOn.style.display = "inline";
            this.iConnOff.style.display = "none";
        } else {
            this.iConnOn.style.display = "none";
            this.iConnOff.style.display = "inline";
        }
    },

    setIconConnected: function () {
        clearInterval(this.connectingIId);
        this.iConnOn.style.display = "inline";
        this.iConnOff.style.display = "none";
    },

    setIconDisconnected: function () {
        clearInterval(this.connectingIId);
        this.iConnOn.style.display = "none";
        this.iConnOff.style.display = "inline";
    },

    getActiveConnectionIcon: function() {
        if (this.iConnOn.style.display == "none")
            return this.iConnOff;
        else
            return this.iConnOn;
    },

    /* Messages from HMUD_Client */
    handleMessage: function(msg, info) {
        switch (msg) {
        case "loaded":
            this.screenWrite(m.clientLoaded);
            break;
        case "connecting":
            this.setConnectionState("connecting");
            break;
        case "connected":
            this.setConnectionState("connected");
            break;
        case "disconnected":
            this.setConnectionState("disconnected");
            break;
        case "ioError":
            this.screenWrite(m.ioError); /* no change in state, I guess */
            break;
        case "securityError":
            this.screenWrite(m.securityError);
            this.setConnectionState("disconnected");
            break;
        case "receive":
            this.screenWrite(info);
            break;
        case "echoOn":
            this.setEcho(true);
            break;
        case "echoOff":
            this.setEcho(false);
            break;
        case "usingIE":
            return BrowserDetect.browser == "Explorer";
        default:
            return false;
        }

        return true;
    }
};

/*
 * History navigation
 */
var HMUD_History = {
    commands: [],
    pointer: -1, // -1 means the user is out of the history navigation

    /* previous = true, next = false */
    get: function(previous) {
        if (this.commands.length < 1)
            return "";

        if (previous) {
            if (this.pointer == -1)
                return this.commands[this.pointer = this.commands.length - 1];
            else if (this.pointer == 0)
                return this.commands[0];
            else
                return this.commands[--this.pointer];
        } else {
            if (this.pointer == -1)
                return "";
            else if (this.pointer == this.commands.length - 1) { // out of range
                this.pointer = -1;
                return "";
            } else
                return this.commands[++this.pointer];
        }
    },

    previous: function() { return this.get(true); },
    next: function() { return this.get(false); },

    add: function(cmd) {
        // adding to history always clears the pointer
        this.pointer = -1;

        if (cmd.length < c.historyMinLength)
            return;

        /* if the command is the same as the previous one, let's not repeat it in the history */
        if (cmd == this.commands[this.commands.length - 1]) {
            return;
        }

        if (this.commands.push(cmd) > c.maxHistorySize)
            this.commands.shift();
    }
};

