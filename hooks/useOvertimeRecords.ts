import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { OvertimeRecord, OvertimeRecordInsert, OvertimeRecordUpdate } from '@/types/database';

interface OvertimeFilters {
  operatorId?: number;
  year?: number;
  month?: number;
  fromDate?: string;
  toDate?: string;
  approved?: boolean;
}

export function useOvertimeRecords(filters: OvertimeFilters = {}) {
  const [records, setRecords] = useState<OvertimeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { operatorId, year, month, fromDate, toDate, approved } = filters;

  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('overtime_records')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (operatorId) {
        query = query.eq('operator_id', operatorId);
      }
      if (year && month) {
        const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
        const nextMonth = month === 12 ? 1 : month + 1;
        const nextYear = month === 12 ? year + 1 : year;
        const monthEnd = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
        query = query.gte('date', monthStart).lt('date', monthEnd);
      }
      if (fromDate) query = query.gte('date', fromDate);
      if (toDate) query = query.lte('date', toDate);
      if (approved !== undefined) query = query.eq('approved', approved);

      const { data, error } = await query;

      if (error) throw error;
      setRecords(data || []);
    } catch (error) {
      console.error('Error fetching overtime records:', error);
    } finally {
      setLoading(false);
    }
  }, [operatorId, year, month, fromDate, toDate, approved]);

  const addRecord = async (record: OvertimeRecordInsert) => {
    try {
      const { error } = await supabase.from('overtime_records').insert(record);
      if (error) throw error;
      await fetchRecords();
      return { success: true };
    } catch (error) {
      console.error('Error adding overtime record:', error);
      return { success: false, error };
    }
  };

  const updateRecord = async (id: string, updates: OvertimeRecordUpdate) => {
    try {
      const { error } = await supabase
        .from('overtime_records')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
      await fetchRecords();
      return { success: true };
    } catch (error) {
      console.error('Error updating overtime record:', error);
      return { success: false, error };
    }
  };

  const deleteRecord = async (id: string) => {
    try {
      const { error } = await supabase.from('overtime_records').delete().eq('id', id);
      if (error) throw error;
      await fetchRecords();
      return { success: true };
    } catch (error) {
      console.error('Error deleting overtime record:', error);
      return { success: false, error };
    }
  };

  useEffect(() => {
    fetchRecords();

    const channel = supabase
      .channel('overtime_records_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'overtime_records' }, 
        () => fetchRecords()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchRecords]);

  return {
    records,
    loading,
    fetchRecords,
    addRecord,
    updateRecord,
    deleteRecord,
  };
}
