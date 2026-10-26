import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { LineChart, BarChart, ScatterChart, HeatmapChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent, MarkLineComponent, VisualMapComponent, AriaComponent, MarkAreaComponent } from 'echarts/components';
import { CanvasRenderer, SVGRenderer } from 'echarts/renderers';
import type { EChartsCoreOption } from 'echarts/core';

echarts.use([LineChart, BarChart, ScatterChart, HeatmapChart, GridComponent, TooltipComponent, LegendComponent, MarkLineComponent, MarkAreaComponent, VisualMapComponent, AriaComponent, CanvasRenderer, SVGRenderer]);

export const FONT = '"IBM Plex Sans", system-ui, sans-serif';
export const INK = '#1d2a44';
export const INK_2 = '#4a5468';
export const INK_3 = '#6b7385';
export const GRID = '#e7e1d6';

/** Shared base options so every chart reads as one system. */
export function baseOption(): EChartsCoreOption {
  return {
    animationDuration: 450,
    animationDurationUpdate: 350,
    textStyle: { fontFamily: FONT, color: INK_2 },
    aria: { enabled: true },
    tooltip: {
      backgroundColor: '#fffdf8',
      borderColor: '#d9d1c3',
      borderWidth: 1,
      padding: [8, 12],
      textStyle: { color: INK, fontFamily: FONT, fontSize: 12 },
      extraCssText: 'box-shadow: 0 6px 24px rgba(29,42,68,.12); border-radius: 6px;',
    },
  };
}

export const axisCommon = {
  axisLine: { lineStyle: { color: '#c9c1b2' } },
  axisTick: { show: false },
  axisLabel: { color: INK_3, fontSize: 11, fontFamily: FONT },
  splitLine: { lineStyle: { color: GRID, type: 'solid' as const } },
  nameTextStyle: { color: INK_3, fontSize: 11, fontFamily: FONT },
};

interface Props {
  option: EChartsCoreOption;
  height: number | string;
  ariaLabel: string;
  onClick?: (params: any) => void;
  renderer?: 'canvas' | 'svg';
}

export default function EChart({ option, height, ariaLabel, onClick, renderer = 'canvas' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  const clickRef = useRef(onClick);
  clickRef.current = onClick;

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const c = echarts.init(el, undefined, { renderer });
    chart.current = c;
    c.on('click', (p) => clickRef.current?.(p));
    const ro = new ResizeObserver(() => c.resize({ width: el.clientWidth, height: el.clientHeight }));
    ro.observe(el);
    return () => {
      ro.disconnect();
      c.dispose();
      chart.current = null;
    };
  }, [renderer]);

  useEffect(() => {
    const c = chart.current, el = ref.current;
    if (!c || !el) return;
    if (c.getWidth() !== el.clientWidth || c.getHeight() !== el.clientHeight) c.resize({ width: el.clientWidth, height: el.clientHeight });
    c.setOption(option, { notMerge: true, lazyUpdate: true });
  }, [option, height]);

  return <div ref={ref} className="echart" style={{ height }} role="img" aria-label={ariaLabel} />;
}
