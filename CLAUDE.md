# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # Install dependencies
npm run bundle       # Build client bundle (webpack, outputs to client/client.bundle.js)
npm run bundle:watch # Watch mode for development
```

No test suite is configured.

## Plugin Installation

Copy the entire plugin folder to:
```
{CAMUNDA_MODELER_INSTALLATION}/resources/plugins/
```

Then restart Camunda Modeler. The plugin registers via `index.js` which declares `name`, `menu`, `script`, and `style` entrypoints.

## Configuration

Create `config.json` in the repo root (gitignored) from the example:
```json
{ "GEMINI_API_KEY": "your-key-here" }
```
Obtain a key at [Google AI Studio](https://aistudio.google.com/app/apikey). Both `gemini-service.js` and `nestjs-generator.js` load this file at runtime via `require('../../config.json')`.

## Architecture

This is a **Camunda Modeler plugin** with two distinct execution contexts:

### Renderer process (`client/`)
- `client/client.js` — registers `bpmn-js-embedded-comments` as a bpmn-js plugin via `camunda-modeler-plugin-helpers`. This adds the data field UI directly onto BPMN elements.
- Webpack bundles `client.js` → `client.bundle.js`. The bundled file is what Camunda loads.
- Data fields are persisted inside `<bpmn:documentation>dataFields:{...}</bpmn:documentation>` tags in the BPMN XML, not in a separate database.

### Main (Electron) process (`menu/`)
- `menu/menu.js` — adds a "Generar Código" menu item (shortcut `Cmd/Ctrl+-`). When triggered, it uses `executeJavaScript` to extract the BPMN XML from the renderer via the `bpmnjs` global, then orchestrates the full pipeline.
- `menu/service/xml-parse.js` — extracts `dataFields:` JSON payloads from `<bpmn:documentation>` tags using brace-balanced extraction. Returns an array of `dataFields:{...}` strings.
- `menu/service/gemini-service.js` — calls `gemini-2.0-flash` with a detailed system prompt that implements derivation rules R1–R26 from a BPMN-to-UML methodology paper. Returns PlantUML class diagram code.
- `menu/service/nestjs-generator.js` — takes PlantUML code, calls Gemini again to generate a bash/bat scaffold script for a complete NestJS+Prisma project, saves and executes that script, then calls `npm run start` to validate it. Has a retry loop (max 10) that restarts on Prisma errors.
- `menu/service/html-dialog.js` — renders modal dialogs by injecting JavaScript into the renderer's `webContents`. Dialogs are pure DOM, no native Electron dialogs.
- `menu/log/logger.js` — writes to `{os.tmpdir()}/camunda-plugin.log`.

### Data flow
```
User clicks element → bpmn-js-embedded-comments UI → saves to BPMN XML documentation tag
                                                              ↓
User clicks "Generar Código" → xml-parse extracts dataFields → gemini-service generates PlantUML
                                                              ↓
                                                    nestjs-generator generates bash script
                                                              ↓
                                                    Script runs → NestJS+Prisma project created
```

## Key constraints

- The `client/` code runs in Camunda's renderer process (browser context, ES modules via webpack). The `menu/` code runs in Electron's main process (Node.js, CommonJS).
- `bpmnjs` instance access in the renderer is attempted via three globals in order: `window.__pluginBpmnjs`, `window.bpmnjs`, `window.__bpmnjsInstance`.
- `nestjs-generator.js` has a hardcoded NVM path (`/Users/diegoaliaga/.nvm/versions/node/v22.15.1/bin`) in `testStartCommand` — this is intentional for a specific dev machine and should be made configurable if the plugin is distributed.
- The Windows batch script generation (`generateBatchPrompt`) is a placeholder and not fully implemented.
