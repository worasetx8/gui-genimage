import { detectRolesFromFilename } from "./roles";

export type FileValidationError = {
  file: File;
  filename: string;
  reason: "NO_ROLE_KEYWORD" | "MULTIPLE_ROLE_KEYWORDS" | "DUPLICATE_EXTENSION";
  detectedRoles: string[];
};

/**
 * Ignore system / hidden / metadata files (macOS, Windows, etc.)
 */
function shouldIgnoreFile(filename: string) {
  const lower = filename.toLowerCase();

  // Explicit system files
  const ignoreNames = [
    ".ds_store",
    "thumbs.db",
    "desktop.ini",
  ];
  if (ignoreNames.includes(lower)) return true;

  // Hidden files (starting with dot)
  if (lower.startsWith(".")) return true;

  return false;
}

/**
 * Allow only image file extensions
 */
function isImageFile(filename: string) {
  return /\.(png|jpg|jpeg|webp)$/i.test(filename);
}

export function validateFilesStrict(files: File[]) {
  const errors: FileValidationError[] = [];
  const valid: File[] = [];

  for (const f of files) {
    const filename = f.name;

    // 1) Ignore system / hidden files
    if (shouldIgnoreFile(filename)) {
      continue;
    }

    // 2) Ignore non-image files
    if (!isImageFile(filename)) {
      continue;
    }

    if (hasDuplicateImageExtension(filename)) {
        errors.push({
          file: f,
          filename,
          reason: "DUPLICATE_EXTENSION" as any,
          detectedRoles: [],
        });
        continue;
      }

    // 3) Detect role from filename
    const roles = detectRolesFromFilename(filename);

    if (roles.length === 0) {
      errors.push({
        file: f,
        filename,
        reason: "NO_ROLE_KEYWORD",
        detectedRoles: [],
      });
      continue;
    }

    if (roles.length > 1) {
      errors.push({
        file: f,
        filename,
        reason: "MULTIPLE_ROLE_KEYWORDS",
        detectedRoles: roles,
      });
      continue;
    }

    // 4) Valid file
    valid.push(f);
  }

  return { valid, errors };
}
function hasDuplicateImageExtension(filename: string) {
    const lower = filename.toLowerCase();
    const exts = [".jpg", ".jpeg", ".png", ".webp"];
  
    // นับว่ามีนามสกุลรูปกี่ครั้งในชื่อ
    const count = exts.reduce((acc, ext) => acc + (lower.split(ext).length - 1), 0);
  
    // ถ้ามีมากกว่า 1 แปลว่ามี .jpg/.png ซ้ำ
    return count > 1;
  }
