import axios from 'axios';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { useAuth } from '../lib/auth-context';
import { COLORS } from '../theme/colors';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('test@example.com');
  const [password, setPassword] = useState('password');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      router.replace('/home');
    } catch (error) {
      if (axios.isAxiosError(error)) {
        setError(typeof error.response?.data?.message === 'string' ? error.response.data.message : 'No se pudo iniciar sesión');
      } else {
        setError('No se pudo iniciar sesión');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="flex-1 justify-center gap-4 px-6" style={styles.screen}>
      <StatusBar style="dark" />
      <Text variant="headlineMedium" className="mb-4 text-center" style={styles.title}>
        Iniciar sesión
      </Text>
      <TextInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        mode="outlined"
      />
      <TextInput label="Contraseña" value={password} onChangeText={setPassword} secureTextEntry mode="outlined" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button mode="contained" onPress={handleLogin} loading={loading} disabled={loading}>
        Entrar
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: COLORS.background },
  title: { color: COLORS.text, fontWeight: '800' },
  error: {
    padding: 10,
    borderRadius: 10,
    color: COLORS.error,
    backgroundColor: COLORS.errorContainer,
  },
});
