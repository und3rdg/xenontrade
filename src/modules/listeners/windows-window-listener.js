const path = require("path");
const Helpers = require("../helpers.js");
const spawn = require("child_process").spawn;

class WindowsWindowListener {
  /**
  * Creates a new WindowsWindowListener object
  *
  * @constructor
  * @param {XenonTrade} app The XenonTrade object
  */
  constructor(app) {
    this.app = app;
  }

  /**
  * Listen to window changes with python
  */
  start() {
    var self = this;

    try {
      /**
      * These were used for calling the python script directly, unfortunately that required python installed on the users system
      *
      * var scriptPath = Helpers.fixPathForAsarUnpack(path.join(__dirname, "../../", "/resource/python/window-change-listener.py"));
      * var scriptExecution = spawn("python", [scriptPath]);
      */

      var scriptPath = Helpers.fixPathForAsarUnpack(path.join(__dirname, "../../", "/resource/executables/window-change-listener.exe"));
      var scriptExecution = spawn(scriptPath);

      scriptExecution.stdout.on("data", (data) => {
        var output = self.uint8arrayToString(data);

        self._handleActiveWindowChange(output);
      });

      scriptExecution.stderr.on("data", (data) => {
          self.gui.entries.addText("Window listener error", "The window listener failed, which means this app can no longer be minimized automatically. Restart to restore functionality.", "fa-exclamation-circle red");
      });

      scriptExecution.on("exit", (code) => {
        self.gui.entries.addText("Window listener exit", "The window listener quit, which means this app can no longer be minimized automatically. Restart to restore functionality.", "fa-exclamation-circle red");
      });
    } catch(error) {
      // TODO: This shouldn't fail but maybe it does
    }
  }

  /**
  * Handles the window change event by showing the gui when switched to Path of Exile or XenonTrade or
  * hiding the GUI when switched to another window
  */
  _handleActiveWindowChange(windowTitle) {
    if(config.get("autoMinimize")) {
      if(windowTitle.includes("focus:'XenonTrade'")) {
        app.poeFocused = false;
      } else if(windowTitle.includes("focus:'Path of Exile'")) {
        app.poeFocused = true;
        gui.show();
      } else {
        app.poeFocused = false;
        gui.minimize();
      }
    }
  }

  /**
  * Convert an Uint8Array to a string
  */
  _uint8arrayToString(data) {
    return String.fromCharCode.apply(null, data);
  }
}

module.exports = WindowsWindowListener;