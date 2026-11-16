import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const donationJson = JSON.parse(await read("../public/config/donation.json"));
assert.equal(Object.hasOwn(donationJson.donation, "content"), false, "Payment config must not override translated text");

const configSource = await read("../src/features/donation/donationConfig.ts");
const configJs = ts.transpileModule(configSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText;
const { parseDonationConfig } = await import("data:text/javascript;base64," + Buffer.from(configJs).toString("base64"));
const legacy = parseDonationConfig({
  donation: {
    enabled: true, footer: { visible: true },
    content: { title: "Texto fixo", description: "Descrição fixa", footerMessage: "Rodapé fixo", buttonLabel: "Botão fixo" }
  }
});
assert.equal(Object.hasOwn(legacy, "content"), false, "Legacy fixed-language content must be ignored");
assert.equal(legacy.enabled, true);
assert.equal(legacy.footer.visible, true);

const page = await read("../src/features/donation/DonationPage.tsx");
const footer = await read("../src/features/donation/DonationFooter.tsx");
for (const [source, keys] of [
  [page, ["pageTitle", "description"]],
  [footer, ["footerMessage", "footerDescription", "buttonLabel"]]
]) {
  assert.doesNotMatch(source, /config\.content\./, "Donation components must not read fixed-language config");
  for (const key of keys) {
    assert.ok(source.includes('t("donation.' + key + '")'), "Missing i18n key: donation." + key);
  }
}
for (const language of ["pt-BR", "en-US", "es-ES", "fr-FR"]) {
  const translations = JSON.parse(await read("../src/i18n/locales/" + language + ".json"));
  for (const key of ["pageTitle", "description", "footerMessage", "footerDescription", "buttonLabel"]) {
    assert.equal(typeof translations.donation?.[key], "string", language + " missing donation." + key);
    assert.ok(translations.donation[key].trim(), language + " has empty donation." + key);
  }
}
console.log("BEJ donation i18n configuration and translations validated.");
