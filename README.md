<p align="center"><img src="glasshouse/logo.png" alt="Glasshouse" width="250"></p>

# Glasshouse

A glassy, fast, drag-and-drop dashboard for Home Assistant, shipped as an add-on
(Svelte front end + tiny Node proxy, served through ingress).

- Free placement and resizing, sidebar, groups, one layout that adapts to tablet / phone / desktop
- 30+ card types, every setting can be a live HA template, per-card styling
- Energy cards for Octopus Energy (rates, Octoplus sessions, Intelligent), myenergi, heat pumps, EVs, solar
- One-click import from ha-fusion

**Install:** Settings → Add-ons → Add-on Store → ⋮ → Repositories → add
`https://github.com/leacho73/glasshouse` → install **Glasshouse** → Start → *Show in sidebar*.

## Develop

```sh
cd glasshouse/app && npm install
HA_URL=http://<ha>:8123 HA_TOKEN_FILE=~/.config/ha-dashboard/ha-token npm run server   # :8099
npm run dev                                                                            # Vite on :5173
```

## Adding a card type

Drop a `.svelte` file in `glasshouse/app/src/cards/` exporting a `meta` object
(`type`, `name`, `icon`, `category`, `size`, `fields`, `defaults`, optional `sections` and
`autofill`) from `<script module>`. The editor form is generated from `fields`. Use
`t()` / `ent()` from `lib/tpl.js` so every setting can be a template.

Release: bump `version` in `glasshouse/config.yaml`, push, update from HA.
