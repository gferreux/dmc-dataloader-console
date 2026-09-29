/**
 * Same normalization as dmc-dataloader-api `Slug`.
 * Trim, lowercase, strip accents, turn spaces and "-" into "_", keep `[a-z0-9_]`.
 * An empty result is not a valid slug.
 */
export function slugify(value: string): string {
  const stripped = value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return stripped.replace(/[\s-]/g, '_').replace(/[^a-z0-9_]/g, '');
}
