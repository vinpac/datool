export async function readJsonResponse<T>(
  response: Response
): Promise<T | { error?: string } | null> {
  const responseText = await response.text()

  if (!responseText.trim()) {
    return null
  }

  try {
    return JSON.parse(responseText) as T | { error?: string }
  } catch {
    return null
  }
}
