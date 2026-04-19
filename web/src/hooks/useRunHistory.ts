import { useState, useEffect, useCallback } from "react"
import { apiUrl } from "../api"
import type { AgentEvent } from "./useAgentStream"

export interface RunSummary {
  id: string
  taskId: string
  taskTitle: string
  startedAt: string
  finishedAt?: string
  status: "running" | "merged" | "unresolved" | "blocked"
  rounds: number
}

export interface RunDetail extends RunSummary {
  events: AgentEvent[]
}

export function useRunHistory() {
  const [runs, setRuns] = useState<RunSummary[]>([])
  const [selected, setSelected] = useState<RunDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const fetchRuns = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/runs"))
      if (res.ok) setRuns(await res.json())
    } catch { /* server not up yet */ }
  }, [])

  const selectRun = useCallback(async (id: string) => {
    setLoadingDetail(true)
    try {
      const res = await fetch(apiUrl(`/runs/${id}`))
      if (res.ok) setSelected(await res.json())
    } finally {
      setLoadingDetail(false)
    }
  }, [])

  const clearSelected = useCallback(() => setSelected(null), [])

  // Poll every 3s for new runs
  useEffect(() => {
    fetchRuns()
    const interval = setInterval(fetchRuns, 3000)
    return () => clearInterval(interval)
  }, [fetchRuns])

  return { runs, selected, loadingDetail, selectRun, clearSelected }
}
