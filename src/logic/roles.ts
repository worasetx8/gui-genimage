export type Role = "FACE" | "POSE" | "OUTFIT" | "OBJECT";

export const ROLE_KEYWORDS: Record<Role, string[]> = {
  FACE: ["face", "หน้า"],
  POSE: ["pose", "ท่า"],
  OUTFIT: ["outfit", "ชุด", "clothing"],
  OBJECT: ["object", "prop", "ของ", "item"],
};

export function normalizeName(name: string) {
  return name.toLowerCase();
}

export function detectRolesFromFilename(filename: string): Role[] {
  const n = normalizeName(filename);
  const roles: Role[] = [];
  (Object.keys(ROLE_KEYWORDS) as Role[]).forEach((role) => {
    const hit = ROLE_KEYWORDS[role].some((kw) => n.includes(kw.toLowerCase()));
    if (hit) roles.push(role);
  });
  return roles;
}
