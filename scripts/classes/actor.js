import {ItemsWithSpells5e} from '../items-with-spells-5e.js';

/**
 * A class made to make managing the operations for an Actor.
 */
export class ItemsWithSpells5eActor {
  /* Set up the create/delete Item hooks. */
  static init() {
    Hooks.on('createItem', ItemsWithSpells5eActor.handleCreateItem);
    Hooks.on('deleteItem', ItemsWithSpells5eActor.handleDeleteItem);
  }

  /**
   * When an item is deleted from an actor, find any of its child spells and prompt for those to be deleted.
   * @param {Item5e} itemDeleted            The parent item that was deleted.
   * @param {object} options                Deletion options.
   * @param {string} userId                 The id of the user who performed the deletion.
   * @returns {Promise<Item5e[]|void>}      The deleted spells.
   */
  static async handleDeleteItem(itemDeleted, options, userId) {
    if (userId !== game.user.id) return;
    if (!(itemDeleted.parent instanceof Actor)) return;
    if (["group", "vehicle"].includes(itemDeleted.parent.type)) return;

    const ids = itemDeleted.getFlag(ItemsWithSpells5e.MODULE_ID, "item-spells") ?? [];
    if (!ids.length) return;

    const spellIds = itemDeleted.actor.items.reduce((acc, item) => {
      const flag = item.getFlag(ItemsWithSpells5e.MODULE_ID, "parent-item") ?? {};
      if ([itemDeleted.id, itemDeleted.uuid].includes(flag)) acc.push(item.id);// check uuid, too, for backwards compat.
      return acc;
    }, []);

    if (!spellIds.length) return;
    const confirm = options.itemsWithSpells5e?.alsoDeleteChildSpells ?? await Dialog.confirm({
      title: game.i18n.localize("IWS.MODULE_NAME"),
      content: game.i18n.localize("IWS.QUERY_ALSO_DELETE")
    });
    if (confirm) return itemDeleted.actor.deleteEmbeddedDocuments("Item", spellIds);
  }

  /**
   * When an item is created on an actor, if it has any spells to add, create those, and save a reference
   * to their uuids and ids in the parent item within `flags.<module>.item-spells`.
   * Each added spell also gets `flags.<module>.parent-item` being the parent item's id.
   * @param {Item5e} itemCreated      The item with spells that was created.
   * @param {object} options          Creation options.
   * @param {string} userId           The id of the user creating the item.
   * @returns {Promise<Item5e>}       The parent item updated with new flag data.
   */
  static async handleCreateItem(itemCreated, options, userId) {
    if (userId !== game.user.id) return;
    if (!(itemCreated.parent instanceof Actor)) return;
    if (["group", "vehicle"].includes(itemCreated.parent.type)) return;

    // bail out from creating the spells if the parent item is not valid.
    let include = false;
    try {
      include = !!game.settings.get(ItemsWithSpells5e.MODULE_ID, `includeItemType${itemCreated.type.titleCase()}`);
    } catch {}
    if (!include) return;

    // Get array of objects with uuids of spells to create.
    const spellUuids = itemCreated.getFlag(ItemsWithSpells5e.MODULE_ID, "item-spells") ?? [];
    if (!spellUuids.length) return;

    // Create the spells from this item.
    const spells = await Promise.all(spellUuids.map(d => ItemsWithSpells5eActor._createSpellData(itemCreated, d)));
    const spellData = spells.filter(s => s);
    const spellsCreated = await itemCreated.actor.createEmbeddedDocuments("Item", spellData);

    const ids = spellsCreated.map(s => ({uuid: s.uuid, id: s.id}));
    return itemCreated.setFlag(ItemsWithSpells5e.MODULE_ID, "item-spells", ids);
  }

  /**
   * Create the data for a spell with attack bonus, limited uses, references, and overrides.
   * @param {Item5e} parentItem     The item that has spells.
   * @param {object} data           Object with uuid and overrides.
   * @returns {Promise<object>}     The item data for creation of a spell.
   */
  static async _createSpellData(parentItem, data) {
    const spell = await fromUuid(data.uuid);
    if (!spell) return null;

    // Adjust attack bonus.
    const changes = data.changes?.system || {};
    if (("attackBonus" in changes) && (changes.attackBonus !== 0)) {
      changes.ability = "none";
      changes.attackBonus = `${changes.attackBonus} - @prof`;
    }

    // Adjust limited uses.
    const rollData = parentItem.getRollData({deterministic: true});
    const usesMax = changes.uses?.max;
    if (usesMax) changes.uses.value = dnd5e.utils.simplifyBonus(usesMax, rollData);

    // Adjust item id for consumption.
    if (changes.consume?.amount) {
      changes.consume.type = "charges";
      changes.consume.target = parentItem.id;
    }

    // Create and return spell data.
    const spellData = game.items.fromCompendium(spell);
    return foundry.utils.mergeObject(spellData, {
      "flags.items-with-spells-5e.parent-item": parentItem.id,
      system: changes
    });
  }
}
