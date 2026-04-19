import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { CycleTimeRecord, CycleTimeRecordInsert } from '@/types/database';

export const useCycleTime = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addCycleTimeRecord = async (data: CycleTimeRecordInsert): Promise<{ success: boolean; error?: any; data?: CycleTimeRecord }> => {
    try {
      setLoading(true);
      setError(null);

      const { data: result, error } = await supabase
        .from('cycle_time_records')
        .insert(data)
        .select()
        .single();

      if (error) {
        console.error('Error adding cycle time record:', error);
        setError(error.message);
        return { success: false, error: error.message };
      }

      return { success: true, data: result };
    } catch (err) {
      console.error('Error adding cycle time record:', err);
      const errorMessage = 'Failed to add cycle time record';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const updateCycleTimeRecord = async (id: string, data: Partial<CycleTimeRecordInsert>): Promise<{ success: boolean; error?: any; data?: CycleTimeRecord }> => {
    try {
      setLoading(true);
      setError(null);

      const { data: result, error } = await supabase
        .from('cycle_time_records')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating cycle time record:', error);
        setError(error.message);
        return { success: false, error: error.message };
      }

      return { success: true, data: result };
    } catch (err) {
      console.error('Error updating cycle time record:', err);
      const errorMessage = 'Failed to update cycle time record';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const getCycleTimeRecords = async (): Promise<{ success: boolean; error?: any; data?: CycleTimeRecord[] }> => {
    try {
      setLoading(true);
      setError(null);

      const { data: result, error } = await supabase
        .from('cycle_time_records')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching cycle time records:', error);
        setError(error.message);
        return { success: false, error: error.message };
      }

      return { success: true, data: result || [] };
    } catch (err) {
      console.error('Error fetching cycle time records:', err);
      const errorMessage = 'Failed to fetch cycle time records';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    addCycleTimeRecord,
    updateCycleTimeRecord,
    getCycleTimeRecords,
  };
};
