import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { useAuth } from '../lib/auth-context';

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
    } catch {
      setError('Credenciales inválidas');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="flex-1 justify-center gap-4 bg-white px-6">
      <StatusBar style="dark" />
      <Text variant="headlineMedium" className="mb-4 text-center">
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
      {error ? <Text style={{ color: 'red' }}>{error}</Text> : null}
      <Button mode="contained" onPress={handleLogin} loading={loading} disabled={loading}>
        Entrar
      </Button>
    </View>
  );
}
