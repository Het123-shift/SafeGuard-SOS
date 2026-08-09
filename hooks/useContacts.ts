import { useContext } from 'react';
import { ContactsContext } from '@/contexts/ContactsContext';

export function useContacts() {
  const context = useContext(ContactsContext);
  if (!context) throw new Error('useContacts must be used within ContactsProvider');
  return context;
}
