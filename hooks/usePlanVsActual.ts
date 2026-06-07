// hooks/usePlanVsActual.ts

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface PlanVsActualRow {
  fg_part_number: string;
  model_name: string;
  category: string;
  plan_qty: number;
  actual: number;
  remarks: string;
  eta: string;
  team: string;
}

export const usePlanVsActual = (
  selectedDate: Date
) => {
  const [rows, setRows] = useState<PlanVsActualRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  const fetchData = async () => {
    try {
      setLoading(true);

      const dateStr = selectedDate
        .toISOString()
        .split('T')[0];

      // 1. Fetch item master
      const { data: itemsData } = await supabase
        .from('items')
        .select(
          'part_id, description, model, item_group'
        );

      // 2. Fetch plan
      const { data: planData } = await supabase
        .from('plan')
        .select('*')
        .eq('entry_date', dateStr);

      // 3. Fetch production
      const { data: prodData } = await supabase
        .from('production_records')
        .select('item, team')
        .eq('date', dateStr);

      const actualQtyMap: Record<string, number> = {};
      const actualTeamMap: Record<string, string> = {};

      // Calculate actual qty
      if (prodData) {
        prodData.forEach((record: any) => {
          if (Array.isArray(record.item)) {
            record.item.forEach((i: any) => {
              if (i.model) {
                actualQtyMap[i.model] =
                  (actualQtyMap[i.model] || 0) +
                  (Number(i.quantity) || 0);

                actualTeamMap[i.model] =
                  record.team ||
                  actualTeamMap[i.model];
              }
            });
          }
        });
      }

      // Merge models
      const allModels = new Set([
        ...(planData || []).map(
          (p: any) => p.model_name
        ),
        ...Object.keys(actualQtyMap),
      ]);

      const rowsData: PlanVsActualRow[] =
        Array.from(allModels).map((model) => {
          const planObj = planData?.find(
            (p: any) => p.model_name === model
          );

          const itemObj = itemsData?.find(
            (i: any) => i.model === model
          );

          const planQty =
            planObj?.plan_qty || 0;

          const actualQty =
            actualQtyMap[model] || 0;

          const teamAssigned =
            planObj?.team ||
            actualTeamMap[model] ||
            '';

          let category =
            itemObj?.item_group || 'SFG';

          const teamLower =
            teamAssigned.toLowerCase();

          if (teamLower.includes('panel')) {
            category = 'Panel';
          } else if (
            teamLower.includes('accessories')
          ) {
            category = 'Accessories';
          }

          let remarks =
            planObj?.remarks || '';

          if (!remarks) {
            if (
              actualQty >= planQty &&
              planQty > 0
            ) {
              remarks = 'Completed';
            } else {
              remarks = 'Pending Plan';
            }
          }

          return {
            fg_part_number:
              itemObj?.part_id || '-',
            model_name: model,
            category,
            plan_qty: planQty,
            actual: actualQty,
            remarks,
            eta: planObj?.eta || '',
            team: teamAssigned,
          };
        });

      // Sort category
      const catOrder: Record<string, number> = {
        Panel: 1,
        Accessories: 2,
      };

      rowsData.sort((a, b) => {
        const diff =
          (catOrder[a.category] || 3) -
          (catOrder[b.category] || 3);

        if (diff !== 0) return diff;

        return a.model_name.localeCompare(
          b.model_name
        );
      });

      setRows(rowsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return {
    rows,
    loading,
    refresh: fetchData,
  };
};
