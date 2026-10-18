import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import type Token from "markdown-it/lib/token.mjs";
import { LIMITS } from "./options.js";

const allowed = new Map([[".png", "image/png"], [".jpg", "image/jpeg"], [".jpeg", "image/jpeg"], [".webp", "image/webp"]]);
export async function inlineLocalImages(tokens: Token[], sourceFile: string): Promise<void> {
  const base = await realpath(path.dirname(sourceFile));
  let total = 0;
  for (const token of tokens) {
    for (const child of token.children ?? []) {
      if (child.type !== "image") continue;
      const src = child.attrGet("src") ?? "";
      if (!src || src.startsWith("data:") || /^[a-z][a-z0-9+.-]*:/i.test(src) || src.startsWith("//")) {
        throw new Error("Only local raster image paths are supported: " + src);
      }
      const decoded = decodeURIComponent(src.split(/[?#]/, 1)[0]!);
      if (path.isAbsolute(decoded)) throw new Error("Absolute image paths are not allowed: " + src);
      const resolved = await realpath(path.resolve(base, decoded));
      const relative = path.relative(base, resolved);
      if (relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative)) {
        throw new Error("Image escapes Markdown directory: " + src);
      }
      const mime = allowed.get(path.extname(resolved).toLowerCase());
      if (!mime) throw new Error("Unsupported image format: " + src);
      const info = await stat(resolved);
      if (!info.isFile() || info.size > LIMITS.image) throw new Error("Image missing or over 10 MiB: " + src);
      total += info.size;
      if (total > LIMITS.imagesTotal) throw new Error("Total embedded images exceed 30 MiB");
      const data = await readFile(resolved);
      child.attrSet("src", "data:" + mime + ";base64," + data.toString("base64"));
    }
  }
}
