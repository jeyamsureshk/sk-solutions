import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { PeriodType, SelectedDate, TrendPoint } from '@/types/summary';

export function useOverallTrend(selectedDate: SelectedDate, period: PeriodType) {
  const [data, setData] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOverallTrend = async () => {
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
        .select('date, hour, units_produced, target_units')
        .gte('date', startDateStr)
        .lte('date', endDateStr);

      if (error) throw error;

      const grouped: Record<string, { produced: number; target: number }> = {};

      records?.forEach(record => {
        let key: string;

        if (period === 'day') {
          key = record.hour?.toString() ?? '0';
        } else if (period === 'month') {
          key = record.date;
        } else {
          const date = new Date(record.date);
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        }

        if (!grouped[key]) grouped[key] = { produced: 0, target: 0 };
        grouped[key].produced += record.units_produced;
        grouped[key].target += record.target_units;
      });

      const formatLabel = (key: string): string => {
  if (period === 'day') {
    const hourValue = parseFloat(key);
    const hours = Math.floor(hourValue);
    const minutes = Math.round((hourValue - hours) * 60);
    const date = new Date();
    date.setHours(hours, minutes);

    // 24-hour format
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      hour12: false,
    });
  }
  if (period === 'month') {
    const date = new Date(key);
    return date.getDate().toString(); // numeric day only
  }
  const [year, month] = key.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-US', { month: 'short' });
};


      const trend = Object.keys(grouped)
        .sort((a, b) => (period === 'day' ? parseFloat(a) - parseFloat(b) : a.localeCompare(b)))
        .map(key => {
          const { produced, target } = grouped[key];
          const efficiency = target > 0 ? (produced / target) * 100 : 0;
          return {
            x: formatLabel(key),
            y: Math.round(efficiency * 10) / 10,
          };
        });

      setData(trend);
    } catch (error) {
      console.error('Error fetching overall trend:', error);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverallTrend();

    const channel = supabase
      .channel('overall_trend_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'production_records',
        },
        () => {
          fetchOverallTrend();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedDate, period]);

  return { data, loading, refetch: fetchOverallTrend };
}

