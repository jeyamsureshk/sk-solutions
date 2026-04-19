import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export function useCurrentOperatorId() {
  const [operatorId, setOperatorId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const resolveOperatorId = async () => {
      try {
        setLoading(true);
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setOperatorId(null);
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('operator_id, email')
          .eq('id', user.id)
          .maybeSingle();

        if (profile?.operator_id) {
          setOperatorId(profile.operator_id);
          return;
        }

        const email = profile?.email || user.email;
        if (!email) {
          setOperatorId(null);
          return;
        }

        const { data: operator } = await supabase
          .from('operators')
          .select('id')
          .eq('email', email)
          .maybeSingle();

        setOperatorId(operator?.id ?? null);
      } catch (error) {
        console.error('Error resolving current operator id:', error);
        setOperatorId(null);
      } finally {
        setLoading(false);
      }
    };

    resolveOperatorId();
  }, []);

  return { operatorId, loading };
}
