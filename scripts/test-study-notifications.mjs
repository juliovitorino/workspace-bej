import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript';

const require = createRequire(import.meta.url), cache = new Map();
function load(file) {
  file = resolve(file);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  const output = transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 }
  }).outputText;
  const localRequire = id => {
    if (!id.startsWith('.')) return require(id);
    const base = resolve(dirname(file), id);
    return load([base + '.ts', base + '.tsx', base].find(p => existsSync(p) && statSync(p).isFile()));
  };
  vm.runInThisContext(`(function(require,module,exports){${output}\n})`, { filename: file })(localRequire, module, module.exports);
  return module.exports;
}
const {
  NOTIFICATION_MODULES, STUDY_NOTIFICATION_KEY, defaultStudyNotificationSettings,
  parseStudyNotificationSettings, readStudyNotificationSettings, writeStudyNotificationSettings, studyInactivityAlerts,
} = load('src/features/study/studyNotifications.ts');
const { STUDY_MODULES, EXTRA_CATEGORIES } = load('src/features/study/studyStorage.ts');
const { EXTRA_MODULE_PREFIX } = load('src/features/study/studyModuleChart.ts');
assert.equal(NOTIFICATION_MODULES.length, STUDY_MODULES.length - 1 + EXTRA_CATEGORIES.length);
assert.ok(NOTIFICATION_MODULES.includes('hashmap'));
assert.ok(NOTIFICATION_MODULES.includes('small-talk'));
assert.ok(NOTIFICATION_MODULES.includes('extra-category:conversation'));
assert.ok(NOTIFICATION_MODULES.includes('extra-category:reading'));
assert.ok(!NOTIFICATION_MODULES.includes('previous'), 'prior-hours adjustments are not study modules');
assert.ok(!NOTIFICATION_MODULES.includes('extra-activities'), 'external categories have independent switches');
assert.equal(new Set(NOTIFICATION_MODULES).size, NOTIFICATION_MODULES.length);
assert.equal(EXTRA_MODULE_PREFIX, 'extra-category:');
assert.ok(STUDY_NOTIFICATION_KEY.startsWith('bej.study.'), 'preferences stay separate from the study backup key');

const defaults = defaultStudyNotificationSettings();
assert.equal(defaults.enabled, false, 'notifications require explicit opt-in');
assert.equal(defaults.thresholdDays, 7);
assert.ok(NOTIFICATION_MODULES.every(module => defaults.modules[module] === false), 'modules require explicit opt-in');
assert.deepEqual(parseStudyNotificationSettings(null), defaults);
assert.deepEqual(parseStudyNotificationSettings('{bad'), defaults);
assert.deepEqual(parseStudyNotificationSettings('{"version":3}'), defaults);
assert.deepEqual(parseStudyNotificationSettings('[]'), defaults);
const configured = parseStudyNotificationSettings(JSON.stringify({
  version: 1, enabled: true, thresholdDays: 1,
  modules: { hashmap: true, 'small-talk': true, 'extra-category:conversation': true, 'extra-category:reading': true, hacked: true },
}));
assert.equal(configured.enabled, true);
assert.equal(configured.thresholdDays, 1);
assert.equal(configured.modules.hashmap, true);
assert.equal(configured.modules.hacked, undefined, 'unknown keys are ignored');
assert.equal(configured.modules['chunk-flashcards'], false);
assert.deepEqual(parseStudyNotificationSettings(JSON.stringify({ version: 1, enabled: true, thresholdDays: 2, modules: {} })), defaults);

// Preferences persist in a dedicated key without modifying study history.
const saved = new Map();
let changed = 0;
globalThis.window = {
  localStorage: {
    getItem: key => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value),
  },
  dispatchEvent: event => { if (event.type === 'bej-study-notifications-changed') changed++; },
};
assert.deepEqual(readStudyNotificationSettings(), defaults);
writeStudyNotificationSettings(configured);
assert.deepEqual(readStudyNotificationSettings(), configured);
assert.equal(changed, 1);
assert.deepEqual([...saved.keys()], [STUDY_NOTIFICATION_KEY]);
saved.set(STUDY_NOTIFICATION_KEY, '{broken');
assert.deepEqual(readStudyNotificationSettings(), defaults);

const day = 86400000;
const now = Date.parse('2026-11-19T12:00:00.000Z');
let id = 0;
const session = (module, daysAgo, language = 'en-US', category) => ({
  id: `session-${++id}`, module, language, mode: 'manual', activeSeconds: 60,
  startedAt: new Date(now - daysAgo * day - 60000).toISOString(),
  endedAt: new Date(now - daysAgo * day).toISOString(),
  ...(category ? { category } : {}),
});
const data = { goals: {}, monthlyGoals: {}, sessions: [
  session('hashmap', 8), session('hashmap', 2), // latest activity wins
  session('small-talk', 15), session('small-talk', 1, 'fr-FR'),
  session('extra-activities', 14, 'en-US', 'conversation'),
  session('extra-activities', 3, 'en-US', 'reading'),
  session('shadowing', 40),
], manualAdjustments: [{ id: 'prior', date: '2020-01-01', language: 'en-US', seconds: 600, description: 'old' }] };
const withThreshold = (thresholdDays, modules = configured.modules, enabled = true) => ({ ...configured, enabled, thresholdDays, modules });
assert.deepEqual(studyInactivityAlerts(data, withThreshold(1), now).map(a => a.module), ['extra-category:conversation', 'extra-category:reading', 'hashmap']);
assert.deepEqual(studyInactivityAlerts(data, withThreshold(7), now).map(a => a.module), ['extra-category:conversation']);
assert.deepEqual(studyInactivityAlerts(data, withThreshold(30), now), []);
assert.deepEqual(studyInactivityAlerts(data, withThreshold(1, configured.modules, false), now), []);
assert.deepEqual(studyInactivityAlerts(data, withThreshold(1, { ...configured.modules, 'extra-category:conversation': false }), now).map(a => a.module), ['extra-category:reading', 'hashmap']);
assert.deepEqual(studyInactivityAlerts({ ...data, sessions: [] }, withThreshold(1), now), [], 'never-used modules do not alert');
assert.deepEqual(studyInactivityAlerts(data, withThreshold(1), NaN), []);
const fresh = { ...data, sessions: [...data.sessions, session('extra-activities', 0, 'en-US', 'conversation')] };
assert.ok(!studyInactivityAlerts(fresh, withThreshold(7), now).some(a => a.module === 'extra-category:conversation'), 'new practice clears the alert');
const exactBoundary = { ...data, sessions: [session('hashmap', 1)] };
assert.equal(studyInactivityAlerts(exactBoundary, withThreshold(1), now).length, 0, 'the threshold must be exceeded, not merely reached');
const allModules = Object.fromEntries(NOTIFICATION_MODULES.map(key => [key, true]));
assert.ok(!studyInactivityAlerts(data, withThreshold(1, allModules), now).some(a => a.module === 'previous'), 'manual adjustments do not generate module alerts');
assert.ok(studyInactivityAlerts(data, withThreshold(30, allModules), now).some(a => a.module === 'shadowing'));
assert.ok(!studyInactivityAlerts(data, withThreshold(30, allModules), now).some(a => a.module === 'small-talk'), 'a recent session in another language clears the module alert');

const settingsSource = readFileSync('src/features/study/StudyNotificationSettings.tsx', 'utf8');
const centerSource = readFileSync('src/features/study/StudyNotificationCenter.tsx', 'utf8');
const dashboardSource = readFileSync('src/features/study/StudyDashboard.tsx', 'utf8');
const appSettingsSource = readFileSync('src/components/AppSettingsPage.tsx', 'utf8');
const appSource = readFileSync('src/App.tsx', 'utf8');
const css = readFileSync('src/features/study/studyNotifications.css', 'utf8');
assert.match(settingsSource, /role="switch"/);
assert.match(settingsSource, /type="radio"/);
assert.match(settingsSource, /NOTIFICATION_MODULES\.map/);
assert.match(settingsSource, /disabled=\{!settings\.enabled\}/);
assert.match(centerSource, /study-notification-count/);
assert.match(centerSource, /studyNotificationModuleLabel/);
assert.match(dashboardSource, /<StudyNotificationBell/);
assert.match(dashboardSource, /<StudyNotificationCenter/);
assert.match(dashboardSource, /studyInactivityAlerts\(displayData, notificationSettings, now\.getTime\(\)\)/);
assert.match(appSettingsSource, /"notifications"/);
assert.match(appSettingsSource, /<StudyNotificationSettings/);
assert.match(appSource, /onOpenNotificationSettings/);
assert.match(css, /study-notification-switch:focus-visible/);
for (const locale of ['pt-BR', 'en-US', 'es-ES', 'fr-FR']) {
  const translation = JSON.parse(readFileSync(`src/i18n/locales/${locale}.json`, 'utf8'));
  assert.ok(translation.settingsPage.notifications);
  for (const key of ['title','description','master','masterHelp','threshold','modules','localOnly','saveError','centerTitle','bellLabel','close','disabled','empty','alertMessage','configure']) {
    assert.ok(translation.studyNotifications[key], `Missing ${key} in ${locale}`);
  }
  for (const days of [1,7,30]) assert.ok(translation.studyNotifications.periods[days]);
}
console.log('PASS study notifications: defaults, opt-in, thresholds, all modules/categories, latest history, localization and dashboard/settings integration.');
