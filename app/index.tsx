import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { StorageService } from '@/services/storageService';
import { Colors } from '@/constants/theme';

export default function IndexPage() {
  const router = useRouter();
  const { isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    const check = async () => {
      const onboarded = await StorageService.isOnboarded();
      if (!onboarded) {
        router.replace('/onboarding');
      } else if (!isAuthenticated) {
        router.replace('/auth/login');
      } else {
        router.replace('/(tabs)');
      }
    };
    check();
  }, [isLoading, isAuthenticated]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
});
