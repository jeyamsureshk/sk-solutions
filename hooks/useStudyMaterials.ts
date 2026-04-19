import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { StudyMaterial, StudyMaterialInsert, StudyMaterialUpdate } from '@/types/database';

export interface StudyMaterialWithCategory extends StudyMaterial {
  category_name?: string;
}

export function useStudyMaterials() {
  const [materials, setMaterials] = useState<StudyMaterialWithCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMaterials = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('study_materials')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      const materialsWithCategory = (data as any[] || []).map(material => ({
        ...material,
        category_name: material.category || 'Unknown',
      }));
      setMaterials(materialsWithCategory);
    } catch (error) {
      console.error('Error fetching study materials:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMaterialById = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('study_materials')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return {
        ...(data as any),
        category_name: (data as any).category || 'Unknown',
      } as StudyMaterialWithCategory;
    } catch (error) {
      console.error('Error fetching material by id:', error);
      return null;
    }
  };

  const addMaterial = async (material: StudyMaterialInsert) => {
    try {
      const { error } = await supabase
        .from('study_materials')
        .insert(material as any);

      if (error) throw error;
      await fetchMaterials();
      return { success: true };
    } catch (error) {
      console.error('Error adding material:', error);
      return { success: false, error };
    }
  };

  const updateMaterial = async (id: string, updates: StudyMaterialUpdate) => {
    try {
      const { error } = await supabase
        .from('study_materials')
        .update(updates as any as never)
        .eq('id', id);

      if (error) throw error;
      await fetchMaterials();
      return { success: true };
    } catch (error) {
      console.error('Error updating material:', error);
      return { success: false, error };
    }
  };

 const deleteMaterial = async (id: string, imageUrl?: string | null) => {
    try {
      // 1. Delete the image from the Supabase storage bucket first
      if (imageUrl) {
        // MORE ROBUST EXTRACTION:
        // This splits the URL exactly at the bucket name and removes any '?' query parameters.
        const pathAfterBucket = imageUrl.split('/study-materials/')[1];
        const exactFilePath = pathAfterBucket ? pathAfterBucket.split('?')[0] : null;
        
        if (exactFilePath) {
          console.log('Attempting to delete file from storage:', exactFilePath);
          
          const { data, error: storageError } = await supabase.storage
            .from('study-materials')
            .remove([exactFilePath]);
            
          if (storageError) {
            console.error('Storage Delete Blocked by Supabase:', storageError.message);
            // We log the error but still proceed to delete the DB record
          } else {
            console.log('Successfully deleted image from bucket:', data);
          }
        }
      }

      // 2. Delete the record from the database
      const { error: dbError } = await supabase
        .from('study_materials')
        .delete()
        .eq('id', id);

      if (dbError) throw dbError;
      
      await fetchMaterials();
      return { success: true };
    } catch (error) {
      console.error('Error deleting material:', error);
      return { success: false, error };
    }
  };
  useEffect(() => {
    fetchMaterials();

    const channel = supabase
      .channel('study_materials_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'study_materials',
        },
        () => {
          fetchMaterials();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    materials,
    loading,
    fetchMaterials,
    getMaterialById,
    addMaterial,
    updateMaterial,
    deleteMaterial,
  };
}
