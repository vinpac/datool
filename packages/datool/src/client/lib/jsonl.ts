export function parseJSONL<Row>(input: string): Row[] {
  return input
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Row)
}
