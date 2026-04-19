import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { PeriodType, SelectedDate } from '@/types/summary';

export interface ChartDataPoint {
  x: string;
  y: number;
  team: string;
}

export function useChartData(selectedDate: SelectedDate, period: PeriodType) {
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchChartData = async () => {
    try {
      setLoading(true);

      let startDateStr: string;
      let endDateStr: string;

      if (period === 'day') {
        startDateStr = selectedDate.toISOString().split('T')[0];
        endDateStr = startDateStr;
      } else if (period === 'month') {
        const startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
        const endDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
        startDateStr = startDate.toISOString().split('T')[0];
        endDateStr = endDate.toISOString().split('T')[0];
      } else {
        const startDate = new Date(selectedDate.getFullYear(), 0, 1);
        const endDate = new Date(selectedDate.getFullYear(), 11, 31);
        startDateStr = startDate.toISOString().split('T')[0];
        endDateStr = endDate.toISOString().split('T')[0];
      }

      const { data: records, error } = await supabase
        .from('production_records')
        .select('date, hour, units_produced, target_units, team')
        .gte('date', startDateStr)
        .lte('date', endDateStr);

      if (error) throw error;

      if (records && records.length > 0) {
        const grouped: Record<string, Record<string, { produced: number; target: number }>> = {};

        records.forEach((record: any) => {
          const team = record.team ?? 'Unknown';
          let key: string;

          if (period === 'day') {
            key = record.hour?.toString().padStart(2, '0') ?? '00';
          } else if (period === 'month') {
            key = record.date;
          } else {
            const date = new Date(record.date);
            key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          }

          if (!grouped[team]) grouped[team] = {};
          if (!grouped[team][key]) grouped[team][key] = { produced: 0, target: 0 };

          grouped[team][key].produced += record.units_produced;
          grouped[team][key].target += record.target_units;
        });

        const chartData: ChartDataPoint[] = [];

        Object.entries(grouped).forEach(([team, timeGroups]) => {
          Object.keys(timeGroups)
            .sort((a, b) => (period === 'day' ? parseInt(a) - parseInt(b) : a.localeCompare(b)))
            .forEach(key => {
              const { produced, target } = timeGroups[key];
              const efficiency = target > 0 ? (produced / target) * 100 : 0;

              let label: string;
              if (period === 'day') {
                label = `${key}`;
              } else if (period === 'month') {
                const date = new Date(key);
                label = date.toLocaleDateString('en-US', {day: 'numeric' });
              } else {
                const [year, month] = key.split('-');
                const date = new Date(parseInt(year), parseInt(month) - 1);
                label = date.toLocaleDateString('en-US', { month: 'short' });
              }

              chartData.push({
                x: label,
                y: Math.round(efficiency * 10) / 10,
                team,
              });
            });
        });

        setData(chartData);
      } else {
        setData([]);
      }
    } catch (error) {
      console.error('Error fetching chart data:', error);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChartData();

    const channel = supabase
      .channel('chart_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'production_records',
        },
        () => {
          fetchChartData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedDate, period]);

  return { data, loading, refetch: fetchChartData };
}

