import {ItemsWithSpells5e} from '../items-with-spells-5e.js';

/* A class made to make managing the operations for an Actor. */
export class ItemsWithSpells5eActorSheet {
  /* Set up the Actor Sheet Patch */
  static init() {
    const id = ItemsWithSpells5e.MODULE_ID;
    const fn = ItemsWithSpells5eActorSheet.prepareItemSpellbook;
    ["Character", "NPC"].forEach(a => {
      libWrapper.register(id, `dnd5e.applications.actor.ActorSheet5e${a}.prototype._prepareSpellbook`, fn, "WRAPPER");
    });
  }

  /**
   * Filter iws spells into their own sections, removing them from standard sections.
   * @param {Function} wrapped      A wrapping function.
   * @param {object} data           The sheet data. **will be mutated**
   * @param {Item5e[]} spells       The actor's spells.
   * @returns {object}              The spellbook data.
   */
  static prepareItemSpellbook(wrapped, data, spells) {
    const nonItemSpells = spells.filter(spell => {
      const parentId = spell.getFlag(ItemsWithSpells5e.MODULE_ID, "parent-item");
      return !parentId || !this.actor.items.some(item => [item.id, item.uuid].includes(parentId));
    });
    const spellbook = wrapped(data, nonItemSpells);
    const order = game.settings.get(ItemsWithSpells5e.MODULE_ID, "sortOrder") ? 20 : -5;
    const createSection = (iws, uses = {}) => {
      return {
        order: order,
        label: iws.name,
        usesSlots: false,
        canCreate: false,
        canPrepare: false,
        spells: [],
        uses: uses.value ?? "-",
        slots: uses.max ?? "-",
        override: 0,
        dataset: {"iws-item-id": iws.id},
        prop: "item"
      };
    };

    const spellItems = spells.filter(spell => !!spell.getFlag(ItemsWithSpells5e.MODULE_ID, "parent-item"));
    const itemsWithSpells = this.actor.items.filter(item => {
      const fl = item.getFlag(ItemsWithSpells5e.MODULE_ID, "item-spells")?.length;
      if (!fl) return false;
      let include = false;
      try {
        include = !!game.settings.get(ItemsWithSpells5e.MODULE_ID, `includeItemType${item.type.titleCase()}`);
      } catch {}
      return include;
    });

    // create a new spellbook section for each item with spells attached
    itemsWithSpells.forEach((iws) => {
      // If the item requires attunement, but is not attuned, do not show spells.
      if (iws.system.attunement === CONFIG.DND5E.attunementTypes.REQUIRED) return;
      const section = createSection(iws, iws.system.uses);
      section.spells = spellItems.filter(spell => {
        const parentId = spell.getFlag(ItemsWithSpells5e.MODULE_ID, "parent-item");
        return [iws.id, iws.uuid].includes(parentId);
      });

      spellbook.push(section);
    });
    spellbook.sort((a, b) => (a.order - b.order) || (a.label - b.label));
    return spellbook;
  }
}
