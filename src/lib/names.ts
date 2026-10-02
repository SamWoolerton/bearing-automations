export const normaliseName = (name: string) => name.trim().toLowerCase()

export const sameName = (a: string, b: string) =>
  normaliseName(a) === normaliseName(b)

export const includesName = (names: string[], name: string) =>
  names.some(n => sameName(n, name))
