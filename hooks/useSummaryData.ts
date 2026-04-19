import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { SummaryData, PeriodType, SelectedDate } from '@/types/summary';

// 🔑 Helper: normalize model names (lowercase, no spaces)
function normalizeModelName(name: string): string {
  return name.replace(/\s+/g, '').toLowerCase();
}

export function useSummaryData(selectedDate: SelectedDate, period: PeriodType) {
  const [data, setData] = useState<SummaryData>({
    totalUnitsProduced: 0,
    totalTargetUnits: 0,
    averageEfficiency: 0,
    recordCount: 0,
    teamSummaries: [],
  });
  const [loading, setLoading] = useState(true);

  const fetchSummary = async () => {
    try {
      setLoading(true);

      let startDateStr: string | undefined;
      let endDateStr: string | undefined;

      if (period === 'day') {
        const dateStr = selectedDate.toLocaleDateString('sv-SE'); // "YYYY-MM-DD"
        startDateStr = dateStr;
        endDateStr = dateStr;
      } else if (period === 'month') {
        const startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
        const endDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
        startDateStr = startDate.toLocaleDateString('sv-SE');
        endDateStr = endDate.toLocaleDateString('sv-SE');
      } else if (period === 'year') {
        const startDate = new Date(selectedDate.getFullYear(), 0, 1);
        const endDate = new Date(selectedDate.getFullYear(), 12, 0);
        startDateStr = startDate.toLocaleDateString('sv-SE');
        endDateStr = endDate.toLocaleDateString('sv-SE');
      }

      if (!startDateStr || !endDateStr) {
        throw new Error(`Invalid period: ${period}`);
      }

      const { data: records, error } = await supabase
        .from('production_records')
        .select('units_produced, target_units, team, item')
        .gte('date', startDateStr)
        .lte('date', endDateStr) as { data: any[] | null; error: any };

      if (error) throw error;

      if (records && records.length > 0) {
        const totalProduced = records.reduce((sum, r) => sum + r.units_produced, 0);
        const totalTarget = records.reduce((sum, r) => sum + r.target_units, 0);
        const avgEfficiency = totalTarget > 0 ? (totalProduced / totalTarget) * 100 : 0;

        const teamGroups = records.reduce((groups: Record<string, any[]>, record) => {
          const team = record.team || 'Unknown';
          if (!groups[team]) groups[team] = [];
          groups[team].push(record);
          return groups;
        }, {});

        const teamOrder = [
            'IQC',
            'Stores',
            'Kitting',
            'SMT',
            'Cleaning',
            'THT Panel',
            'THT Accessories',
            'FG Panel',
            'FG Accessories',
            'FQC Panel',
            'FQC Accessories',
            'Packing Panel',
            'Packing Accessories',
            'Logistics',
            'Accounts',
            'Administration',
            'Customer Support',
            'D&D',
            'Engineering',
            'Fabrication',
            'Human Resources',
            'IT',
            'Maintenance',
            'Products',
            'Sales & Marketing',
            'SAP',
            'SCM',
        ];

        const teamSummaries = teamOrder
          .filter(team => teamGroups[team])
          .map(team => {
            const teamRecords = teamGroups[team];
            const teamProduced = teamRecords.reduce((sum, r) => sum + r.units_produced, 0);
            const teamTarget = teamRecords.reduce((sum, r) => sum + r.target_units, 0);
            const teamEfficiency = teamTarget > 0 ? (teamProduced / teamTarget) * 100 : 0;

            // ✅ Aggregate model quantities with normalization
            const modelMap = new Map<string, { displayName: string; totalQuantity: number; recordCount: number }>();
            teamRecords.forEach(record => {
              if (record.item && Array.isArray(record.item)) {
                record.item.forEach((item: { model: string; quantity: string | number }) => {
                  if (item.model && item.quantity) {
                    const normalizedModel = normalizeModelName(item.model);
                    const quantity =
                      typeof item.quantity === 'string'
                        ? parseInt(item.quantity) || 0
                        : item.quantity;

                    const existing = modelMap.get(normalizedModel) || {
                      displayName: item.model, // keep first seen original for display
                      totalQuantity: 0,
                      recordCount: 0,
                    };

                    modelMap.set(normalizedModel, {
                      displayName: existing.displayName,
                      totalQuantity: existing.totalQuantity + quantity,
                      recordCount: existing.recordCount + 1,
                    });
                  }
                });
              }
            });

            const modelSummaries = Array.from(modelMap.values()).map(data => ({
              model: data.displayName, // show original name
              totalQuantity: data.totalQuantity,
              recordCount: data.recordCount,
            }));

            return {
              team,
              unitsProduced: teamProduced,
              targetUnits: teamTarget,
              efficiency: teamEfficiency,
              recordCount: teamRecords.length,
              modelSummaries,
            };
          });

        setData({
          totalUnitsProduced: totalProduced,
          totalTargetUnits: totalTarget,
          averageEfficiency: avgEfficiency,
          recordCount: records.length,
          teamSummaries,
        });
      } else {
        setData({
          totalUnitsProduced: 0,
          totalTargetUnits: 0,
          averageEfficiency: 0,
          recordCount: 0,
          teamSummaries: [],
        });
      }
    } catch (error) {
      console.error('Error fetching summary:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();

    const channel = supabase
      .channel('summary_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'production_records',
        },
        () => {
          fetchSummary();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedDate, period]);

  return { data, loading, refetch: fetchSummary };
}

