import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { StorageService } from '@/services/storageService';

export interface TrustedContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  email: string;
  isPriority: boolean;
  avatar: string;
  addedAt: string;
}

interface ContactsContextType {
  contacts: TrustedContact[];
  isLoading: boolean;
  addContact: (contact: Omit<TrustedContact, 'id' | 'addedAt'>) => Promise<void>;
  updateContact: (id: string, data: Partial<TrustedContact>) => Promise<void>;
  removeContact: (id: string) => Promise<void>;
  setPriority: (id: string) => Promise<void>;
}

export const ContactsContext = createContext<ContactsContextType | undefined>(undefined);

export function ContactsProvider({ children }: { children: ReactNode }) {
  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const saved = await StorageService.getContacts();
      if (saved.length > 0) {
        setContacts(saved);
      } else {
        const defaults: TrustedContact[] = [
          { id: 'c1', name: 'Mom', relationship: 'Parent', phone: '+1 555 0101', email: 'mom@example.com', isPriority: true, avatar: '', addedAt: new Date().toISOString() },
          { id: 'c2', name: 'Best Friend', relationship: 'Friend', phone: '+1 555 0102', email: 'friend@example.com', isPriority: false, avatar: '', addedAt: new Date().toISOString() },
        ];
        setContacts(defaults);
        await StorageService.saveContacts(defaults);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const save = async (updated: TrustedContact[]) => {
    setContacts(updated);
    await StorageService.saveContacts(updated);
  };

  const addContact = async (contact: Omit<TrustedContact, 'id' | 'addedAt'>) => {
    if (contacts.length >= 5) return;
    const newContact: TrustedContact = {
      ...contact,
      id: `c_${Date.now()}`,
      addedAt: new Date().toISOString(),
    };
    await save([...contacts, newContact]);
  };

  const updateContact = async (id: string, data: Partial<TrustedContact>) => {
    await save(contacts.map(c => c.id === id ? { ...c, ...data } : c));
  };

  const removeContact = async (id: string) => {
    await save(contacts.filter(c => c.id !== id));
  };

  const setPriority = async (id: string) => {
    await save(contacts.map(c => ({ ...c, isPriority: c.id === id })));
  };

  return (
    <ContactsContext.Provider value={{ contacts, isLoading, addContact, updateContact, removeContact, setPriority }}>
      {children}
    </ContactsContext.Provider>
  );
}
