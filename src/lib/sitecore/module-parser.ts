import type { DataTreeRow, MergeStrategy, TransferScope } from "./types";

/** Shape of a Sitecore serialization module.json file (subset we care about). */
interface ModuleFile {
  namespace?: string;
  tags?: string[];
  items?: {
    includes?: ModuleInclude[];
  };
}

interface ModuleInclude {
  name?: string;
  path?: string;
  scope?: string;
  allowedPushOperations?: string;
}

/**
 * Maps a serialization module scope to a Content Transfer API scope.
 * The API only supports SingleItem | ItemAndDescendants, so ItemAndChildren
 * (and any other value) is widened to ItemAndDescendants with a warning.
 */
export function mapScope(originalScope: string | undefined): {
  scope: TransferScope;
  warning?: string;
} {
  switch (originalScope) {
    case "SingleItem":
      return { scope: "SingleItem" };
    case "ItemAndDescendants":
      return { scope: "ItemAndDescendants" };
    case "ItemAndChildren":
      return {
        scope: "ItemAndDescendants",
        warning:
          "Scope 'ItemAndChildren' is not supported by the Content Transfer API; mapped to 'ItemAndDescendants' (includes ALL descendants, not just direct children).",
      };
    default:
      return {
        scope: "ItemAndDescendants",
        warning: `Unknown scope '${originalScope ?? "(none)"}'; defaulted to 'ItemAndDescendants'.`,
      };
  }
}

let rowSeq = 0;
function nextRowId(): string {
  rowSeq += 1;
  return `row-${rowSeq}-${rowSeq.toString(36)}`;
}

/**
 * Parses one module.json (already JSON-parsed) into DataTree rows.
 * `defaultMerge` is applied to every row (module files don't specify merge strategy).
 */
export function parseModule(
  module: ModuleFile,
  defaultMerge: MergeStrategy = "OverrideExistingItem",
): DataTreeRow[] {
  const includes = module.items?.includes ?? [];
  const tags = module.tags ?? [];

  return includes
    .filter((inc) => !!inc.path)
    .map((inc) => {
      const { scope, warning } = mapScope(inc.scope);
      return {
        id: nextRowId(),
        ItemPath: inc.path as string,
        Scope: scope,
        MergeStrategy: defaultMerge,
        sourceName: inc.name,
        originalScope: inc.scope,
        tags,
        warning,
      } satisfies DataTreeRow;
    });
}

/** Parses raw file text (with light error surfacing) into rows. */
export function parseModuleText(
  text: string,
  defaultMerge: MergeStrategy = "OverrideExistingItem",
): DataTreeRow[] {
  const parsed = JSON.parse(text) as ModuleFile;
  return parseModule(parsed, defaultMerge);
}
