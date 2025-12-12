import type { Role } from "./roles";
import { detectRolesFromFilename } from "./roles";

export type GroupedFiles = Record<Role, File[]>;

export function groupByRole(files: File[]): GroupedFiles {
  const grouped: GroupedFiles = { FACE: [], POSE: [], OUTFIT: [], OBJECT: [] };

  for (const f of files) {
    const roles = detectRolesFromFilename(f.name);
    // Strict mode guarantees exactly 1 role already, but keep safe:
    if (roles.length === 1) grouped[roles[0]].push(f);
  }

  // sort by filename to make "sequential order" deterministic
  (Object.keys(grouped) as Role[]).forEach((r) =>
    grouped[r].sort((a, b) => a.name.localeCompare(b.name))
  );

  return grouped;
}
