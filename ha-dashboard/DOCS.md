# HA Dashboard

Open **Dashboard** in the HA sidebar. Press the faint pencil (top-right) or **E** to edit.

- **Add** cards from the panel; drag to move (between sidebar and main area too), drag any edge/corner to resize. Shift = 1px precision, arrows nudge, Delete, Ctrl+D duplicate, Ctrl+Z undo.
- **Card → Content / Style / Actions / Size**: any text field can be an HA template (`{{ states('sensor.x') }}`), including colours and styling.
- **Actions**: tap/hold → toggle, more-info pop-up, pop-up of other cards, navigate, service call, URL.
- **Layout**: separate layouts for tablet / phone / desktop; pin a screen with `?device=tablet`. Copy one layout to another.
- **Theme**: colours, fonts (Google Fonts URL), card glass/blur (set blur 0 on slow tablets), global CSS.

Config is stored in the add-on's `/data/dashboard.json` (Layout → Export for a backup).

## Energy cards

Added from **Add → Energy**; entities are auto-detected for the Octopus Energy and myenergi integrations (editable after).

- **Octopus rates** — current/next rate, cheapest 2h, half-hourly bars (today / next 24h / two days) with Intelligent dispatches, Octoplus sessions and export rate overlaid.
- **Octoplus sessions** — live session banner with baseline vs this half-hour's usage, upcoming Saving / Power Down / Power Up / Free Electricity sessions with **Join**, points and 12-month stats.
- **Intelligent Octopus** — dispatch status, planned/recent slots, smart/bump charge, ready-by time, charge target.
- **Energy cost today** — cost, kWh, average p/kWh, export, solar, yesterday, peak/off-peak split, half-hourly usage coloured by rate.
- **Heat pump** — live COP/SCOP, kW in/out, flow & outdoor temp, hot water + Boost.
- **Zappi / Eddi** — status, mode buttons, boosts.
- **Electric vehicle** — battery ring vs target, range, charging, plug/lock, climate.
- **Power flow** — solar / grid / battery / home / EV.

## Import from ha-fusion

Edit → **Layout → Import from ha-fusion** rebuilds the dashboard from your ha-fusion add-on: views, rooms, buttons (their state / name / icon / colour / service templates keep working, including `entity_id`), cameras and sidebar items, with tablet, phone and desktop layouts. An **Energy** view is added from auto-detected Octopus / myenergi / solar / EV entities. Icons from other sets (`tabler:`, `mingcute:`, `solar:` …) load from Iconify.
