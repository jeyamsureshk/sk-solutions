// src/hooks/useHolidays.ts
import { useState, useEffect } from 'react';
import { getMergedHolidays } from '../services/holidayService';
import { HOLIDAYS_2026 } from '../constants/holidays';

export const useHolidays = () => {
  const [holidays, setHolidays] = useState<Record<string, string>>(HOLIDAYS_2026);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // We define an inner async function
    const fetchHolidays = async () => {
      setIsLoading(true);
      const mergedData = await getMergedHolidays();
      setHolidays(mergedData);
      setIsLoading(false);
    };

    // Call it once
    fetchHolidays();
    
  }, []); // <--- THIS EMPTY ARRAY IS THE FIX! DO NOT REMOVE IT!

  return { holidays, isLoading };
};
