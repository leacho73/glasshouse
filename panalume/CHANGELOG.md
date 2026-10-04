# Changelog

## 0.24.0

- **Glasshouse is now Panalume.** Same dashboard, new name: another Home Assistant dashboard, GlassHome, has a very similar one. To move across:
  1. In **Settings → Apps → App Store**, install **Panalume** (same repository; it appears next to Glasshouse).
  2. Start it, turn on **Show in sidebar** and open it. If Glasshouse is still running, Panalume copies your whole dashboard from it within a few seconds; nothing to export or import.
  3. Check it's all there, point wall tablets at Panalume (any `?view=…` / `&kiosk` options carry over), then uninstall Glasshouse.

  If Glasshouse isn't running any more, export from it (Layout → Backup) before uninstalling and import into Panalume.
- The GitHub repository is now **leacho73/panalume**. The old address redirects, so Home Assistant keeps finding updates.

## 0.23.2

- Sun card: the moon's path is back to a single line all day (the faint daytime style in 0.23.1 is gone). The set moon is still no longer drawn on top of the setting sun.

## 0.23.1

- Sun card: the moon's path is now a clear line only while the sun is down, and a faint dotted one in daylight, so it no longer looks as if the moon was bright in the sky at lunchtime. The dimmed moon below the horizon is no longer drawn on top of the setting sun.

## 0.23.0

- **3D printer card.** A progress ring around a picture of the model, what it's printing, time left and finish time, layers, nozzle / bed / chamber temperatures, the filament in use and its colour, Pause / Resume, Stop (asks first), the chamber light and print speed. Bambu Lab printers fill in automatically (the online one is picked); OctoPrint gets the basics. Wide, tall and single-row layouts.
- **Door lock card.** A big padlock whose shackle lifts when it's unlocked, coloured by state. Tap to lock; unlocking takes a second tap (or choose lock and unlock, or never). Optional door sensor, battery and an Open door button for locks that can release the latch. Small cards become a row with a Lock / Unlock button.
- **The moon on the Sun card.** Its path through the day alongside the sun's, and a disc showing tonight's shape (crescent, half, gibbous, full). Taller cards add the phase, how much is lit, and moonrise and moonset. Worked out from your location; no sensor needed. **Show the moon** turns it off.
- **Change several cards at once.** Select cards of the same type and show or hide a part (e.g. the light card's warm / cool and colour dots) or flip an on / off setting on all of them with one tap.
- **Copy to another view.** Next to Duplicate: copies the selected card(s) to another view, in the same spot if it's free there, otherwise underneath.
- **Cover card:** the icon, state, buttons and slider can each be hidden, and the buttons drop underneath when the slider is hidden or the card is narrow, so the name isn't squashed.
- **Main is now called Tablet**, and the phone / desktop options read *Same as tablet*, *Automatic*, *Its own layout* (the picker at the bottom shows e.g. *Phone (automatic)*).
- **No sidebar:** turning it off keeps its cards for later, and views without a Navigation card get a small views menu in the corner.
- Fixed: the Energy flow card trusted route sensors that didn't add up, e.g. showing the battery at 2.4 kW when it was supplying 3.4 kW. Routes are now checked against the battery power sensor or the house total. SolarEdge's battery power sensor is picked up automatically for new cards.

## 0.22.1

- Fixed: making a Climate group card a bit shorter switched it to the side-by-side layout while it still had spare space. It now loses the spare space first and only goes side by side once the unit rows no longer fit underneath.

## 0.22.0

- **Climate group card.** Several thermostats or AC units on one card, e.g. upstairs and downstairs air conditioning. One − / + changes them all (targets that differ meet in the middle first), mode buttons set them all (Off turns them all off), and a fan speed picker sets every unit that's on. The header shows what they're doing, the average temperature and how many are on. Below, each unit has its own row: power button, what it's doing, and its own − / +; tap its name for the more-info pop-up. Smaller cards drop the unit rows, then the fan picker, then the modes. Your climate entities are filled in when you add it.
- Fixed: the Text / Markdown card showed a scrollbar when a heading only just filled the card. Text is now centred top to bottom; text that's genuinely too long scrolls without a scrollbar.

## 0.21.4

- Fixed: making a card narrower let the joined card beside it widen over a card underneath. A neighbour taking up the freed space now stops at the usual gap from anything in its way.
- Fixed: making a card taller could push a row of cards below it down by different amounts, leaving the row out of line. Rows now stay level.
- New animated preview in the README.

## 0.21.3

- Fixed: making a card shorter pulled the cards joined below it up underneath other cards (e.g. a wide card below two cameras slid under the second camera). Cards moving up now stop at the usual gap below anything in their way, along with whatever is joined below them. The same goes for a column closing up after you drag a card out of it.

## 0.21.2

- Fixed: making a card taller slid it over a card below that wasn't quite at the usual gap. Cards below are now pushed down once the growing edge reaches them (keeping the usual gap), along with whatever is joined below them, and so on down the column.

## 0.21.1

- Fixed: making the sidebar narrower left its cards at their old width, hanging off its edge. Sidebar cards now scale to fit the sidebar's width (as the main area's cards already did), and any that are already too wide are squeezed in on screen and saved when you open the editor.
- Fixed: clearing the width box and pausing before typing a new number stopped cards being refitted.

## 0.21.0

- **Magnet for moving and resizing.** Cards sitting at the view's usual gap (worked out from your layout) or touching are joined:
  - Make a card taller or shorter and the cards joined below it move with it.
  - Drag a card's side edge and the joined card beside it narrows or widens to keep the row filled. Drag its top edge and the joined card above gives or takes the space.
  - Drop a card between two others in a column and it slots in at the usual gap, pushing the rest down. Drag one out of a column and the gap closes up.
  - Move or resize a card to within 5 px of the usual gap from another and it snaps to exactly that gap. A card further away stays independent.
  - Hold Shift to do any of this freely, without the magnet.

## 0.20.2

- Fixed: the Energy flow card cut small flows (e.g. 45 W of export next to 2 kW of solar) off the bottom of the chart. Every flow now gets a visible band and a bar tall enough for its label, and labels never overlap or run off the edge.

## 0.20.1

- Fixed: in the editor, pressing on any card made a long, scrolled sidebar jump back to the top until you let go. The sidebar now stays put, and dragging cards in and out of it still works.
- People card: avatars and names stay level when someone's status wraps onto a second line.

## 0.20.0

- **Solar card** (Add → Energy): generating now (and % of your system size), today's kWh against the forecast with what's still to come, whether today is above or below forecast, today's curve of actual output over the Solcast forecast and its likely range, where the solar is going (house / battery / export), tomorrow's forecast and, on a tall card, the next five days. Fills itself in for SolarEdge-style sensors and Solcast or Forecast.Solar. Shrinks to a strip.
- **Energy flow card** (Add → Energy): how self-powered the house is right now, solar / battery / house figures, and a live flow chart from where power comes from (solar, battery, grid) to where it goes (house, battery, export), each band as thick as the power on that route. Uses per-route sensors when your integration has them, otherwise works the routes out from solar, grid and battery power.
- People card: long statuses (e.g. room names) wrap onto a second line instead of being cut off.
- Cards can now keep entities they only read indirectly up to date (e.g. Solcast's day-by-day forecasts).

## 0.19.0

- **Sunrise & sunset card** (Add → Info): today's sun path drawn from your Home Assistant location, where the sun is now, and a countdown to the next sunrise or sunset. Sunrise, solar noon and sunset; on a big card also dawn, dusk and day length with the change since yesterday. Shrinks down to a thin strip or a tiny tile.
- **People card templates**: the status line and name can be templates, written once for everyone with `entity_id` as each person, e.g. which room they're in from presence sensors.
- **More info on cards without a single entity** (Zappi / Eddi, energy and appliance cards) now works: it opens the card's main entity, and the Zappi / Eddi card opens its own power reading, i.e. the last 24 hours of charging. The More info and Toggle actions also have an **Entity** picker to open any entity you like.

## 0.18.1

- Fixed: cards placed past the right-hand edge in an existing layout (e.g. from widening the sidebar before 0.18.0) still hung off the screen. Any view whose cards run past the edge is now squeezed to fit, with equal gaps kept and the right margin matching the left, and opening the editor saves the fitted positions.

## 0.18.0

- **Sidebar keeps its size** with *Fit the whole view on screen*: only the main area shrinks to fit, so the sidebar no longer changes size as you switch views. **Layout → Sidebar → When a view shrinks to fit the screen** brings back the old behaviour if you prefer it.
- **Changing the sidebar width no longer pushes cards off the screen.** Cards that would go over the edge (or that filled the width) are scaled across to fit, keeping equal gaps equal. The same happens when you turn the sidebar on or off or change the design width. Cards already off the edge come back the next time you change the width.
- **Camera fit: Auto** (new default) fills the card unless the picture is a very different shape from it, e.g. a wide dual-lens camera, which is then shown whole instead of heavily cropped. Also *Fill the card (crops edges)* and *Whole picture*. Existing camera cards switch to Auto.
- Navigation card: the views share the card's height, so a short card no longer cuts off the last view or shows a scrollbar.

## 0.17.0

- **Energy usage card** (Add → Energy), like Home Assistant's energy dashboard but live: hourly bars of where the house's energy came from (grid, solar, battery) above the line and where spare energy went (export, battery charging) below it. Today's kWh used, from grid, solar, exported and self-sufficiency, plus **cost, earnings and net** from HA's own cost statistics. A dotted line shows the price paid per kWh each hour, and the header shows what the house is using right now and the current import / export price. Tap an hour for its breakdown and cost. Sources and prices come from Home Assistant's Energy settings; HA's 5-minute statistics are read every minute and the current hour is topped up live from your power sensors in between. Today or yesterday.

## 0.16.2

- Fixed: the Zappi / Eddi card and the power flow's EV figure used the myenergi hub's "power charging" sensor, which adds up every Zappi and Eddi (e.g. a 7 kW car charge plus a 3 kW immersion showed as 10 kW). They now use each device's own reading. Existing cards correct themselves; nothing to change.
- Zappi / Eddi card shows power in kW (7.2 kW) from 1 kW up, and watts below.

## 0.16.1

- Octopus rates: Power Ups that Octopus only lists as *available* (often for other regions) are no longer shown as if they're happening. Only Power Ups you're in count.
- Octopus rates: back-to-back sessions show as one, e.g. two 1-hour Free Electricity sessions read "11:00–13:00" instead of just the first hour.

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
