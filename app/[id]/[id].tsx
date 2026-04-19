import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Modal,
  StatusBar,
  Easing,
  Keyboard, // Import Keyboard
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import uuid from 'react-native-uuid';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Message, MessageInsert } from '@/types/database';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';

import sendSoundFile from '@/assets/sounds/send.mp3';
import receiveSoundFile from '@/assets/sounds/receive.mp3';

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  const today = new Date();
  const diffTime = today.getTime() - date.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
};

type DateSeparator = { type: 'date'; date: string };
type ListItem = Message | DateSeparator;

interface BackgroundOption {
  type: 'solid' | 'gradient' | 'custom';
  color?: string;
  colors?: string[];
}

export default function ChatScreen() {
  const { id: partnerId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState<string>('Chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  const [background, setBackground] = useState<BackgroundOption>({ 
    type: 'gradient', 
    colors: ['#e0c3fc', '#8ec5fc'] 
  });
  
  const [modalVisible, setModalVisible] = useState(false);
  const [customColor1, setCustomColor1] = useState('#ff0000');
  const [customColor2, setCustomColor2] = useState('#efefef');

  const [notifMessage, setNotifMessage] = useState('');
  const notifAnim = useRef(new Animated.Value(-150)).current; 

  // --- NEW: Track Keyboard Visibility ---
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const hideSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);
  // --------------------------------------

  const showNewMessageNotification = (msgContent: string) => {
    setNotifMessage(msgContent);
    Animated.timing(notifAnim, {
      toValue: insets.top + 10,
      duration: 400,
      easing: Easing.out(Easing.back(1.5)),
      useNativeDriver: true,
    }).start();

    setTimeout(() => {
      Animated.timing(notifAnim, {
        toValue: -150,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setNotifMessage(''));
    }, 3000);
  };

  const listItems = useMemo(() => {
    const items: ListItem[] = [];
    let lastDate = '';
    messages.forEach((msg) => {
      const msgDate = new Date(msg.created_at).toDateString();
      if (msgDate !== lastDate) {
        items.push({ type: 'date', date: msg.created_at });
        lastDate = msgDate;
      }
      items.push(msg);
    });
    return items;
  }, [messages]);

  const listRef = useRef<FlatList<ListItem>>(null);
  const animMap = useRef<Record<string, Animated.Value>>({});
  const channelRef = useRef<any>(null);

  const playSound = async (file: any) => {
    try {
      const { sound } = await Audio.Sound.createAsync(file);
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) sound.unloadAsync();
      });
    } catch (error) {
      console.log('Error playing sound', error);
    }
  };

  useEffect(() => {
    const loadBackground = async () => {
      const stored = await AsyncStorage.getItem('chatBackground');
      if (stored) setBackground(JSON.parse(stored));
    };
    loadBackground();
  }, []);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', partnerId)
        .single();
      if (profile && 'full_name' in profile) setPartnerName(profile.full_name as string);

      await supabase
        .from('messages')
        .update({ read: true })
        .eq('receiver_id', user.id)
        .eq('sender_id', partnerId)
        .eq('read', false);         

      const { data } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });

      const fetchedMessages = (data as Message[]) || [];
      setMessages(fetchedMessages);

      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);

      channelRef.current = supabase
        .channel(`messages-${user.id}-${partnerId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages' },
          async (payload) => {
            const msg = payload.new as Message;
            if (!animMap.current[msg.id]) animMap.current[msg.id] = new Animated.Value(0);
            
            setMessages((prev) => {
              if (prev.some((m) => m.id === msg.id)) return prev;
              return [...prev, msg];
            });

            if (msg.sender_id === partnerId) {
              playSound(receiveSoundFile);
              showNewMessageNotification(msg.content);
              await supabase.from('messages').update({ read: true }).eq('id', msg.id);
            }

            setTimeout(() => {
              listRef.current?.scrollToEnd({ animated: true });
              Animated.timing(animMap.current[msg.id], {
                toValue: 1,
                duration: 350,
                useNativeDriver: true,
              }).start();
            }, 100);
          }
        )
        .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'messages' },
            async (payload) => {
              const updatedMsg = payload.new as Message;
              setMessages((prev) => 
                prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m))
              );
            }
        )
        .subscribe();
    };

    init();

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [partnerId]);

  const handleSend = async () => {
    const messageText = text.trim();
    if (!currentUserId || !partnerId || !messageText) return;

    const newId = uuid.v4() as string;
    const optimistic: Message = {
      id: newId,
      sender_id: currentUserId,
      receiver_id: partnerId as string,
      content: messageText,
      read: false,
      created_at: new Date().toISOString(),
    };

    animMap.current[optimistic.id] = new Animated.Value(0);
    setMessages((prev) => [...prev, optimistic]);
    setText('');
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    Animated.timing(animMap.current[optimistic.id], { toValue: 1, duration: 300, useNativeDriver: true }).start();
    playSound(sendSoundFile);

    const { error } = await supabase.from('messages').insert(optimistic as MessageInsert);
    if (error) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      Alert.alert('Error', 'Failed to send');
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleDeleteSelected = async () => {
    Alert.alert('Delete Messages', `Delete ${selectedIds.length} selected message(s)?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase.from('messages').delete({ count: 'exact' }).in('id', selectedIds);
            if (!error) {
               setMessages((prev) => prev.filter((m) => !selectedIds.includes(m.id)));
               setSelectedIds([]);
            }
          } catch (err) { console.error(err); }
        },
      },
    ]);
  };

  const backgroundOptions: BackgroundOption[] = [
    { type: 'custom' },
    { type: 'gradient', colors: ['#e0c3fc', '#8ec5fc'] },
    { type: 'gradient', colors: ['#ffff00', '#ffffff'] },
    { type: 'solid', color: '#1a1a1a' },
    { type: 'gradient', colors: ['#ff0066', '#ffffff'] },
    { type: 'gradient', colors: ['#ff0000', '#ffffff'] },
    { type: 'gradient', colors: ['#0000ff', '#ffffff'] },
    { type: 'gradient', colors: ['#84fab0', '#8fd3f4'] },
  ];

  const renderDateSeparator = (dateStr: string) => (
    <View style={styles.dateSeparator}>
      <Text style={styles.dateSeparatorText}>{formatDate(dateStr)}</Text>
    </View>
  );

  const renderMessage = (item: Message) => {
    const isMine = item.sender_id === currentUserId;
    const isSelected = selectedIds.includes(item.id);
    if (!animMap.current[item.id]) animMap.current[item.id] = new Animated.Value(1);

    return (
      <Animated.View style={[styles.messageRow, isMine ? styles.rowRight : styles.rowLeft, { opacity: animMap.current[item.id] }]}>
        <TouchableOpacity
          onLongPress={() => toggleSelect(item.id)}
          onPress={() => selectedIds.length > 0 && toggleSelect(item.id)}
          activeOpacity={0.8}
          style={{ maxWidth: '80%' }}
        >
          <LinearGradient
            colors={
                    isSelected ? (['#fca5a5', '#f87171'] as const)
                      : isMine ? (['#d1faef', '#d1faff'] as const)
                      : (['#d1fae5', '#d1faa5'] as const)
                  }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.bubble, isMine ? styles.bubbleRight : styles.bubbleLeft, isSelected && styles.bubbleSelected]}
          >
            <View style={styles.bubbleContent}>
              <Text style={[styles.messageText, isMine || isSelected ? styles.textLight : styles.textDark]}>
                {item.content + "  "}
              </Text>
              <View style={styles.metaContainer}>
                <Text style={[styles.timeText, isMine || isSelected ? styles.timeLight : styles.timeDark]}>
                  {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) + " "}   
                </Text>
                {isMine && (
                  <Ionicons
                    name={item.read ? 'checkmark-done-outline' : 'checkmark-outline'}
                    size={14}
                    color="red"
                    style={{ marginLeft: 4 }}
                  />
                )}
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderItem = ({ item }: { item: ListItem }) => {
    if ('type' in item && item.type === 'date') return renderDateSeparator(item.date);
    return renderMessage(item as Message);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {background.type === 'gradient' && background.colors ? (
        <LinearGradient colors={background.colors} style={StyleSheet.absoluteFillObject} />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: background.color || '#fff' }]} />
      )}

      {/* Header */}
      <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
        <LinearGradient
          colors={['rgba(0,0,0,0.6)', 'transparent']}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>{partnerName}</Text>
            <Text style={styles.headerSubtitle}>Online</Text>
          </View>
          {selectedIds.length > 0 ? (
            <TouchableOpacity onPress={handleDeleteSelected} style={styles.headerButton}>
              <Ionicons name="trash-outline" size={24} color="#ff6b6b" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.headerButton}>
              <Ionicons name="color-palette-outline" size={24} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Notification Banner */}
      <Animated.View 
        style={[
          styles.notificationBanner, 
          { transform: [{ translateY: notifAnim }] }
        ]}
      >
        <View style={styles.notificationContent}>
            <Ionicons name="chatbubble-ellipses" size={20} color="#fff" />
            <View style={{marginLeft: 10, flex: 1}}>
                <Text style={styles.notificationTitle}>{partnerName}</Text>
                <Text style={styles.notificationText} numberOfLines={1}>
                    {notifMessage}
                </Text>
            </View>
        </View>
      </Animated.View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} 
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0} 
      >
        <FlatList
          ref={listRef}
          data={listItems}
          keyExtractor={(item) => ('type' in item ? item.date : (item as Message).id)}
          renderItem={renderItem}
          contentContainerStyle={[styles.listContent, { paddingBottom: 20 }]}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="interactive"
        />

        {/* INPUT CONTAINER FIX: Conditional Padding */}
        <View style={[
            styles.inputContainer, 
            { 
                paddingBottom: isKeyboardVisible 
                    ? 10  // If keyboard is OPEN, use small padding
                    : Math.max(insets.bottom, 15) // If CLOSED, use safe area
            }
        ]}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              value={text}
              onChangeText={setText}
              placeholder="Message..."
              placeholderTextColor="#9ca3af"
              multiline
            />
            <TouchableOpacity 
              onPress={handleSend}
              disabled={!text.trim()}
              style={[styles.sendButton, !text.trim() && styles.sendButtonDisabled]}
            >
              <Ionicons name="send" size={20} color="#fff" style={{ marginLeft: 2 }} />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Modal */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setModalVisible(false)}>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalHeader}>Appearance</Text>
            <View style={styles.colorInputs}>
               <TextInput value={customColor1} onChangeText={setCustomColor1} style={styles.hexInput} placeholder="#Color1" />
               <TextInput value={customColor2} onChangeText={setCustomColor2} style={styles.hexInput} placeholder="#Color2" />
            </View>
            <FlatList
              data={backgroundOptions}
              numColumns={4}
              keyExtractor={(_, i) => i.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.swatchContainer}
                  onPress={() => {
                    const bg = item.type === 'custom' ? { type: 'gradient', colors: [customColor1, customColor2] } : item;
                    setBackground(bg as BackgroundOption);
                    AsyncStorage.setItem('chatBackground', JSON.stringify(bg));
                    setModalVisible(false);
                  }}
                >
                  {item.type === 'gradient' ? (
                     <LinearGradient colors={item.colors!} style={styles.swatch} />
                  ) : item.type === 'custom' ? (
                    <LinearGradient colors={[customColor1, customColor2]} style={styles.swatch}><Ionicons name="add" size={20} color="#fff"/></LinearGradient>
                  ) : (
                    <View style={[styles.swatch, { backgroundColor: item.color }]} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  
  // Custom Notification Banner
  notificationBanner: {
    position: 'absolute',
    left: 15,
    right: 15,
    zIndex: 100,
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  notificationTitle: {
    color: '#3b82f6', 
    fontWeight: '700',
    fontSize: 12,
    marginBottom: 2,
  },
  notificationText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },

  // Header
  headerContainer: {
    width: '100%',
    zIndex: 10,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    height: 60,
  },
  headerButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 15,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },

  // List
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  dateSeparator: {
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginVertical: 16,
  },
  dateSeparatorText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },

  // Messages
  messageRow: {
    marginBottom: 8,
    width: '100%',
  },
  rowLeft: {
    alignItems: 'flex-start',
  },
  rowRight: {
    alignItems: 'flex-end',
  },
  bubble: {
    borderRadius: 20,
    paddingTop: 14,
    paddingBottom: 8,
    paddingHorizontal: 14,
    minWidth: 80,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 2,
  },
  bubbleLeft: {
    borderBottomLeftRadius: 4,
  },
  bubbleRight: {
    borderBottomRightRadius: 4,
  },
  bubbleSelected: {
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  
  // Smart Content Layout
 bubbleContent: {
    flexDirection: 'column',
    alignItems: 'flex-start', 
  },
  
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
    marginRight: 6,
    paddingBottom: 2,
  },
  
  timeText: {
    fontSize: 10,
  },
  
  // Colors
  textLight: { color: '#444' },
  textDark: { color: '#1f2937' },
  timeLight: { color: 'rgba(0,0,0,0.45)' },
  timeDark: { color: 'rgba(0,0,0,0.45)' },

  // Input
  inputContainer: {
    paddingHorizontal: 10,
    paddingTop: 8,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#fff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 6,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 16,
    color: '#1f2937',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#9ca3af',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    elevation: 10,
  },
  modalHeader: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 20,
    textAlign: 'center',
  },
  colorInputs: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  hexInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 10,
    fontSize: 14,
  },
  swatchContainer: {
    flex: 1,
    aspectRatio: 1,
    margin: 6,
  },
  swatch: {
    flex: 1,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
