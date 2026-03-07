import type { Player } from './types'

export function buildAliasMap(players: Player[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const player of players) {
    if (player.aliases) {
      for (const alias of player.aliases) {
        map[alias] = player.name
      }
    }
  }
  return map
}

export function matchPlayerName(
  input: string,
  players: Player[],
  aliasMap: Record<string, string>
): { matched: string | null; isExact: boolean } {
  const trimmed = input.trim()

  // Exact match on standard name
  const exactMatch = players.find(p => p.name === trimmed)
  if (exactMatch) return { matched: exactMatch.name, isExact: true }

  // Match via alias
  if (aliasMap[trimmed]) return { matched: aliasMap[trimmed], isExact: false }

  // Case-insensitive alias match
  const lowerInput = trimmed.toLowerCase()
  for (const [alias, canonical] of Object.entries(aliasMap)) {
    if (alias.toLowerCase() === lowerInput) {
      return { matched: canonical, isExact: false }
    }
  }

  // Partial match on standard name (for abbreviations)
  const partialMatch = players.find(
    p => p.name.includes(trimmed) || trimmed.includes(p.name)
  )
  if (partialMatch) return { matched: partialMatch.name, isExact: false }

  return { matched: null, isExact: false }
}
