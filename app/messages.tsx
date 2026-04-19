import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  View,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useOperators } from '@/hooks/useOperators';
import { useProfiles } from '@/hooks/useProfiles';
import { useUnreadCounts } from '@/hooks/useUnreadCounts';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';

// Custom hook to fetch last messages
function useLastMessages(userId?: string) {
  const [lastMessages, setLastMessages] = useState<Record<string, { content: string; created_at: string }>>({});

  useEffect(() => {
    if (!userId) return;

    const fetchLastMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('id, content, sender_id, receiver_id, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        console.error(error);
        return;
      }

      const map: Record<string, { content: string; created_at: string }> = {};
      data.forEach(msg => {
        const otherId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
        if (!map[otherId]) {
          map[otherId] = { content: msg.content, created_at: msg.created_at };
        }
      });
      setLastMessages(map);
    };

    fetchLastMessages();
  }, [userId]);

  return { lastMessages };
}

export default function MessagesIndex() {
  const router = useRouter();
  const { operators } = useOperators();
  const { profiles } = useProfiles();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const { unreadCounts } = useUnreadCounts(currentUserId || undefined);
  const { lastMessages } = useLastMessages(currentUserId || undefined);

  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        setCurrentUserEmail(user.email);
      }
    };
    fetchUser();
  }, []);

  const validOperators = operators.filter(op =>
    profiles.some(p => p.email === op.email) &&
    op.email !== currentUserEmail
  );

  const filteredOperators = validOperators
  .filter(op =>
    op.name.toLowerCase().includes(searchQuery.toLowerCase())
  )
  .sort((a, b) => {
    const profileA = profiles.find(p => p.email === a.email);
    const profileB = profiles.find(p => p.email === b.email);

    const lastTimeA = profileA ? lastMessages[profileA.id]?.created_at || '' : '';
    const lastTimeB = profileB ? lastMessages[profileB.id]?.created_at || '' : '';

    // ✅ If both have last message times, sort descending (latest first)
    if (lastTimeA && lastTimeB) {
      return new Date(lastTimeB).getTime() - new Date(lastTimeA).getTime();
    }

    // If only one has a last message, put the one with a time first
    if (lastTimeA && !lastTimeB) return -1;
    if (!lastTimeA && lastTimeB) return 1;

    // Fallback: sort by name
    return a.name.localeCompare(b.name);
  });



  const handlePress = (opEmail: string) => {
    const profile = profiles.find(p => p.email === opEmail);
    if (!profile) return;
    router.push(`/messages/${profile.id}`);
  };

  const formatTime = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={['#2563eb', '#1e40af']} style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search member..."
          placeholderTextColor="#888"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </LinearGradient>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {filteredOperators.map(op => {
          const profile = profiles.find(p => p.email === op.email);
          const unreadCount = profile ? unreadCounts[profile.id] || 0 : 0;
          const lastMessage = profile ? lastMessages[profile.id]?.content || '' : '';
          const lastTime = profile ? lastMessages[profile.id]?.created_at || '' : '';

          return (
            <TouchableOpacity
              key={op.email}
              style={styles.memberCard}
              activeOpacity={0.85}
              onPress={() => handlePress(op.email)}
            >
              {/* Avatar */}
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{op.name.charAt(0)}</Text>
              </View>

              {/* Text Section */}
<View style={styles.textContainer}>
  <View style={styles.nameRow}>
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Text style={[styles.memberName, unreadCount > 0 && styles.unreadName]}>
        {op.name}
      </Text>
      {unreadCount > 0 && (
        <View style={styles.badgeInline}>
          <Text style={styles.badgeText}>{unreadCount}</Text>
        </View>
      )}
    </View>
    {lastTime !== '' && (
      <Text style={styles.timeText}>{formatTime(lastTime)}  </Text>
    )}
  </View>
  {lastMessage !== '' && (
    <Text style={styles.lastMessage} numberOfLines={1}>
      {lastMessage}
    </Text>
  )}
</View>

            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f3f4f6' },

  header: {
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    elevation: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingVertical: 20 },

  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#eff',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#2563eb',
  },

  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },

  textContainer: { flex: 1 },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  memberName: { fontSize: 16, fontWeight: '800', color: '#111' },
  unreadName: { fontWeight: '700', color: '#000' },
  lastMessage: { fontSize: 14, color: '#999', marginTop: 4 },
  timeText: { fontSize: 12, color: '#999', marginLeft: 8 },

  badge: {
    backgroundColor: '#dc2626',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  badgeInline: {
  backgroundColor: '#dc2626',
  borderRadius: 10,
  paddingHorizontal: 6,
  paddingVertical: 1,
  marginLeft: 6,
  minWidth: 20,
  alignItems: 'center',
  justifyContent: 'center',
},
badgeText: {
  color: '#fff',
  fontSize: 11,
  fontWeight: '700',
},
});

