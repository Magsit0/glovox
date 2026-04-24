import { CHART_SERIES, seriesColor } from "@/lib/chart-colors";

export const CHART_PALETTE: readonly string[] = CHART_SERIES;

export const pickColor = (index: number): string => seriesColor(index);
