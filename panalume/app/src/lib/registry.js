// Card registry: every file in src/cards exports a default component and a
// `meta` object (name, icon, default size, editor fields). Drop in a new file
// to add a card type.
const mods = import.meta.glob('../cards/*.svelte', { eager: true });

export const cards = {};
for (const m of Object.values(mods)) if (m.meta) cards[m.meta.type] = { component: m.default, meta: m.meta };

export const categories = ['Controls', 'Info', 'Media', 'Energy', 'Layout'];
