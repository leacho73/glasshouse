# HA Dashboard

Open **Dashboard** in the HA sidebar. Press the faint pencil (top-right) or **E** to edit.

- **Add** cards from the panel; drag to move (between sidebar and main area too), drag any edge/corner to resize. Shift = 1px precision, arrows nudge, Delete, Ctrl+D duplicate, Ctrl+Z undo.
- **Card → Content / Style / Actions / Size**: any text field can be an HA template (`{{ states('sensor.x') }}`), including colours and styling.
- **Actions**: tap/hold → toggle, more-info pop-up, pop-up of other cards, navigate, service call, URL.
- **Layout**: separate layouts for tablet / phone / desktop; pin a screen with `?device=tablet`. Copy one layout to another.
- **Theme**: colours, fonts (Google Fonts URL), card glass/blur (set blur 0 on slow tablets), global CSS.

Config is stored in the add-on's `/data/dashboard.json` (Layout → Export for a backup).
