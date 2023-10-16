import {ItemsWithSpells5eActorSheet} from './classes/actor-sheet.js';
import {ItemsWithSpells5eActor} from './classes/actor.js';
import {ItemsWithSpells5eItemSheet} from './classes/item-sheet.js';
import {_registerSettings} from './classes/settings.mjs';

export class ItemsWithSpells5e {
  static API = {};
  static MODULE_ID = 'items-with-spells-5e';
  static SETTINGS = {};
  static FLAGS = {
    itemSpells: 'item-spells',
    parentItem: 'parent-item',
  };
  static TEMPLATES = {
    spellsTab: `modules/${ItemsWithSpells5e.MODULE_ID}/templates/spells-tab.hbs`,
    overrides: `modules/${ItemsWithSpells5e.MODULE_ID}/templates/overrides-form.hbs`,
  };

  static init() {
    ItemsWithSpells5e.preloadTemplates();
  }

  static preloadTemplates() {
    loadTemplates(ItemsWithSpells5e.TEMPLATES);
  }
}

Hooks.once("setup", _registerSettings);
Hooks.once("init", ItemsWithSpells5eActor.init);
Hooks.once("init", ItemsWithSpells5eActorSheet.init);
Hooks.once("init", ItemsWithSpells5e.init);
Hooks.once("init", ItemsWithSpells5eItemSheet.init);
