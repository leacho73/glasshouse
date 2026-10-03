# Changelog

## 0.6.1

- Edit mode now scales the layout to fill the screen (like view mode), so cards can be dragged all the way to the right on wide screens.
- The edge of the layout is marked with a dashed outline and its design width while editing.

## 0.6.0

- New add-on ID (`glasshouse`) and repository address: `https://github.com/leacho73/glasshouse`.

## 0.5.0

- Renamed to **Glasshouse**, with a new icon and logo.
- Show / hide sections on the Weather card (icon, temperature, condition, humidity, wind, forecast, lows) and the Power flow card (solar, grid, battery, EV, home, flow lines).

## 0.4.0

- One main layout shown on every device: desktop scales it, phone gets an automatic single-column version. Phone or desktop can be switched to their own custom layout.
- New cards are added to every layout; Delete removes a card everywhere.
- Groups: rooms drag as one. Double-tap a card to move it alone. Shift/Ctrl-click or drag a box to select several, then group, ungroup, align or make the same size.
- Show / hide sections on the EV, Octopus rates, Octoplus sessions, Intelligent Octopus, Energy cost today, Heat pump and Zappi/Eddi cards (chips in Content, or the eye beside each field).

## 0.3.0

- **Import from ha-fusion** (Layout tab): rooms, buttons with their templates, cameras and sidebar, plus an auto-built Energy view.
- Icons from other sets (tabler, mingcute, solar…) via Iconify.
- Templates can use `entity_id` for the card's entity; button icon colour can be a template.
- New cards: Template lines, Divider.
- Renault EVs detected alongside Audi / VW.

## 0.2.0

- Energy cards: Octopus rates, Octoplus sessions (Saving Sessions, Power Up / Down, Free Electricity, with Join), Intelligent Octopus, Energy cost today, Heat pump, Zappi / Eddi, Electric vehicle.
- Entities are auto-detected when an energy card is added.

## 0.1.0

- First release: free-layout drag-and-drop dashboard with sidebar, drag-to-resize, per-card styling, live HA templates, pop-ups, theme editor, undo and 22 card types.
