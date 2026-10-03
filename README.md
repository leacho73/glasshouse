# HA Dashboard

Home Assistant add-on: a fast, free-layout dashboard (Svelte + tiny Node proxy).

**Install:** Settings → Add-ons → Add-on Store → ⋮ → Repositories → add
`https://github.com/leacho73/ha-dashboard` → install **HA Dashboard** → Start → *Show in sidebar*.

## Develop

```sh
cd ha-dashboard/app && npm install
HA_URL=http://<ha>:8123 HA_TOKEN_FILE=~/.config/ha-dashboard/ha-token npm run server   # :8099
npm run dev                                                                            # Vite on :5173
```

## Adding a card type

Drop a `.svelte` file in `ha-dashboard/app/src/cards/` exporting a `meta` object
(`type`, `name`, `icon`, `category`, `size`, `fields`, `defaults`) from `<script module>`.
The editor form is generated from `fields`. Use `t()` / `ent()` from `lib/tpl.js` so
every setting can be a template.

Release: bump `version` in `ha-dashboard/config.yaml`, push, update from HA.
