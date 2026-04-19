import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export const useTeams = () => {
  const [teams, setTeams] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTeams = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('operators')
        .select('team')
        .order('team');

      if (error) {
        console.error('Error fetching teams:', error);
        setError(error.message);
        return;
      }

      // Get distinct teams
      const distinctTeams = [...new Set((data as { team: string }[] | null)?.map(item => item.team) || [])];
      setTeams(distinctTeams);
    } catch (err) {
      console.error('Error fetching teams:', err);
      setError('Failed to fetch teams');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  return {
    teams,
    loading,
    error,
    refetch: fetchTeams,
  };
};
