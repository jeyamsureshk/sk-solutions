import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { CycleTimeRecord, CycleTimeRecordInsert } from '@/types/database';

export const useCycleTime = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolveCycleTimeTeam = (team?: string) => {
    const normalized = team?.trim().toLowerCase();
    if (!normalized) return undefined;

    if (normalized.includes('packing')) return 'Packing';
    if (normalized.includes('tht')) return 'THT';
    if (normalized.includes('fg')) return 'FG';
    if (normalized.includes('fqc')) return 'FQC';
    if (normalized.includes('smt')) return 'SMT';

    return team?.trim();
  };

  const addCycleTimeRecord = async (data: CycleTimeRecordInsert): Promise<{ success: boolean; error?: any; data?: CycleTimeRecord }> => {
    try {
      setLoading(true);
      setError(null);

      const { data: result, error } = await (supabase.from('cycle_time_records') as any)
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

      const { data: result, error } = await (supabase.from('cycle_time_records') as any)
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

  const getCycleTimeRecordByPartNumber = async (partNumber: string, team?: string): Promise<{ success: boolean; error?: any; data?: CycleTimeRecord | null }> => {
    if (!partNumber?.trim()) {
      return { success: true, data: null };
    }

    try {
      setLoading(true);
      setError(null);

      const resolvedTeam = resolveCycleTimeTeam(team);
      const normalizedPartNumbers = partNumber
        .split(',')
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean);

      if (normalizedPartNumbers.length === 0) {
        return { success: true, data: null };
      }

      const { data: records, error } = await supabase
        .from('cycle_time_records')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching cycle time record by part number:', error);
        setError(error.message);
        return { success: false, error: error.message };
      }

      const filteredRecords = (records || []).filter((record: any) => {
        if (resolvedTeam && record.team !== resolvedTeam) {
          return false;
        }

        const storedPartNumbers = (typeof record.part_number === 'string'
          ? record.part_number
          : JSON.stringify(record.part_number || ''))
          .split(',')
          .map((value: string) => value.trim().toUpperCase())
          .filter(Boolean);

        return normalizedPartNumbers.some((partNumberValue) => storedPartNumbers.includes(partNumberValue));
      });

      return { success: true, data: filteredRecords[0] ?? null };
    } catch (err) {
      console.error('Error fetching cycle time record by part number:', err);
      const errorMessage = 'Failed to fetch cycle time record';
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
    getCycleTimeRecordByPartNumber,
  };
};
