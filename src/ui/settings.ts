import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { SettingsList, truncateToWidth, type SettingItem } from "@earendil-works/pi-tui";
import { defaultPdfSettings, normalizePdfSettings, type PdfSettings } from "../core/settings.js";

export function pdfSettingItems(settings: PdfSettings): SettingItem[] {
  return [
    { id: "paper", label: "Paper format", currentValue: settings.paper, values: ["a4", "letter"], description: "Default PDF paper size." },
    { id: "toc", label: "Table of contents", currentValue: String(settings.toc), values: ["false", "true"], description: "Add a linked table of contents. Can add pages to long documents." },
    { id: "numberSections", label: "Number sections", currentValue: String(settings.numberSections), values: ["false", "true"], description: "Number headings automatically; preserve existing author numbering." },
    { id: "mermaidErrors", label: "Mermaid errors", currentValue: settings.mermaidErrors, values: ["placeholder", "source", "strict"], description: "placeholder: diagnostic and original source; source: original source only; strict: abort conversion." },
    { id: "reset", label: "Reset to defaults", currentValue: "Enter", values: ["Enter"], description: "Restore and save the factory defaults." },
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

/** Compact fixed-width overlay; persist each change before accepting another. */
export async function editPdfSettings(
  ctx: ExtensionContext, initial: PdfSettings, persist: (settings: PdfSettings) => void,
): Promise<void> {
  await ctx.ui.custom<void>((tui, theme, _kb, done) => {
    let current = { ...initial };
    let status = "";
    const list = new SettingsList(
      pdfSettingItems(current), 5,
      {
        label: (text, selected) => selected ? theme.fg("accent", text) : text,
        value: (text, selected) => theme.fg(selected ? "accent" : "muted", text),
        description: text => theme.fg("dim", text),
        cursor: theme.fg("accent", "→ "),
        hint: text => theme.fg("dim", text.replace("Esc to cancel", "Esc to close")),
      },
      (id, value) => {
        try {
          const next = updatePdfSetting(current, id, value);
          persist(next);
          current = next;
          status = "";
        } catch (error) {
          status = "Save failed: " + (error instanceof Error ? error.message : String(error));
        }
        // SettingsList updates the selected value before its callback; restore
        // the last committed values if persistence failed, or refresh on reset.
        for (const item of pdfSettingItems(current)) list.updateValue(item.id, item.currentValue);
      },
      () => done(undefined),
    );
    return {
      render(width) {
        const inner = Math.max(0, width - 4);
        const border = (text: string) => theme.fg("border", text);
        const line = (text: string) => width < 4 ? truncateToWidth(text, width) :
          border("│") + " " + truncateToWidth(text, inner, "…", true) + " " + border("│");
        if (width < 4) return [truncateToWidth("md2pdf settings", width)];
        return [
          border("╭" + "─".repeat(width - 2) + "╮"),
          line(theme.fg("accent", theme.bold("md2pdf settings"))),
          line(theme.fg("muted", "Changes saved automatically")),
          line(""),
          ...list.render(inner).map(line),
          ...(status ? [line(theme.fg("error", status))] : []),
          border("╰" + "─".repeat(width - 2) + "╯"),
        ];
      },
      invalidate: () => list.invalidate(),
      handleInput: data => { list.handleInput(data); tui.requestRender(); },
    };
  }, { overlay: true, overlayOptions: { width: 56, minWidth: 44, maxHeight: "90%", anchor: "center", margin: 1 } });
}
