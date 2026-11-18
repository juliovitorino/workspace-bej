import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const rawConfig = JSON.parse(await read("../public/config/maintenance.json"));
const source = await read("../src/features/maintenance/maintenanceConfig.ts");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText;
const { parseMaintenanceConfig, maintenanceMessage, isMaintenanceLocked } = await import(
  "data:text/javascript;base64," + Buffer.from(compiled).toString("base64")
);

const languages = ["pt-BR", "en-US", "es-ES", "fr-FR"];
const config = parseMaintenanceConfig(rawConfig);
assert.equal(config.visible, rawConfig.maintenance.visible === true, "Visibility must reflect the published config");
assert.equal(config.lockapp, false, "Application lock must be disabled by default");
for (const language of languages) {
  assert.equal(typeof config.messages[language], "string", "Missing language: " + language);
  assert.ok(config.messages[language].trim(), "Empty maintenance message: " + language);
  assert.equal(maintenanceMessage(config, language), config.messages[language]);
}

assert.equal(parseMaintenanceConfig({ maintenance: { visible: true, messages: config.messages } }).visible, true);
assert.equal(parseMaintenanceConfig({ maintenance: { visible: "true", messages: config.messages } }).visible, false);
assert.equal(parseMaintenanceConfig({ maintenance: { visible: 1, messages: config.messages } }).visible, false);
assert.equal(parseMaintenanceConfig({ maintenance: null }).visible, false);
assert.equal(parseMaintenanceConfig(null).visible, false);
assert.equal(parseMaintenanceConfig({ maintenance: { visible: true, messages: [] } }).messages["en-US"], "");
assert.equal(maintenanceMessage(parseMaintenanceConfig({
  maintenance: { visible: true, messages: { "pt-BR": "Mensagem padrão" } }
}), "fr-FR"), "Mensagem padrão");

// Only the combination visible=true AND lockapp=true may block the application.
for (const visible of [false, true]) {
  for (const lockapp of [false, true]) {
    const parsed = parseMaintenanceConfig({
      maintenance: { visible, lockapp, messages: config.messages }
    });
    assert.equal(parsed.visible, visible);
    assert.equal(parsed.lockapp, lockapp);
    assert.equal(isMaintenanceLocked(parsed), visible && lockapp);
  }
}
assert.equal(parseMaintenanceConfig({ maintenance: { visible: true, lockapp: "true" } }).lockapp, false);
assert.equal(parseMaintenanceConfig({ maintenance: { visible: true, lockapp: 1 } }).lockapp, false);
assert.equal(parseMaintenanceConfig({ maintenance: { visible: true } }).lockapp, false);
assert.equal(isMaintenanceLocked(parseMaintenanceConfig(null)), false);

const lockPage = await read("../src/features/maintenance/MaintenanceLockPage.tsx");
assert.match(lockPage, /maintenanceMessage\(config, language\)/);
assert.match(lockPage, /lang=\{language\}/);
for (const language of languages) {
  assert.ok(lockPage.includes('"' + language + '":'), "Missing localized lock title: " + language);
}
assert.doesNotMatch(lockPage, /<Sidebar|<StudyDashboard|<Header/);

const notice = await read("../src/features/maintenance/MaintenanceNotice.tsx");
assert.match(notice, /if \(!config.visible \|\| !message\) return null;/);
assert.match(notice, /role="status"/);
assert.match(notice, /lang=\{language\}/);
assert.match(notice, /\{message\}/);

const app = await read("../src/App.tsx");
assert.match(app, /loadMaintenanceConfig\(controller.signal\)/);
assert.match(app, /if \(maintenanceConfig === null\) return null;/);
assert.match(app, /if \(isMaintenanceLocked\(maintenanceConfig\)\) \{/);
assert.match(app, /return <MaintenanceLockPage config=\{maintenanceConfig\} language=\{getSourceLanguage\(\)\} \/>;/);
assert.match(app, /return <BejApp maintenanceConfig=\{maintenanceConfig\} \/>;/);
assert.match(app, /<MaintenanceNotice config=\{maintenanceConfig\} language=\{sourceLanguage\} \/>/);
const styles = await read("../src/App.css");
assert.match(styles, /\.maintenance-notice \{/);
assert.match(styles, /background: var\(--warning-soft\)/);
assert.match(styles, /@media \(max-width: 820px\)/);
assert.match(source, /cache: "no-store"/);

console.log("BEJ maintenance notice and full-page lock: four languages, flags and integration validated.");
