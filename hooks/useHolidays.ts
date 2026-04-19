// src/hooks/useHolidays.ts
import { useState, useEffect } from 'react';
import { getMergedHolidays } from '../services/holidayService';
import { HOLIDAYS_2026 } from '../constants/holidays';

export const useHolidays = () => {
  // Initialize with static data so UI renders immediately
  const [holidays, setHolidays] = useState<Record<string, string>>(HOLIDAYS_2026);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchHolidays = async () => {
      setIsLoading(true);
      const mergedData = await getMergedHolidays();
      setHolidays(mergedData);
      setIsLoading(false);
    };

    fetchHolidays();
  }, []);

  return { holidays, isLoading };
};
