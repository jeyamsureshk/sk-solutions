import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Profile } from '@/types/database';

export const useProfiles = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfileById = async (id: string): Promise<Profile | null> => {
    if (!id) return null;
    try {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        setError(error.message);
        return null;
      }

      return data;
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError('Failed to fetch profile');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const fetchAllProfiles = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching profiles:', error);
        setError(error.message);
        return;
      }

      setProfiles(data || []);
    } catch (err) {
      console.error('Error fetching profiles:', err);
      setError('Failed to fetch profiles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllProfiles();
  }, []);

  return {
    profiles,
    loading,
    error,
    fetchProfileById,
    refetch: fetchAllProfiles,
  };
};
