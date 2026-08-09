import { useState, useEffect } from 'react';
import { StorageService } from '@/services/storageService';

export interface MedicalProfile {
  bloodGroup: string;
  conditions: string;
  allergies: string;
  medications: string;
  doctorName: string;
  doctorPhone: string;
  notes: string;
}

export function useMedical() {
  const [medical, setMedical] = useState<MedicalProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const saved = await StorageService.getMedical();
      setMedical(saved);
    } finally {
      setIsLoading(false);
    }
  };

  const saveMedical = async (data: MedicalProfile) => {
    setMedical(data);
    await StorageService.saveMedical(data);
  };

  return { medical, isLoading, saveMedical };
}
