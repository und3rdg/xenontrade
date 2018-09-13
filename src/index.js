"use strict";

const ioHook = require("iohook");
const clipboardy = require("clipboardy");
const os = require("os");

const Config = require("electron-store");
const NinjaAPI = require("poe-ninja-api-manager");
const Templates = require("./modules/templates.js");
const AutoMinimize = require("./modules/auto-minimize.js");
const Helpers = require("./modules/helpers.js");
const Parser = require("./modules/parser.js");
const GUI = require("./modules/gui.js");
const PoePrices = require("./modules/poeprices.js");

const ItemEntry = require("./modules/entries/item-entry.js");
const CurrencyEntry = require("./modules/entries/currency-entry.js");
const TextEntry = require("./modules/entries/text-entry.js");
const RareItemEntry = require("./modules/entries/rare-item-entry.js");

global.config = Helpers.createConfig();
global.templates = new Templates();
global.gui = new GUI();
global.ninjaAPI = new NinjaAPI();

class XenonTrade {
  /**
  * Creates a new XenonTrade object
  *
  * @constructor
  */
  constructor() {
    this.updating = false;
    this.poeFocused = false;
    this.autoMinimize = new AutoMinimize();
    this.initialize();
  }

  /**
  * Load templates, then initialize essential parts of the app
  */
  initialize() {
    templates.loadTemplates()
    .then(() => {
      gui.initialize();
      this.initializeAutoMinimize();
      this.initializeHotkeys();
      this.checkDependencies();
      return this.updateNinja();
    })
    .catch((error) => {
      alert("Error initializing app\n" +  error);
      return gui.window.close();
    });
  }


  /**
  * Starts the window listener based on OS
  * The window listener automatically hides the GUI when Path of Exile is not focused
  */
  initializeAutoMinimize() {
    var self = this;

      this.autoMinimize.initialize()
      .then(() => {
        self.autoMinimize.start();
      });
  }

  /**
  * Registers global hotkeys
  */
  initializeHotkeys() {
    var self = this;

    // Register CTRL + C hotkey
    const clipboardShortcut = ioHook.registerShortcut([29, 46], (keys) => {
      if(config.get("pricecheck") && this.poeFocused) {
        // Waiting 100ms before calling the processing method, because the clipboard needs some time to be updated
        setTimeout(function() {
          self.onClipboard();
        }, 100);
      }
    });

    ioHook.start();
  }

  /**
  * Checks if required packages are installed
  */
  checkDependencies() {
    var self = this;

    if(os.platform() === "linux") {
      Helpers.isPackageInstalled("xdotool")
      .catch((error) => {
        var message = "This tool uses <strong>xdotool</strong> to focus the Path of Exile window. It is recommended to install it for an optimal experience.";
        new TextEntry("Missing dependency", message, {icon: "fa-exclamation-triangle yellow"}).add();
      });
    }
  }

  /**
  * Checks if the copied content is item data from Path of Exile, parses it and adds an entry in the GUI
  */
  onClipboard() {
    if(!this.updating) {
      var clipboard = clipboardy.readSync();
      var parser = new Parser(clipboard);

      if(parser.isPathOfExileData()) {
        this.getItem(parser);
      }
    }
  }

  /**
  * Gets the item based on the parsed data
  *
  * @param {Parser} parser Parser containing the item clipboard
  */
  getItem(parser) {
    var itemType = parser.getItemType();

    // If identified...
    if(parser.isIdentified() === true) {
      // If rare, get poeprices data
      if(itemType === "Rare") {
        this._getRareItem(parser);
      } else {
        // If not rare, get ninja data
        if(ninjaAPI.hasData(config.get("league"))) {
          if(itemType !== "Magic") {
            this._getNinjaItem(parser);
          }
        } else {
          new TextEntry("No data", "There's no data for " + config.get("league") + ". You should update before attempting to price check another item.", {icon: "fa-exclamation-triangle yellow", timeout: 10}).add();
        }
      }
    }
  }

  /**
  * Gets the item based on the parsed data from poe.ninja
  *
  * @param {Parser} parser Parser containing the item clipboard
  */
  _getNinjaItem(parser) {
    ninjaAPI.getItem(parser.getName(), {league: config.get("league"), links: parser.getLinks(), variant: parser.getVariant(), relic: parser.isRelic(), baseType: parser.getBaseType()})
    .then((itemArray) => {
      this.onNinjaItemReceive(parser, itemArray[0]);
    })
    .catch((error) => {
      // No item received, not much you can do, huh
    });
  }

  /**
  * Gets the item price from poeprices
  *
  * @param {Parser} parser Parser containing the item clipboard
  */
  _getRareItem(parser) {
    var obj={"itemBase64":"UmFyaXR5OiBSYXJlCkNvcnBzZSBHcmFzcApDb25qdXJlciBHbG92ZXMKLS0tLS0tLS0KUXVhbGl0eTogKzIwJSAoYXVnbWVudGVkKQpFbmVyZ3kgU2hpZWxkOiA3NyAoYXVnbWVudGVkKQotLS0tLS0tLQpSZXF1aXJlbWVudHM6CkxldmVsOiA3MApEZXg6IDk4CkludDogMTExCi0tLS0tLS0tClNvY2tldHM6IEItQi1HLUcgCi0tLS0tLS0tCkl0ZW0gTGV2ZWw6IDYzCi0tLS0tLS0tCis4MSB0byBtYXhpbXVtIExpZmUKKzM5JSB0byBGaXJlIFJlc2lzdGFuY2UKKzM2JSB0byBDb2xkIFJlc2lzdGFuY2UKKzM1JSB0byBMaWdodG5pbmcgUmVzaXN0YW5jZQorMjkgdG8gbWF4aW11bSBFbmVyZ3kgU2hpZWxkCg==","price":{"status":200,"min":89.76,"max":134.64,"currency":"chaos","error":0,"pred_explanation":[["(pseudo) +#% total Elemental Resistance",0.5888532774052838],["(pseudo) (total) +# to maximum Life",0.10565856451535269],["(pseudo) # Elemental Resistances",0.00003946896076002651],["ES",-0.3054486891186035]],"data":{}}}

    var entry = new TextEntry("Getting price prediction...", {closeable: false});
    entry.add();

    PoePrices.request(parser.getItemText())
    .then((result) => {
      entry.close();
      new RareItemEntry(result, parser).add();
    })
    .catch((error) => {
      entry.close();
      console.error(error);
    });
  }

  /**
  * Adds a new entry for the item that has been received from poe.ninja
  *
  * @param {Parser} parser Parser containing the item clipboard
  * @param {Object} item Item object from poe.ninja
  */
  onNinjaItemReceive(parser, item) {
    var itemType = parser.getItemType();

    if(itemType === "Currency" || itemType === "Fragment") {
      new CurrencyEntry(item, parser).add();
    } else {
      new ItemEntry(item, parser).add();
    }
  }

  /**
  * Updates and saves poe.ninja data
  */
  updateNinja() {
    if(!this.updating) {
      this.updating = true;
      gui.toggleUpdate();
      var updateEntry = new TextEntry("Updating poe.ninja prices...", {closeable: false});
      updateEntry.add();

      ninjaAPI.update({league: config.get("league")})
      .then((result) => {
        updateEntry.close();
        new TextEntry("Update successful", {icon: "fa-check-circle green", timeout: 10}).add();
      })
      .catch((error) => {
        updateEntry.close();
        new TextEntry("Failed to update", error.message, {icon: "fa-exclamation-triangle yellow"}).add();
      })
      .then(() => {
        gui.toggleUpdate();
        return this.updating = false;
      });
    }
  }
}

global.app = new XenonTrade();
