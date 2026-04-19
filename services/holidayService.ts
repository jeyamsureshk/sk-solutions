// src/services/holidayService.ts
import { supabase } from '../lib/supabase'; 
import { HOLIDAYS_2026 } from '../constants/holidays';

export interface SupabaseEvent {
  date: string;  
  title: string; 
  event_type?: string; // <-- Added event_type
}

export const getMergedHolidays = async (): Promise<Record<string, string>> => {
  try {
    console.log("1. Starting Supabase fetch for events...");
    
    // <-- Added event_type to the select query
    const { data, error } = await supabase
      .from('events')
      .select('date, title, event_type'); 

    // CHECK 1: Is there an error? (Usually an RLS Permission Error)
    if (error) {
      console.error("❌ SUPABASE ERROR:", error.message);
      return HOLIDAYS_2026;
    }

    // CHECK 2: Is the data coming back?
    console.log("✅ SUPABASE DATA RETURNED:", data);

    const mergedHolidays: Record<string, string> = { ...HOLIDAYS_2026 };

    // Merge logic
    if (data && data.length > 0) {
      data.forEach((event: SupabaseEvent) => {
        if (event.date && event.title) {
          
          // Optional: Format the title if it has a specific event type 
          // (e.g., "Annual Retreat (company_event)")
          let displayTitle = event.title;
          if (event.event_type && event.event_type !== 'holiday') {
             displayTitle = `${event.title} (${event.event_type.replace('_', ' ')})`;
          }

          if (mergedHolidays[event.date]) {
             mergedHolidays[event.date] = `${mergedHolidays[event.date]} / ${displayTitle}`;
          } else {
             mergedHolidays[event.date] = displayTitle;
          }
        }
      });
      console.log("✅ SUCCESSFULLY MERGED! Total Holidays:", Object.keys(mergedHolidays).length);
    } else {
      console.log("⚠️ WARNING: Supabase returned empty data []. Are there rows in your table?");
    }

    return mergedHolidays;

  } catch (error) {
    console.error("❌ CATCH BLOCK ERROR:", error);
    return HOLIDAYS_2026;
  }
};
