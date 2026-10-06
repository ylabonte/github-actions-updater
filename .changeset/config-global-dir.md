---
'github-actions-updater': patch
---

Config discovery no longer reads cosmiconfig's global config directory (`~/.config/ghau/`, `~/Library/Preferences/ghau/`, `%APPDATA%/ghau/Config/`). Previously a `config.{json,yaml,js,cjs,mjs,ts}` there was picked up, and the JavaScript variants were executed, despite the documented data-only config surface. Only `package.json#ghau`, `.ghaurc{,.json,.yaml,.yml}` and `ghau.config.json` in the working directory and its ancestors are considered.
