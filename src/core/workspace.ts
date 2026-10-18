import path from "node:path";
import { realpath } from "node:fs/promises";

export class WorkspacePathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspacePathError";
  }
}

function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (relative !== ".." &&
    !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative));
}

/**
 * The Pi agent tool operates only on files beneath ctx.cwd.
 * A model-provided absolute path is not evidence that the user authorized
 * an unrelated directory. CLI and direct slash-command paths are separate.
 *
 * Realpath checks reject input symlinks and output-parent symlinks that
 * escape the working directory. Path spelling is retained so the output
 * basename remains the one requested by the user.
 */
export async function resolveWorkspacePaths(
  cwd: string,
  input: string,
  output?: string,
): Promise<{ input: string; output?: string }> {
  const workspace = await realpath(cwd);
  const resolvedInput = path.resolve(cwd, input);
  // Check lexical containment *before* filesystem lookup to avoid probing
  // arbitrary locations supplied by the model.
  if (!isInside(path.resolve(cwd), resolvedInput)) {
    throw new WorkspacePathError(
      "Markdown input is outside Pi's working directory (" + cwd +
      "). Use a file in that directory, or explicitly run /md2pdf with an absolute path.",
    );
  }

  let actualInput: string;
  try {
    actualInput = await realpath(resolvedInput);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new WorkspacePathError(
        "Markdown file not found in Pi's working directory: " + resolvedInput +
        ". No other folders were searched. Specify the correct relative path or change Pi's working directory.",
      );
    }
    throw error;
  }
  if (!isInside(workspace, actualInput)) {
    throw new WorkspacePathError("Markdown input resolves outside Pi's working directory: " + resolvedInput);
  }

  const resolvedOutput = output === undefined ? undefined : path.resolve(cwd, output);
  const outputPath = resolvedOutput ?? path.resolve(path.dirname(resolvedInput),
    path.parse(resolvedInput).name + ".pdf");
  if (!isInside(path.resolve(cwd), outputPath)) {
    throw new WorkspacePathError("PDF destination is outside Pi's working directory: " + outputPath);
  }
  // Validate the actual destination directory even when an intermediate
  // folder is a symlink. The converter will report missing directories.
  const actualParent = await realpath(path.dirname(outputPath));
  if (!isInside(workspace, actualParent)) {
    throw new WorkspacePathError("PDF destination resolves outside Pi's working directory: " + outputPath);
  }
  return { input: resolvedInput, output: resolvedOutput };
}
