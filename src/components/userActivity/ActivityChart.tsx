import { useEffect, useRef } from 'react';
import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  type ChartConfiguration,
} from 'chart.js';

Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  Legend
);

const PALETTE = ['#7F77DD', '#378ADD', '#1D9E75', '#D85A30', '#D4537E', '#BA7517', '#534AB7', '#60a5fa'];

interface ActivityChartProps {
  title: string;
  config: ChartConfiguration | null;
  height?: number;
  emptyMessage?: string;
}

/** Renders a Chart.js chart with cleanup on data change. */
export function ActivityChart({
  title,
  config,
  height = 220,
  emptyMessage = 'No data in this range',
}: ActivityChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !config) {
      chartRef.current?.destroy();
      chartRef.current = null;
      return;
    }
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    chartRef.current?.destroy();
    chartRef.current = new Chart(ctx, config);
    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [config]);

  return (
    <div className="panel-surface p-4 h-full flex flex-col">
      <h3 className="text-[11px] font-medium text-ink uppercase tracking-[0.04em] mb-3">{title}</h3>
      {config ? (
        <div className="flex-1 min-h-0" style={{ height }}>
          <canvas ref={canvasRef} />
        </div>
      ) : (
        <p className="text-[13px] text-muted2 py-8 text-center flex-1 flex items-center justify-center">
          {emptyMessage}
        </p>
      )}
    </div>
  );
}

export { PALETTE };

const baseOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: { color: '#71717a', boxWidth: 12, font: { size: 11 } },
    },
  },
  scales: {
    x: {
      ticks: { color: '#71717a', font: { size: 10 }, maxRotation: 45, minRotation: 0 },
      grid: { color: 'rgba(0,0,0,0.06)' },
    },
    y: {
      beginAtZero: true,
      ticks: { color: '#71717a', font: { size: 10 }, precision: 0 },
      grid: { color: 'rgba(0,0,0,0.06)' },
    },
  },
};

/** Bar chart: batches per user. */
export function batchesByUserChart(
  labels: string[],
  batches: number[],
  invoices: number[]
): ChartConfiguration | null {
  if (labels.length === 0) return null;
  return {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Batches',
          data: batches,
          backgroundColor: PALETTE[0],
          borderRadius: 4,
        },
        {
          label: 'Invoices',
          data: invoices,
          backgroundColor: PALETTE[1],
          borderRadius: 4,
        },
      ],
    },
    options: {
      ...baseOptions,
      plugins: { ...baseOptions.plugins, legend: { display: true, position: 'top' } },
    },
  };
}

/** Line chart: daily batch volume. */
export function activityByDateChart(
  labels: string[],
  batches: number[]
): ChartConfiguration | null {
  if (labels.length === 0) return null;
  return {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Batches',
          data: batches,
          borderColor: PALETTE[0],
          backgroundColor: 'rgba(127, 119, 221, 0.15)',
          fill: true,
          tension: 0.25,
          pointRadius: labels.length > 14 ? 0 : 3,
        },
      ],
    },
    options: {
      ...baseOptions,
      plugins: { ...baseOptions.plugins, legend: { display: false } },
    },
  };
}

/** Horizontal bar: top clients. */
export function topClientsChart(
  labels: string[],
  batches: number[]
): ChartConfiguration | null {
  if (labels.length === 0) return null;
  return {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Batches',
          data: batches,
          backgroundColor: PALETTE.slice(0, labels.length),
          borderRadius: 4,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      ...baseOptions,
      plugins: { ...baseOptions.plugins, legend: { display: false } },
    },
  };
}

/** Stacked bar: verified vs unverified per user. */
export function verificationByUserChart(
  labels: string[],
  verified: number[],
  unverified: number[]
): ChartConfiguration | null {
  if (labels.length === 0) return null;
  return {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Verified',
          data: verified,
          backgroundColor: '#1D9E75',
          borderRadius: 4,
        },
        {
          label: 'Not verified',
          data: unverified,
          backgroundColor: '#D85A30',
          borderRadius: 4,
        },
      ],
    },
    options: {
      ...baseOptions,
      scales: {
        ...baseOptions.scales,
        x: { ...baseOptions.scales.x, stacked: true },
        y: { ...baseOptions.scales.y, stacked: true },
      },
      plugins: { ...baseOptions.plugins, legend: { display: true, position: 'top' } },
    },
  };
}
