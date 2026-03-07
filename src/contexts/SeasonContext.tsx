import { createContext, useContext, useState, type ReactNode } from 'react'

interface SeasonCtx {
  season: number
  setSeason: (s: number) => void
  availableSeasons: number[]
}

const SeasonContext = createContext<SeasonCtx>({
  season: 2026,
  setSeason: () => {},
  availableSeasons: [2025, 2026],
})

export function SeasonProvider({ children }: { children: ReactNode }) {
  const [season, setSeason] = useState(2026)
  return (
    <SeasonContext.Provider value={{ season, setSeason, availableSeasons: [2025, 2026] }}>
      {children}
    </SeasonContext.Provider>
  )
}

export const useSeason = () => useContext(SeasonContext)
