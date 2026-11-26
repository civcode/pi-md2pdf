import { getSettingsListTheme, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Container, SettingsList, Text, type SettingItem } from "@earendil-works/pi-tui";
import { defaultPdfSettings, normalizePdfSettings, type PdfSettings } from "../core/settings.js";

export function pdfSettingItems(settings: PdfSettings): SettingItem[] {
  return [
    { id: "paper", label: "Paper format", currentValue: settings.paper, values: ["a4", "letter"], description: "Default PDF paper size." },
    { id: "toc", label: "Table of contents", currentValue: String(settings.toc), values: ["false", "true"], description: "Add a linked table of contents. Can add pages to long documents." },
    { id: "numberSections", label: "Number sections", currentValue: String(settings.numberSections), values: ["false", "true"], description: "Number headings automatically; preserve existing author numbering." },
    { id: "mermaidErrors", label: "Mermaid errors", currentValue: settings.mermaidErrors, values: ["placeholder", "source", "strict"], description: "placeholder: diagnostic and original source; source: original source only; strict: abort conversion." },
    { id: "reset", label: "Reset to defaults", currentValue: "Enter", values: ["Enter"], description: "Restore factory defaults in this menu. Save to apply." },
    { id: "save", label: "Save and close", currentValue: "Enter", values: ["Enter"], description: "Save preferences for future Pi conversions. Esc discards unsaved changes." },
  ];
}

export function updatePdfSetting(settings: PdfSettings, id: string, value: string): PdfSettings {
  if (id === "reset") return defaultPdfSettings();
  if (id === "paper" || id === "mermaidErrors") return normalizePdfSettings({ ...settings, [id]: value });
  if (id === "toc" || id === "numberSections") {
    if (value !== "true" && value !== "false") throw new Error("Invalid boolean setting: " + id);
    return normalizePdfSettings({ ...settings, [id]: value === "true" });
  }
  return settings;
}

/** Native Pi settings list: edits are staged until the explicit Save action. */
export async function editPdfSettings(ctx: ExtensionContext, initial: PdfSettings): Promise<PdfSettings | null> {
  return ctx.ui.custom<PdfSettings | null>((tui, theme, _kb, done) => {
    let draft = { ...initial };
    const container = new Container();
    container.addChild(new Text(theme.fg("accent", theme.bold("md2pdf settings")), 1, 0));
    container.addChild(new Text(theme.fg("muted", "Pi defaults · Save to apply · Esc to discard"), 1, 0));
    const list = new SettingsList(
      pdfSettingItems(draft), 8, getSettingsListTheme(),
      (id, value) => {
        if (id === "save") { done(draft); return; }
        draft = updatePdfSetting(draft, id, value);
        if (id === "reset") {
          for (const item of pdfSettingItems(draft)) list.updateValue(item.id, item.currentValue);
        }
      },
      () => done(null),
    );
    container.addChild(list);
    return {
      render: width => container.render(width),
      invalidate: () => container.invalidate(),
      handleInput: data => { list.handleInput(data); tui.requestRender(); },
    };
  }, { overlay: true, overlayOptions: { width: "70%", minWidth: 50, anchor: "center", margin: 1 } });
}
