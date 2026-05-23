import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase'; // Adjust import to your Supabase client

export interface PlanRecord {
  plan_qty: number;
  remarks: string;
  eta: string;
}

export function usePlanInput(selectedDate: Date, period: 'day' | 'month' | 'year') {
  const [planData, setPlanData] = useState<Record<string, PlanRecord>>({});
  const [savingPlan, setSavingPlan] = useState(false);

  useEffect(() => {
    const fetchPlanData = async () => {
      try {
        const date = new Date(selectedDate);
        let startDate: string;
        let endDate: string;

        // Determine date range based on period
        if (period === 'day') {
          startDate = date.toISOString().split('T')[0];
          endDate = startDate;
        } else if (period === 'month') {
          const start = new Date(date.getFullYear(), date.getMonth(), 1);
          const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
          startDate = start.toISOString().split('T')[0];
          endDate = end.toISOString().split('T')[0];
        } else {
          // year
          const start = new Date(date.getFullYear(), 0, 1);
          const end = new Date(date.getFullYear(), 11, 31);
          startDate = start.toISOString().split('T')[0];
          endDate = end.toISOString().split('T')[0];
        }

        const { data, error } = await supabase
          .from('plan')
          .select('model_name, plan_qty, remarks, eta')
          .gte('entry_date', startDate)
          .lte('entry_date', endDate);

        if (error) throw error;

        const loadedData: Record<string, PlanRecord> = {};
        
        if (data) {
          data.forEach((item) => {
            if (!loadedData[item.model_name]) {
              loadedData[item.model_name] = { plan_qty: 0, remarks: '', eta: '' };
            }
            
            // Sum the quantities for month/year view
            loadedData[item.model_name].plan_qty += (item.plan_qty || 0);
            
            // Only populate remarks and eta if we are on the day view
            // (Aggregating text for months/years gets messy)
            if (period === 'day') {
              loadedData[item.model_name].remarks = item.remarks || '';
              loadedData[item.model_name].eta = item.eta || '';
            }
          });
        }
        
        setPlanData(loadedData);
      } catch (error) {
        console.error('Error fetching plan data:', error);
      }
    };

    fetchPlanData();
  }, [selectedDate, period]);

  const updatePlan = (model: string, field: keyof PlanRecord, value: string | number) => {
    setPlanData((prev) => ({
      ...prev,
      [model]: {
        ...(prev[model] || { plan_qty: 0, remarks: '', eta: '' }),
        [field]: value,
      },
    }));
  };

  const savePlanData = async () => {
    if (period !== 'day') return { success: false, message: 'Can only save on day view' };
    
    setSavingPlan(true);
    try {
      const dateString = selectedDate.toISOString().split('T')[0];
      
      const upsertPayload = Object.keys(planData).map((model) => {
        const record = planData[model];
        return {
          entry_date: dateString,
          model_name: model,
          plan_qty: record.plan_qty || 0,
          remarks: record.remarks && record.remarks.trim() !== '' ? record.remarks : null,
          eta: record.eta && record.eta.trim() !== '' ? record.eta : null, 
        };
      });

      if (upsertPayload.length === 0) {
         return { success: true, message: 'Nothing to save.' };
      }

      const { error } = await supabase.from('plan').upsert(upsertPayload);
      
      if (error) throw error;
      
      return { success: true, message: 'Plan saved successfully!' };
    } catch (error: any) {
      console.error('Save Plan Error:', error);
      return { success: false, message: error.message || 'Failed to save plan' };
    } finally {
      setSavingPlan(false);
    }
  };

  return { planData, savingPlan, updatePlan, savePlanData };
}
