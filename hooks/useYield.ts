import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Yield, YieldInsert, YieldUpdate } from '@/types/database';

export const useYield = () => {
  const [yieldRecords, setYieldRecords] = useState<Yield[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchYieldRecords = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('yield')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching yield records:', error);
        setError(error.message);
        return;
      }

      setYieldRecords(data || []);
    } catch (err) {
      console.error('Error fetching yield records:', err);
      setError('Failed to fetch yield records');
    } finally {
      setLoading(false);
    }
  };

  const addYieldRecord = async (data: YieldInsert): Promise<{ success: boolean; error?: any }> => {
    try {
      const { data: result, error } = await supabase
        .from('yield')
        .insert(data)
        .select()
        .single();

      if (error) {
        console.error('Error adding yield record:', error);
        return { success: false, error: error.message };
      }

      setYieldRecords(prev => [result, ...prev]);
      return { success: true };
    } catch (err) {
      console.error('Error adding yield record:', err);
      return { success: false, error: 'Failed to add yield record' };
    }
  };

  const updateYieldRecord = async (id: string, data: YieldUpdate): Promise<{ success: boolean; error?: any }> => {
    try {
      const { data: result, error } = await supabase
        .from('yield')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating yield record:', error);
        return { success: false, error: error.message };
      }

      setYieldRecords(prev => prev.map(record =>
        record.id === id ? result : record
      ));
      return { success: true };
    } catch (err) {
      console.error('Error updating yield record:', err);
      return { success: false, error: 'Failed to update yield record' };
    }
  };

  const deleteYieldRecord = async (id: string): Promise<{ success: boolean; error?: any }> => {
    try {
      const { error } = await supabase
        .from('yield')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting yield record:', error);
        return { success: false, error: error.message };
      }

      setYieldRecords(prev => prev.filter(record => record.id !== id));
      return { success: true };
    } catch (err) {
      console.error('Error deleting yield record:', err);
      return { success: false, error: 'Failed to delete yield record' };
    }
  };

  useEffect(() => {
    fetchYieldRecords();

    const channel = supabase
      .channel('yield_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'yield',
        },
        () => {
          fetchYieldRecords();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    yieldRecords,
    loading,
    error,
    refetch: fetchYieldRecords,
    addYieldRecord,
    updateYieldRecord,
    deleteYieldRecord,
  };
};
