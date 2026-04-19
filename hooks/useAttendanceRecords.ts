import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { AttendanceRecord, AttendanceRecordInsert, AttendanceRecordUpdate } from '@/types/database';

interface AttendanceFilters {
  operatorId?: number;
  year?: number;
  month?: number; // 1-12
  fromDate?: string;
  toDate?: string;
}

export function useAttendanceRecords(filters: AttendanceFilters = {}) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { operatorId, year, month, fromDate, toDate } = filters;

  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('attendance_records')
        .select('*')
        .order('date', { ascending: false });

      // Apply filters
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

      const { data, error } = await query;

      if (error) throw error;
      setRecords(data || []);
    } catch (error) {
      console.error('Error fetching attendance records:', error);
    } finally {
      setLoading(false);
    }
  }, [operatorId, year, month, fromDate, toDate]);

  const addRecord = async (record: AttendanceRecordInsert) => {
    try {
      const { error } = await supabase.from('attendance_records').insert(record);
      if (error) throw error;
      await fetchRecords();
      return { success: true };
    } catch (error) {
      console.error('Error adding attendance record:', error);
      return { success: false, error };
    }
  };

  const updateRecord = async (id: string, updates: AttendanceRecordUpdate) => {
    try {
      const { error } = await supabase
        .from('attendance_records')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
      await fetchRecords();
      return { success: true };
    } catch (error) {
      console.error('Error updating attendance record:', error);
      return { success: false, error };
    }
  };

  const deleteRecord = async (id: string) => {
    try {
      const { error } = await supabase.from('attendance_records').delete().eq('id', id);
      if (error) throw error;
      await fetchRecords();
      return { success: true };
    } catch (error) {
      console.error('Error deleting attendance record:', error);
      return { success: false, error };
    }
  };

  useEffect(() => {
    fetchRecords();

    const channel = supabase
      .channel('attendance_records_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'attendance_records' }, 
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
