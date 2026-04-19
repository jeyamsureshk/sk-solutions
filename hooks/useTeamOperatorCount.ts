import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface TeamOperatorCount {
  team: string;
  count: number;
}

export const useTeamOperatorCount = () => {
  const [data, setData] = useState<TeamOperatorCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTeamOperatorCount = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: operators, error } = await supabase
        .from('operators')
        .select('team');

      if (error) {
        console.error('Error fetching operators:', error);
        setError(error.message);
        return;
      }

      if (operators && operators.length > 0) {
        const teamCounts: Record<string, number> = {};

        operators.forEach((operator: { team: string }) => {
          const team = operator.team?.trim() || 'Unknown';
          teamCounts[team] = (teamCounts[team] || 0) + 1;
        });

        const teamOrder = [
          'SMT',
          'THT Panel',
          'THT Module',
          'FG Panel',
          'FG Module',
          'Packing Panel',
          'Packing Module',
          'Quality',
          'SAP',
          'SCM'
        ];

        const sortedData = teamOrder
          .filter(team => teamCounts[team])
          .map(team => ({
            team,
            count: teamCounts[team],
          }));

        setData(sortedData);
      } else {
        setData([]);
      }
    } catch (err) {
      console.error('Error fetching team operator counts:', err);
      setError('Failed to fetch team operator counts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamOperatorCount();

    const channel = supabase
      .channel('team_operators_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'operators',
        },
        () => {
          fetchTeamOperatorCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { data, loading, error, refetch: fetchTeamOperatorCount };
};
