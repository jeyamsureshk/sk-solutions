// hooks/useLastMessages.ts
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export function useLastMessages(userId?: string) {
  const [lastMessages, setLastMessages] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!userId) return;

    const fetchLastMessages = async () => {
      // Example: assuming you have a "messages" table with sender_id, receiver_id, content, created_at
      const { data, error } = await supabase
        .from('messages')
        .select('id, content, sender_id, receiver_id, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        console.error(error);
        return;
      }

      const map: Record<string, string> = {};
      data.forEach(msg => {
        const otherId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
        if (!map[otherId]) {
          map[otherId] = msg.content;
        }
      });
      setLastMessages(map);
    };

    fetchLastMessages();
  }, [userId]);

  return { lastMessages };
}

