export const categories = ['Electrical', 'Measurement', 'Safety', 'Mechanical'] as const;
export interface ItemInput {
  name: string;
  category: string;
  quantity: number;
  unit_price: number;
  location: string;
  reorder_level: number;
}
export function parseId(value: string): number | null {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id <= 2147483647 ? id : null;
}
export function validateItem(body: unknown): { data?: ItemInput; error?: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Request body must be a JSON object.' };
  }
  const b = body as Record<string, unknown>;
  const allowed = ['name', 'category', 'quantity', 'unit_price', 'location', 'reorder_level'];
  if (Object.keys(b).some((key) => !allowed.includes(key))) {
    return { error: 'Unknown field. Allowed fields: ' + allowed.join(', ') };
  }
  for (const [key, max] of [['name', 100], ['location', 60]] as const) {
    if (typeof b[key] !== 'string' || !b[key].trim() || b[key].trim().length > max) {
      return { error: `${key} must be non-empty text, at most ${max} characters.` };
    }
  }
  if (typeof b.category !== 'string' || !categories.includes(b.category as typeof categories[number])) {
    return { error: 'Choose a valid category: ' + categories.join(', ') };
  }
  for (const key of ['quantity', 'reorder_level'] as const) {
    if (typeof b[key] !== 'number' || !Number.isInteger(b[key]) || b[key] < 0 || b[key] > 2147483647) {
      return { error: `${key} must be an integer between 0 and 2147483647.` };
    }
  }
  if (typeof b.unit_price !== 'number' || !Number.isFinite(b.unit_price) || b.unit_price < 0 ||
      b.unit_price > 99999999.99 || Math.abs(b.unit_price * 100 - Math.round(b.unit_price * 100)) > 0.000001) {
    return { error: 'unit_price must be a number from 0 to 99999999.99, with at most 2 decimal places.' };
  }
  return { data: {
    name: (b.name as string).trim(), category: b.category,
    quantity: b.quantity as number, unit_price: b.unit_price,
    location: (b.location as string).trim(), reorder_level: b.reorder_level as number,
  } };
}
