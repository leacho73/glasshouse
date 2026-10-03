# Changelog

## 0.16.0

- **Hot tub card** (Add → Controls): a top-down tub that warms in colour with the water, ripples and bubbles while the pumps run, steams while heating and glows with the light on. Target temperature − / +, pump (Off → Low → High) and light buttons, WaterCare mode, economy and standby, status lights (heating, circulation, ozone, filter cycle, winter mode) and maintenance reminders (rinse / clean filter, change water) that turn amber when due and red when overdue. Gecko (in.touch2) spas are detected automatically.
- **Washing machine, Tumble dryer and Dishwasher cards** (Add → Controls): a porthole whose drum turns while running (fast on spin) or a dish rack with spray, ringed by progress; time left and when it'll finish, programme and phase, settings (spin, temperature, dry level), alerts (salt / rinse aid low, door open, leak sensors) and Pause / Resume / Stop. Detects Samsung SmartThings washers, Home Connect (Bosch / Neff / Siemens) dishwashers and hOn (Haier / Candy / Hoover) dryers.
- **Octopus rates** now knows about Octoplus sessions: during Free Electricity or a Power Up the price shows as FREE (with the usual price beside it) and a countdown; during a joined Saving Session a banner shows what each kWh saved earns; the next session is shown under the price. The cheapest 2 hours counts free slots as 0p and avoids Saving Sessions, and free slots are drawn in teal on the chart.

## 0.15.0

New address options for wall tablets:
- `?view=Upstairs` opens a screen on a chosen view (its name or id), e.g. downstairs tablets on Downstairs and upstairs ones on Upstairs.
- `?return=5` goes back to that view (and closes any pop-up) after 5 minutes without a touch.
- `?noedit` hides the edit pencil and turns off the E shortcut.

Fixed: address options added to Home Assistant's address bar (e.g. in Fully Kiosk) were ignored, because Glasshouse runs inside a frame of HA's page. All options (`?device`, `?fit`, `?kiosk`, `?view`, `?return`, `?noedit`) are now read from HA's address as well.

## 0.14.0

- **Predbat card** (Add → Energy): what Predbat is doing now and until when, battery %, cost today, cost of the rest of the plan and yesterday's savings. A 24-hour plan chart shows charge (green) and export (yellow) windows, predicted battery %, car charging and import rates, followed by a list of the next charge / export slots. Charge / Export / Hold buttons force that for the current half-hour, and there's a Predbat mode picker. Predbat's own plan summary can be shown too. Entities are detected automatically, and the card is added to the ha-fusion import's Energy view.

## 0.13.0

- **Smart alignment** while editing: dragged or resized cards snap to the edges of other cards, with pink guide lines showing what lined up. Resizing also snaps to the same height or width as other cards (they're outlined while it matches).
- **Shift-drag** now moves a card freely to the pixel (no snapping). Shift-click still adds / removes cards from the selection.
- Wall tablets (*Fit the whole view on screen*): when a tall view is shrunk to fit, the cards now widen to use the full screen width instead of leaving a gap on the right.
- Navigation card: views sit centred in the card, and a short card no longer shows a needless scrollbar.
- Entity pickers (People card and other lists): the list opens again when you click back into the box after picking.

## 0.12.2

- Fixed live cameras showing a frozen picture in the add-on. Home Assistant's add-on proxy waits for a response to finish before passing it on, and a live stream never finishes. Live streams now go straight to Home Assistant, and if that isn't possible (e.g. HA uses SSL) the card falls back to refreshing snapshots about twice a second.

## 0.12.1

- Light card: removed the big brightness % on the right — it was already shown under the name.

## 0.12.0

- **Home battery card** (Add → Energy): charge %, kWh left of usable capacity, charging / discharging power, time until full or until your backup reserve (with clock time), status, health, temperature, today's in / out and a 24-hour charge graph. SolarEdge batteries are detected automatically; any other battery can be picked by hand. Wide cards put the graph alongside. Also added to the ha-fusion import's Energy view.
- **Camera fixes**: live cameras now stream over a websocket instead of a long-running image request. Browsers only allow a handful of those at once, so live cameras used to freeze after a while, and choosing a different camera changed the name but not the picture. Streams also reconnect themselves if they drop and pause while the screen is off.

## 0.11.1

- Phone layout: small cards that sit side by side on the main layout (e.g. two thermostats) now pair up two-per-row on phones instead of stacking at half width.
- New README with screenshots.

## 0.11.0

- **Live updates**: when you save changes on one screen, every other open screen (wall tablets, phones…) picks up the new layout within a second — no more reloading Fully Kiosk. Screens that are in edit mode are left alone.
- After an add-on update, open screens reload themselves onto the new version.

## 0.10.2

- Fixed: high-resolution tablets were detected as desktops (they report a wide screen), so they used the desktop's "actual size, centred" setting and showed a gap down each side. Touch-only screens are now always treated as tablets. Layout → Devices shows which device the current screen is using.
- Thermostat card adapts to its size: when there isn't room for the dial it switches to a compact − temperature + layout, and mode labels only show when they fit.

## 0.10.1

- Fixed wall-tablet mode (*Fit the whole view on screen*): when a view is shrunk to fit, the sidebar now stays at the screen edge and the main area stretches to fill the full width, instead of the whole dashboard being centred with gaps down both sides.

## 0.10.0

- **Thermostat card redesigned**: a dial you can drag to set the temperature (or use −/+), with the current temperature marked on it. The card glows orange when heating, blue when cooling, grey when off, with a pulsing heating/cooling indicator. Labelled mode buttons, plus preset and fan pickers when the device has them. Wide cards put the dial on the left. Water heaters without a target show their current temperature.
- **Light card redesigned**: glows in the light's actual colour (brighter as it's turned up), big brightness %, a gradient brightness slider, warm / neutral / cool buttons and colour buttons (choose your own colours). Light groups show how many are on, e.g. "9/12 on".
- Both cards have show/hide sections.

## 0.9.0

- **Kiosk mode**: hide Home Assistant's header bar above the dashboard. Turn it on per device in Layout ("Hide Home Assistant's header bar"), or add `?kiosk` to a screen's URL (`?kiosk=0` turns it off).

## 0.8.0

- **Sizing per device** (Layout tab → Sizing):
  - *Fill the screen width* — scroll down for more (default for tablets and phones).
  - *Fit the whole view on screen* — shrinks a tall view so nothing needs scrolling; made for wall tablets.
  - *Actual size, centred* — big monitors show the layout at 100% instead of blowing it up (now the default for desktops).
- Any screen can be forced with `?fit=width`, `?fit=screen` or `?fit=actual` in its URL.

## 0.7.0

- **Card size −/+**: select a card in edit mode and use the −/+ under it to make everything inside it (text, buttons, toggles, sliders) smaller or bigger without changing the card's box. Also in Style → Content size.
- **Card content size for all cards** in Theme, to shrink or grow every card at once.
- Toggles and sliders now scale with the card's font size instead of staying a fixed size.
- Fixed: with the edit panel hidden, the dashboard still left space for it and didn't use the full screen width.
- Phone: navigation sits across the top of every view, followed by the clock / weather from the sidebar; text blocks go to the bottom.

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
