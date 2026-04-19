import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface Operator {
  id: number;
  name: string;
  team: string;
  email: string;
  role: string;
  created_at: string;
  updated_at: string;
  net_salary: string | null;
}

export const useOperators = () => {
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOperatorById = async (id: number): Promise<{ name: string; team: string; email: string; role: string }> => {
    if (!id || isNaN(id)) return { name: '', team: '', email: '', role: '' };
    try {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('operators')
        .select('name, team, email, role, net_salary')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching operator:', error);
        setError(error.message);
        return { name: '', team: '', email: '', role: '' };
      }

      return {
        name: (data as { name: string; team: string; email: string; role: string; net_salary: string | null } | null)?.name || '',
        team: (data as { name: string; team: string; email: string; role: string; net_salary: string | null } | null)?.team || '',
        email: (data as { name: string; team: string; email: string; role: string; net_salary: string | null } | null)?.email || '',
        role: (data as { name: string; team: string; email: string; role: string; net_salary: string | null } | null)?.role || ''
      };
    } catch (err) {
      console.error('Error fetching operator:', err);
      setError('Failed to fetch operator');
      return { name: '', team: '', email: '', role: '' };
    } finally {
      setLoading(false);
    }
  };

  const fetchAllOperators = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('operators')
        .select('*')
        .order('id');

      if (error) {
        console.error('Error fetching operators:', error);
        setError(error.message);
        return;
      }

      setOperators(data || []);
    } catch (err) {
      console.error('Error fetching operators:', err);
      setError('Failed to fetch operators');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllOperators();
  }, []);

  return {
    operators,
    loading,
    error,
    fetchOperatorById,
    refetch: fetchAllOperators,
  };
};
