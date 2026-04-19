import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

// Helper to reliably format dates for Postgres in React Native (Hermes engine)
const getLocalYYYYMMDD = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function useFqcInput(selectedDate: Date | null, period: 'day' | 'month' | 'year' = 'day') {
  const [fqcInputs, setFqcInputs] = useState<Record<string, number | string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 1. Fetch Data & Sum for Month/Year
  const fetchFqcInputs = useCallback(async () => {
    if (!selectedDate) return;
    
    setLoading(true);
    try {
      let query = supabase.from('fqc_input').select('model_name, fqc_qty');

      // Determine date range based on period
      if (period === 'day') {
        const dateStr = getLocalYYYYMMDD(selectedDate);
        query = query.eq('entry_date', dateStr);
      } else if (period === 'month') {
        const startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
        const endDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
        query = query.gte('entry_date', getLocalYYYYMMDD(startDate)).lte('entry_date', getLocalYYYYMMDD(endDate));
      } else if (period === 'year') {
        const startDate = new Date(selectedDate.getFullYear(), 0, 1);
        const endDate = new Date(selectedDate.getFullYear(), 11, 31);
        query = query.gte('entry_date', getLocalYYYYMMDD(startDate)).lte('entry_date', getLocalYYYYMMDD(endDate));
      }

      const { data, error } = await query;
      if (error) throw error;

      // Aggregate the sums
   const inputs: Record<string, number> = {};
      const nameMap: Record<string, string> = {}; // Keeps track of the original formatting

      if (data) {
        data.forEach((item: { model_name: string; fqc_qty: number }) => {
          // 1. Normalize: convert to lowercase and remove spaces (\s) and hyphens (-)
          const normalizedName = item.model_name.toLowerCase().replace(/[\s-]/g, '');
          
          // 2. Store the first original name we see for this model so the UI doesn't break
          if (!nameMap[normalizedName]) {
            nameMap[normalizedName] = item.model_name;
          }
          
          // Use the consistent original name as the key
          const keyToUse = nameMap[normalizedName];

          // 3. Add them up. If month/year it sums them, if day it just assigns it.
          inputs[keyToUse] = (inputs[keyToUse] || 0) + item.fqc_qty;
        });
      }
      
      setFqcInputs(inputs);
    } catch (error) {
      console.error('Failed to fetch FQC inputs:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, period]);

  useEffect(() => {
    fetchFqcInputs();
  }, [fetchFqcInputs]);

  // 2. Save Data (Only ever called if period === 'day')
  const saveFqcInputs = async () => {
    if (!selectedDate) return { success: false, message: 'No date selected' };
    if (period !== 'day') return { success: false, message: 'Can only save on daily view.' };
    
    setSaving(true);
    try {
      const dateStr = getLocalYYYYMMDD(selectedDate);
      
      const payload = Object.entries(fqcInputs)
        .filter(([_, qty]) => qty !== '' && qty !== undefined && qty !== null)
        .map(([model, qty]) => ({
          entry_date: dateStr,
          model_name: model,
          fqc_qty: typeof qty === 'string' ? (parseInt(qty, 10) || 0) : qty,
        }));

      if (payload.length === 0) {
        return { success: false, message: 'No valid data to save.' };
      }

      const { error } = await supabase
        .from('fqc_input')
        .upsert(payload, { onConflict: 'entry_date,model_name' });

      if (error) throw error;

      return { success: true, message: 'FQC inputs saved successfully!' };
    } catch (error: any) {
      console.error('Failed to save FQC inputs:', error);
      return { success: false, message: error.message || 'An error occurred while saving.' };
    } finally {
      setSaving(false);
    }
  };

  const updateInput = (modelName: string, value: string | number) => {
    setFqcInputs(prev => ({ ...prev, [modelName]: value }));
  };

  return { fqcInputs, loading, saving, updateInput, saveFqcInputs, refetch: fetchFqcInputs };
}
