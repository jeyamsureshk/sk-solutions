import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Share,
  Alert,
  StatusBar,
  Platform,
} from 'react-native';
import { ArrowLeft, Share2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useStudyMaterials, StudyMaterialWithCategory } from '@/hooks/useStudyMaterials';

const renderBoldPrefixes = (text?: string) => {
  if (!text) return null;
  const formattedText = text.replace(/\\n/g, '\n');
  const lines = formattedText.split('\n');

  return lines.map((line, index) => {
    const colonIndex = line.indexOf(':');
    if (colonIndex !== -1) {
      const boldPart = line.substring(0, colonIndex + 1);
      const restPart = line.substring(colonIndex + 1);
      return (
        <Text key={index} style={styles.lineSpacing}>
          <Text style={styles.boldText}>{boldPart}</Text>
          {restPart}
          {index < lines.length - 1 ? '\n' : ''}
        </Text>
      );
    }
    return (
      <Text key={index} style={styles.lineSpacing}>
        {line}
        {index < lines.length - 1 ? '\n' : ''}
      </Text>
    );
  });
};

export default function StudyMaterialDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { getMaterialById } = useStudyMaterials();
  const [material, setMaterial] = useState<StudyMaterialWithCategory | null>(null);
  const [loading, setLoading] = useState(true);
  const [imgRatio, setImgRatio] = useState<number | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    const fetchMaterial = async () => {
      try {
        if (typeof id === 'string') {
          const data = await getMaterialById(id);
          setMaterial(data);
          if (data?.image_url) {
            Image.getSize(
              data.image_url,
              (width, height) => {
                setImgRatio(width / height);
                setImgFailed(false);
              },
              () => setImgFailed(true)
            );
          }
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchMaterial();
  }, [id]);

  const handleShare = async () => {
    try {
      if (material) {
        await Share.share({ message: `${material.title}\n\n${material.content}` });
      }
    } catch (error) {
      Alert.alert("Error", "Could not share this material.");
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>Loading material...</Text>
      </View>
    );
  }

  if (!material) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Material not found.</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.retryButton}>
          <Text style={styles.retryText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
          <ArrowLeft size={22} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {material.title || 'Study Material'}
        </Text>
        <TouchableOpacity onPress={handleShare} style={styles.iconButton}>
          <Share2 size={22} color="#1e293b" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {material.image_url && !imgFailed && (
          <View style={styles.imageContainer}>
            <Image 
              source={{ uri: material.image_url }} 
              style={[
                styles.image, 
                imgRatio ? { aspectRatio: imgRatio } : { height: 240 }
              ]} 
              onError={() => setImgFailed(true)}
            />
          </View>
        )}
        
        {/* NEW: Title with built-in dynamic border bottom */}
        <View style={styles.titleWrapper}>
          <Text style={styles.title}>{material.title}</Text>
        </View>

        <View style={styles.badge}>
            <Text style={styles.badgeText}>{material.category_name?.toUpperCase() || 'GENERAL'}</Text>
        </View>

        <View style={styles.card}>
            <Text style={styles.contentText}>
              {renderBoldPrefixes(material.content)}
            </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc', padding: 20 },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 12, 
    paddingTop: Platform.OS === 'ios' ? 60 : 40, 
    paddingBottom: 12, 
    backgroundColor: '#ffffff',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10 },
      android: { elevation: 3 }
    }),
    zIndex: 10
  },
  iconButton: { padding: 8, borderRadius: 12, backgroundColor: '#f1f5f9' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#334155', textAlign: 'center', flex: 1, marginHorizontal: 8 },
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 60 },
  imageContainer: {
    borderRadius: 20,
    backgroundColor: '#fff',
    marginBottom: 24,
    ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20 },
        android: { elevation: 5 }
    }),
  },
  image: { width: '100%', borderRadius: 20, resizeMode: 'cover' },
  
  // FIXED: Title wrapper now handles the divider border directly
  titleWrapper: {
    alignSelf: 'flex-start', // Shrink-wraps container to text width
    borderBottomWidth: 3,    // Thickness of the divider
    borderBottomColor: '#2563eb', // Divider color
    paddingBottom: 3,        // Space between text and divider
    marginBottom: 10,        // Space below the divider
    borderRadius: 2,         // Slightly rounds the edges of the border
  },
  title: { 
    fontSize: 28, 
    fontWeight: '800', 
    color: '#0f172a', 
    letterSpacing: -0.5, 
  },

  badge: { alignSelf: 'flex-start', backgroundColor: '#dcfce7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginBottom: 24 },
  badgeText: { fontSize: 11, fontWeight: '800', color: '#166534', letterSpacing: 0.5 },
  card: { 
    backgroundColor: '#ffffff', 
    borderRadius: 20, 
    padding: 20,
    ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 15 },
        android: { elevation: 1 }
    }),
  },
  contentText: { fontSize: 16, color: '#334155', lineHeight: 28, textAlign: 'left' },
  lineSpacing: { marginBottom: 10 },
  boldText: { fontWeight: '800', color: '#293' },
  loadingText: { fontSize: 15, color: '#64748b', fontWeight: '600' },
  errorText: { fontSize: 16, color: '#ef4444', marginBottom: 16, fontWeight: '600' },
  retryButton: { paddingVertical: 12, paddingHorizontal: 24, backgroundColor: '#2563eb', borderRadius: 12 },  
  retryText: { color: '#ffffff', fontWeight: '700' },
});
