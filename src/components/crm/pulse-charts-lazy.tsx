"use client"

import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"

// Recharts measures the DOM, so the charts only render on the client.
export const PipelineChart = dynamic(() => import("./pulse-charts").then((m) => m.PipelineChart), {
  ssr: false,
  loading: () => <Skeleton className="h-56 rounded-xl" />,
})
export const TicketTrendChart = dynamic(() => import("./pulse-charts").then((m) => m.TicketTrendChart), {
  ssr: false,
  loading: () => <Skeleton className="h-56 rounded-xl" />,
})
