import axios from "axios";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Text, TextInput } from "react-native-paper";
import { useAuth } from "../lib/auth-context";
import { COLORS } from "../theme/colors";

export default function LoginScreen() {
    const { login } = useAuth();
    const [email, setEmail] = useState("admin@gmail.com");
    const [password, setPassword] = useState("password");
    const [error, setError] = useState<string | null>(null);
    const [deviceConflict, setDeviceConflict] = useState(false);
    const [loading, setLoading] = useState(false);

    async function handleLogin(replaceExistingDevice = false) {
        setError(null);
        if (!replaceExistingDevice) setDeviceConflict(false);
        setLoading(true);
        try {
            await login(
                email.trim().toLowerCase(),
                password,
                replaceExistingDevice,
            );
            router.replace("/home");
        } catch (requestError) {
            if (
                axios.isAxiosError(requestError) &&
                requestError.response?.status === 409 &&
                requestError.response?.data?.message ===
                    "La cuenta ya tiene otro dispositivo vinculado."
            ) {
                setDeviceConflict(true);
            } else if (
                axios.isAxiosError(requestError) &&
                requestError.response?.status === 401
            ) {
                setError("Correo o contraseña incorrectos.");
            } else if (axios.isAxiosError(requestError)) {
                setError(
                    typeof requestError.response?.data?.message === "string"
                        ? requestError.response.data.message
                        : "No se pudo iniciar sesión",
                );
            } else {
                setError("No se pudo iniciar sesión");
            }
        } finally {
            setLoading(false);
        }
    }

    return (
        <View
            className="flex-1 justify-center gap-4 px-6"
            style={styles.screen}
        >
            <StatusBar style="dark" />
            <Text
                variant="headlineMedium"
                className="mb-4 text-center"
                style={styles.title}
            >
                Iniciar sesión
            </Text>
            <TextInput
                label="Email"
                value={email}
                onChangeText={(value) => {
                    setEmail(value);
                    setDeviceConflict(false);
                    setError(null);
                }}
                autoCapitalize="none"
                keyboardType="email-address"
                mode="outlined"
            />
            <TextInput
                label="Contraseña"
                value={password}
                onChangeText={(value) => {
                    setPassword(value);
                    setDeviceConflict(false);
                    setError(null);
                }}
                secureTextEntry
                mode="outlined"
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {deviceConflict ? (
                <View style={styles.deviceConflict}>
                    <Text style={styles.deviceConflictTitle}>
                        Esta cuenta está abierta en otro dispositivo
                    </Text>
                    <Text style={styles.deviceConflictText}>
                        Puedes cerrar la sesión anterior e ingresar en este equipo. No se borrarán órdenes ni datos.
                    </Text>
                    <Button
                        disabled={loading}
                        icon="cellphone-arrow-down"
                        loading={loading}
                        mode="outlined"
                        onPress={() => void handleLogin(true)}
                    >
                        Usar este dispositivo
                    </Button>
                </View>
            ) : null}
            <Button
                mode="contained"
                onPress={() => void handleLogin()}
                loading={loading}
                disabled={loading}
            >
                Entrar
            </Button>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { backgroundColor: COLORS.background },
    title: { color: COLORS.text, fontWeight: "800" },
    error: {
        padding: 10,
        borderRadius: 10,
        color: COLORS.error,
        backgroundColor: COLORS.errorContainer,
    },
    deviceConflict: {
        padding: 14,
        gap: 8,
        borderWidth: 1,
        borderColor: "#D9B98A",
        borderRadius: 12,
        backgroundColor: "#FBF1E1",
    },
    deviceConflictTitle: {
        color: "#70451F",
        fontSize: 13,
        fontWeight: "900",
    },
    deviceConflictText: {
        color: "#70451F",
        fontSize: 10,
        lineHeight: 15,
    },
});
