import { link, rename } from "node:fs/promises";
import path from "node:path";

/** Numbering starts at -2 and never changes the requested basename or extension. */
export function numberedOutput(base: string, version: number): string {
  if (!Number.isInteger(version) || version < 2) {
    throw new Error("Output version must be an integer greater than or equal to 2");
  }
  const parsed = path.parse(base);
  return path.join(parsed.dir, parsed.name + "-" + version + parsed.ext);
}

/**
 * Commit an already-rendered temporary PDF to its final name.
 *
 * - Explicit outputs: refuse collisions unless overwrite was authorized.
 * - Implicit outputs: atomically link to the first free base/-2/-3 name.
 * - Concurrent conversions never overwrite one another (EEXIST causes retry).
 *
 * The temporary file must reside in the target directory's filesystem.
 * The caller remains responsible for removing the temporary directory.
 */
export async function publishPdf(
  tempFile: string,
  requestedOutput: string,
  options: { overwrite: boolean; increment: boolean; signal?: AbortSignal },
): Promise<string> {
  if (options.signal?.aborted) throw new Error("PDF conversion cancelled");
  if (options.overwrite) {
    await rename(tempFile, requestedOutput);
    return requestedOutput;
  }

  // A bounded loop protects against unbounded work in directories containing
  // thousands of historical versions. The initial filename is candidate 1.
  for (let candidate = 1; candidate <= 10_000; candidate++) {
    if (options.signal?.aborted) throw new Error("PDF conversion cancelled");
    const output = candidate === 1 ? requestedOutput : numberedOutput(requestedOutput, candidate);
    try {
      // Hard links are atomic and fail with EEXIST if the destination appeared.
      await link(tempFile, output);
      return output;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        if (options.increment) continue;
        throw new Error("Output already exists (use --force to overwrite): " + output);
      }
      throw error;
    }
  }
  throw new Error("Could not find an unused numbered PDF filename (checked 10,000 candidates)");
}
