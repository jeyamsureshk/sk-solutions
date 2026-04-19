import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { ArrowLeft, Camera, Image as ImageIcon, CheckCircle2 } from 'lucide-react-native';
import { useState, useEffect } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator'; 
import { decode } from 'base64-arraybuffer';
import { useStudyMaterials } from '@/hooks/useStudyMaterials';
import { supabase } from '@/lib/supabase';

export default function AddStudyMaterialScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>(); 
  
  const { addMaterial, updateMaterial, getMaterialById } = useStudyMaterials();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  
  const [uploading, setUploading] = useState(false);
  const [fetchingData, setFetchingData] = useState(!!id); 

  const isEditing = !!id; 

  useEffect(() => {
    const fetchExistingData = async () => {
      if (!id) return;
      try {
        const material = await getMaterialById(id);
        if (material) {
          setTitle(material.title);
          setContent(material.content);
          setCategory(material.category_name || '');
          setImageUri(material.image_url);
        } else {
          Alert.alert('Error', 'Material not found.');
          router.back();
        }
      } catch (error) {
        console.error("Failed to fetch material:", error);
        Alert.alert('Error', 'Failed to load material data.');
      } finally {
        setFetchingData(false);
      }
    };

    fetchExistingData();
  }, [id]);

  useEffect(() => {
    (async () => {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Please grant permission to access your photos');
        }
      }
    })();
  }, []);

  // NEW: Updated function to handle document enhancement attempts
  const enhanceImageForDocument = async (uri: string) => {
    console.log("Attempting to optimize image for document format...");

  
    try {
      
      const manipResult = await manipulateAsync(
        uri,
        [{ resize: { width: 1600 } }], 
        { compress: 0.85, format: SaveFormat.JPEG }
      );
      
    
      return manipResult.uri;

    } catch (error) {
      console.error("Image optimization failed:", error);
      // Fallback to original if manipulation fails
      return uri; 
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true, // Allows built-in OS cropping, which helps significantly
        quality: 1, 
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        // Show loading indicator while processing could be added here
        const originalUri = result.assets[0].uri;
        const enhancedUri = await enhanceImageForDocument(originalUri);
        setImageUri(enhancedUri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const uploadImage = async (uri: string) => {
    if (uri.startsWith('http')) {
      return uri;
    }

    try {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) throw new Error('File does not exist');

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });

      const fileName = `study-material-${Date.now()}.jpg`;
      
      const { data, error } = await supabase.storage
        .from('study-materials')
        .upload(fileName, decode(base64), {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('study-materials')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim() || !category.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setUploading(true);
    try {
      let imageUrl = null;
      if (imageUri) {
        imageUrl = await uploadImage(imageUri);
      }

      const materialData = {
        category: category.trim(),
        title: title.trim(),
        content: content.trim(),
        image_url: imageUrl,
      };

      let result;
      if (isEditing) {
        if (!updateMaterial) throw new Error("updateMaterial not found in hook");
        result = await updateMaterial(id, materialData);
      } else {
        result = await addMaterial(materialData);
      }

      if (result.success) {
        Alert.alert('Success', `Study material ${isEditing ? 'updated' : 'added'} successfully`, [
          { text: 'OK', onPress: () => router.back() }
        ]);
      } else {
        Alert.alert('Error', `Failed to ${isEditing ? 'update' : 'add'} study material`);
      }
    } catch (error) {
        console.error("Submit error", error)
      Alert.alert('Error', 'Failed to save material');
    } finally {
      setUploading(false);
    }
  };

  if (fetchingData) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Preparing editor...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditing ? 'Edit Material' : 'New Material'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.formCard}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Category <Text style={{color:'red'}}>*</Text></Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Mathematics, Science"
              placeholderTextColor="#9ca3af"
              value={category}
              onChangeText={setCategory}
              maxLength={100}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Title <Text style={{color:'red'}}>*</Text></Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter a descriptive title"
              placeholderTextColor="#9ca3af"
              value={title}
              onChangeText={setTitle}
              maxLength={200}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Content <Text style={{color:'red'}}>*</Text></Text>
            <TextInput
              style={[styles.textInput, styles.multilineInput]}
              placeholder="Write or paste your study content here..."
              placeholderTextColor="#9ca3af"
              value={content}
              onChangeText={setContent}
              multiline
              numberOfLines={8}
              textAlignVertical="top"
            />
          </View>
        </View>

        <View style={styles.mediaCard}>
          <Text style={styles.sectionTitle}>Cover Image (Optional)</Text>
          
          {imageUri ? (
            <View style={styles.imagePreviewContainer}>
              <Image
                source={{ uri: imageUri }}
                style={styles.imagePreview}
                onError={() => {
                  Alert.alert('Error', 'Could not load the image preview.');
                  setImageUri(null);
                }}
              />
              <TouchableOpacity style={styles.changeImageOverlay} onPress={pickImage}>
                <Camera size={18} color="#ffffff" />
                <Text style={styles.changeImageText}>Change Photo</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.imagePickerDashed} onPress={pickImage}>
              <View style={styles.imagePickerIconContainer}>
                <ImageIcon size={28} color="#3b82f6" />
              </View>
              <Text style={styles.imagePickerTitle}>Tap to upload an image</Text>
              <Text style={styles.imagePickerSubtext}>JPEG, PNG or WebP </Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[styles.submitButton, uploading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={uploading}
          activeOpacity={0.8}
        >
          {uploading ? (
            <ActivityIndicator color="#ffffff" size="small" style={{ marginRight: 8 }} />
          ) : (
            <CheckCircle2 size={20} color="#ffffff" style={{ marginRight: 8 }} />
          )}
          <Text style={styles.submitButtonText}>
            {uploading ? 'Saving changes...' : `${isEditing ? 'Update' : 'Publish'} Material`}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  loadingCard: { backgroundColor: '#ffffff', padding: 30, borderRadius: 20, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
  loadingText: { fontSize: 16, color: '#475569', marginTop: 16, fontWeight: '500' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 20, backgroundColor: '#ffffff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 2, zIndex: 10 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', letterSpacing: 0.3 },
  content: { flex: 1 },
  contentContainer: { padding: 20, paddingBottom: 60 },
  formCard: { backgroundColor: '#ffffff', borderRadius: 24, padding: 24, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 12, elevation: 2 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '700', color: '#334155', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  textInput: { borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, backgroundColor: '#f8fafc', color: '#0f172a' },
  multilineInput: { height: 160, textAlignVertical: 'top', paddingTop: 16 },
  mediaCard: { backgroundColor: '#ffffff', borderRadius: 24, padding: 24, marginBottom: 30, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 12, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 16 },
  imagePickerDashed: { borderWidth: 2, borderColor: '#cbd5e1', borderStyle: 'dashed', borderRadius: 20, padding: 32, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center' },
  imagePickerIconContainer: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  imagePickerTitle: { fontSize: 16, fontWeight: '600', color: '#1e293b', marginBottom: 4 },
  imagePickerSubtext: { fontSize: 13, color: '#64748b' },
  imagePreviewContainer: { width: '100%', height: 220, borderRadius: 20, overflow: 'hidden', backgroundColor: '#f1f5f9', position: 'relative' },
  imagePreview: { width: '100%', height: '100%', resizeMode: 'cover' },
  changeImageOverlay: { position: 'absolute', bottom: 16, right: 16, backgroundColor: 'rgba(15, 23, 42, 0.75)', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  changeImageText: { color: '#ffffff', fontWeight: '600', fontSize: 14, marginLeft: 8 },
  submitButton: { backgroundColor: '#2563eb', padding: 18, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: '#2563eb', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 6 },
  submitButtonDisabled: { backgroundColor: '#94a3b8', shadowOpacity: 0, elevation: 0 },
  submitButtonText: { color: '#ffffff', fontSize: 18, fontWeight: '700', letterSpacing: 0.3 },
});
