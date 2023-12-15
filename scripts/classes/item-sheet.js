import {ItemsWithSpells5e} from '../items-with-spells-5e.js';
import {ItemsWithSpells5eItemSpellOverrides} from './item-spell-overrides.js';
import {ItemsWithSpells5eItem} from './item.js';

/**
 * A class made to make managing the operations for an Item sheet easier.
 */
export class ItemsWithSpells5eItemSheet {
  /** A boolean to set when we are causing an item update we know should re-open to this tab */
  _shouldOpenSpellsTab = false;

  constructor(app, [html]) {
    this.app = app;
    this.item = app.item;
    this.sheetHtml = html;
    this.itemWithSpellsItem = new ItemsWithSpells5eItem(this.item);
  }

  /** MUTATED: All open ItemSheet have a cached instance of this class */
  static instances = new Map();

  /**
   * Handles the item sheet render hooks.
   */
  static init() {
    Hooks.on('renderItemSheet', (app, html) => {
      let include = false;
      try {
        include = !!game.settings.get(ItemsWithSpells5e.MODULE_ID, `includeItemType${app.item.type.titleCase()}`);
      } catch {}
      if (!include) return;

      const instance = ItemsWithSpells5eItemSheet.instances.get(app.appId);
      if (instance) {
        instance.renderLite();
        if (instance._shouldOpenSpellsTab) {
          app._tabs?.[0]?.activate?.('spells');
          instance._shouldOpenSpellsTab = false;
        }
        return;
      }
      const newInstance = new ItemsWithSpells5eItemSheet(app, html);
      ItemsWithSpells5eItemSheet.instances.set(app.appId, newInstance);
      return newInstance.renderLite();
    });

    // clean up instances as sheets are closed
    Hooks.on('closeItemSheet', async (app) => {
      if (ItemsWithSpells5eItemSheet.instances.get(app.appId)) {
        return ItemsWithSpells5eItemSheet.instances.delete(app.appId);
      }
    });
  }

  /**
   * Renders the spell tab template to be injected
   */
  async _renderSpellsList() {
    const itemSpellsArray = [...(await this.itemWithSpellsItem.itemSpellItemMap).values()];

    return renderTemplate(ItemsWithSpells5e.TEMPLATES.spellsTab, {
      itemSpells: itemSpellsArray,
      config: {
        limitedUsePeriods: CONFIG.DND5E.limitedUsePeriods,
        abilities: CONFIG.DND5E.abilities,
      },
      isOwner: this.item.isOwner,
      isOwned: this.item.isOwned,
    });
  }

  /**
   * Ensure the item dropped is a spell, add the spell to the item flags.
   * @returns Promise that resolves when the item has been modified
   */
  async _dragEnd(event) {
    if (!this.app.isEditable) return;
    const data = TextEditor.getDragEventData(event);
    if (data.type !== 'Item') return;
    const item = fromUuidSync(data.uuid);
    if (item.type !== 'spell') return;
    // set the flag to re-open this tab when the update completes
    this._shouldOpenSpellsTab = true;
    return this.itemWithSpellsItem.addSpellToItem(data.uuid);
  }

  /**
   * Event Handler that opens the item's sheet
   */
  async _handleItemClick(event) {
    const itemId = event.currentTarget.closest("[data-item-id]").dataset.itemId;
    const item = this.itemWithSpellsItem.itemSpellItemMap.get(itemId);
    item?.sheet.render(true, {editable: !!item.isOwned && !!item.isOwner});
  }

  /**
   * Event Handler that removes the link between this item and the spell
   */
  async _handleItemDeleteClick(event) {
    const itemId = event.currentTarget.closest("[data-item-id]").dataset.itemId;
    // set the flag to re-open this tab when the update completes
    this._shouldOpenSpellsTab = true;
    return this.itemWithSpellsItem.removeSpellFromItem(itemId);
  }

  /**
   * Event Handler that also Deletes the embedded spell
   */
  async _handleItemDestroyClick(event) {
    const itemId = event.currentTarget.closest("[data-item-id]").dataset.itemId;
    // set the flag to re-open this tab when the update completes
    this._shouldOpenSpellsTab = true;
    return this.itemWithSpellsItem.removeSpellFromItem(itemId, {alsoDeleteEmbeddedSpell: true});
  }

  /**
   * Event Handler that opens the item's sheet or config overrides, depending on if the item is owned
   */
  async _handleItemEditClick(event) {
    const itemId = event.currentTarget.closest("[data-item-id]").dataset.itemId;
    const item = this.itemWithSpellsItem.itemSpellItemMap.get(itemId);
    if (item.isOwned) return item.sheet.render(true);
    // pop up a formapp to configure this item's overrides
    return new ItemsWithSpells5eItemSpellOverrides(this.itemWithSpellsItem, itemId).render(true);
  }

  /**
   * Synchronous part of the render which calls the asynchronous `renderHeavy`
   * This allows for less delay during the update -> renderItemSheet -> set tab cycle
   */
  renderLite() {
    // Update the nav menu
    const div = document.createElement("DIV");
    div.innerHTML = `<a class="item" data-tab="spells">${game.i18n.localize("TYPES.Item.spellPl")}</a>`;
    const tabs = this.sheetHtml.querySelector(".tabs[data-group=primary]");
    if (!tabs) return;
    tabs.appendChild(div.firstElementChild);

    // Create the tab
    const sheetBody = this.sheetHtml.querySelector(".sheet-body");
    div.innerHTML = "<div class='tab spells flexcol' data-group='primary' data-tab='spells'></div>";
    const c = div.firstElementChild;
    sheetBody.appendChild(c);
    this.renderHeavy(c);
  }

  /**
   * Heavy lifting part of the spells tab rendering which involves getting the spells and painting them.
   * @param {HTMLElement} spellsTab
   */
  async renderHeavy(spellsTab) {
    // Add the list to the tab
    const div = document.createElement("DIV");
    div.innerHTML = await this._renderSpellsList();
    const c = div.firstElementChild;
    spellsTab.appendChild(c);

    // Activate Listeners for this ui.
    c.querySelectorAll(".item-name").forEach(n => n.addEventListener("click", this._handleItemClick.bind(this)));
    c.querySelectorAll(".item-delete").forEach(n => n.addEventListener("click", this._handleItemDeleteClick.bind(this)));
    c.querySelectorAll(".item-destroy").forEach(n => n.addEventListener("click", this._handleItemDestroyClick.bind(this)));
    c.querySelectorAll(".configure-overrides").forEach(n => n.addEventListener("click", this._handleItemEditClick.bind(this)));

    // Register a DragDrop handler for adding new spells to this item
    const dragDrop = {
      dragSelector: ".item",
      dropSelector: ".items-with-spells-tab",
      permissions: {drop: () => this.app.isEditable && !this.item.isOwned},
      callbacks: {drop: this._dragEnd},
    };
    this.app.element[0].querySelector(dragDrop.dropSelector).addEventListener("drop", dragDrop.callbacks.drop.bind(this));
  }
}
