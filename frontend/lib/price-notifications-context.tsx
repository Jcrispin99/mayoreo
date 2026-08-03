import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";
import {
    AppState,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from "react-native";
import { ActivityIndicator, Button, Icon, Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS } from "../theme/colors";
import { api } from "./api";
import { useAuth } from "./auth-context";

const PUSH_TOKEN_STORAGE_KEY = "mayoreo.notifications.expo-token";
const POLL_INTERVAL_MS = 20_000;
const PRICE_CHANGES_CHANNEL_ID = "price-changes-v2";

if (Platform.OS !== "web") {
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldPlaySound: true,
            shouldSetBadge: true,
            shouldShowBanner: true,
            shouldShowList: true,
        }),
    });
}

export type PriceNotificationData = {
    kind: "price_change";
    event_id: string;
    operation: "created" | "updated" | "deleted";
    direction: "created" | "increased" | "decreased" | "changed" | "deleted";
    product_id: number;
    product_name: string;
    product_sku: string;
    price_tier_id: number | null;
    tier_label: string;
    old_price: string | null;
    new_price: string | null;
    price_unit: string;
    percentage_change: string | null;
    reason: string;
    changed_by_name: string;
    occurred_at: string;
    highlight_until: string;
};

export type AppNotification = {
    id: string;
    type: string;
    data: PriceNotificationData;
    read_at: string | null;
    created_at: string;
};

type PriceNotificationsContextValue = {
    catalogVersion: number;
    notifications: AppNotification[];
    unreadCount: number;
    openNotifications: () => void;
    refreshNotifications: () => Promise<void>;
};

const PriceNotificationsContext =
    createContext<PriceNotificationsContextValue | null>(null);

async function registerNativePush(): Promise<boolean> {
    if (Platform.OS !== "android" && Platform.OS !== "ios") return false;

    if (Platform.OS === "android") {
        await Notifications.deleteNotificationChannelAsync(
            "price-changes",
        ).catch(() => undefined);
        await Notifications.setNotificationChannelAsync(
            PRICE_CHANGES_CHANNEL_ID,
            {
                name: "Cambios de precio",
                importance: Notifications.AndroidImportance.HIGH,
                vibrationPattern: [0, 220, 160, 220],
                lightColor: COLORS.primary,
            },
        );
    }

    const existing = await Notifications.getPermissionsAsync();
    const permission =
        existing.status === "granted"
            ? existing
            : await Notifications.requestPermissionsAsync();
    if (permission.status !== "granted") return false;

    const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        Constants.easConfig?.projectId ??
        process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
    if (!projectId) return false;

    const expoPushToken = (
        await Notifications.getExpoPushTokenAsync({ projectId })
    ).data;
    await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, expoPushToken);
    await api.post("/push-subscriptions", {
        expo_push_token: expoPushToken,
        platform: Platform.OS,
    });

    return true;
}

function money(value: string | null) {
    return value === null ? null : `S/ ${Number(value).toFixed(2)}`;
}

function relativeTime(value: string) {
    const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
    const minutes = Math.floor(elapsed / 60_000);
    if (minutes < 1) return "Ahora";
    if (minutes < 60) return `Hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Hace ${hours} h`;
    return new Date(value).toLocaleDateString("es-PE");
}

function NotificationCenter({
    loading,
    notifications,
    onClose,
    onMarkAllRead,
    onMarkRead,
    visible,
}: {
    loading: boolean;
    notifications: AppNotification[];
    onClose: () => void;
    onMarkAllRead: () => void;
    onMarkRead: (notification: AppNotification) => void;
    visible: boolean;
}) {
    const hasUnread = notifications.some(
        (notification) => notification.read_at === null,
    );

    return (
        <Modal
            animationType="slide"
            onRequestClose={onClose}
            transparent
            visible={visible}
        >
            <View style={styles.backdrop}>
                <SafeAreaView
                    edges={["top", "bottom"]}
                    style={styles.sheetSafeArea}
                >
                    <KeyboardAvoidingView
                        behavior={Platform.OS === "ios" ? "padding" : undefined}
                        style={styles.sheet}
                    >
                        <View style={styles.header}>
                            <View>
                                <Text style={styles.title}>
                                    Cambios de precio
                                </Text>
                                <Text style={styles.subtitle}>
                                    Precios modificados para el personal de
                                    venta
                                </Text>
                            </View>
                            <Pressable
                                accessibilityLabel="Cerrar notificaciones"
                                hitSlop={8}
                                onPress={onClose}
                                style={styles.closeButton}
                            >
                                <Icon
                                    color={COLORS.text}
                                    size={24}
                                    source="close"
                                />
                            </Pressable>
                        </View>

                        {hasUnread ? (
                            <Button
                                compact
                                icon="check-all"
                                mode="text"
                                onPress={onMarkAllRead}
                                style={styles.readAllButton}
                            >
                                Marcar todas como leídas
                            </Button>
                        ) : null}

                        {loading && notifications.length === 0 ? (
                            <ActivityIndicator
                                color={COLORS.primaryDark}
                                size="large"
                                style={styles.loader}
                            />
                        ) : (
                            <ScrollView contentContainerStyle={styles.list}>
                                {notifications.length === 0 ? (
                                    <View style={styles.empty}>
                                        <Icon
                                            color={COLORS.textMuted}
                                            size={42}
                                            source="bell-check-outline"
                                        />
                                        <Text style={styles.emptyTitle}>
                                            No hay cambios pendientes
                                        </Text>
                                        <Text style={styles.emptyText}>
                                            Los cambios de precio aparecerán
                                            aquí.
                                        </Text>
                                    </View>
                                ) : (
                                    notifications.map((notification) => {
                                        const data = notification.data;
                                        const oldPrice = money(data.old_price);
                                        const newPrice = money(data.new_price);
                                        const unread =
                                            notification.read_at === null;
                                        const directionIcon =
                                            data.direction === "increased"
                                                ? "arrow-up"
                                                : data.direction === "decreased"
                                                  ? "arrow-down"
                                                  : "tag-outline";

                                        return (
                                            <View
                                                key={notification.id}
                                                style={[
                                                    styles.card,
                                                    unread && styles.cardUnread,
                                                ]}
                                            >
                                                <View style={styles.cardHeader}>
                                                    <View
                                                        style={[
                                                            styles.statusIcon,
                                                            unread &&
                                                                styles.statusIconUnread,
                                                        ]}
                                                    >
                                                        <Icon
                                                            color={
                                                                unread
                                                                    ? COLORS.warning
                                                                    : COLORS.info
                                                            }
                                                            size={19}
                                                            source={
                                                                directionIcon
                                                            }
                                                        />
                                                    </View>
                                                    <View
                                                        style={
                                                            styles.cardHeading
                                                        }
                                                    >
                                                        <Text
                                                            numberOfLines={2}
                                                            style={
                                                                styles.productName
                                                            }
                                                        >
                                                            {data.product_name}
                                                        </Text>
                                                        <Text
                                                            style={styles.meta}
                                                        >
                                                            {data.tier_label} ·{" "}
                                                            {relativeTime(
                                                                data.occurred_at,
                                                            )}
                                                        </Text>
                                                    </View>
                                                    {unread ? (
                                                        <View
                                                            style={
                                                                styles.unreadDot
                                                            }
                                                        />
                                                    ) : null}
                                                </View>

                                                <View style={styles.priceRow}>
                                                    {data.operation ===
                                                    "created" ? (
                                                        <Text
                                                            style={
                                                                styles.newPrice
                                                            }
                                                        >
                                                            Nuevo: {newPrice}/
                                                            {data.price_unit}
                                                        </Text>
                                                    ) : data.operation ===
                                                      "deleted" ? (
                                                        <Text
                                                            style={
                                                                styles.deletedPrice
                                                            }
                                                        >
                                                            Precio eliminado:{" "}
                                                            {oldPrice}/
                                                            {data.price_unit}
                                                        </Text>
                                                    ) : (
                                                        <>
                                                            <Text
                                                                style={
                                                                    styles.oldPrice
                                                                }
                                                            >
                                                                {oldPrice}
                                                            </Text>
                                                            <Icon
                                                                color={
                                                                    COLORS.textMuted
                                                                }
                                                                size={18}
                                                                source="arrow-right"
                                                            />
                                                            <Text
                                                                style={
                                                                    styles.newPrice
                                                                }
                                                            >
                                                                {newPrice}/
                                                                {
                                                                    data.price_unit
                                                                }
                                                            </Text>
                                                        </>
                                                    )}
                                                </View>

                                                <Text style={styles.reason}>
                                                    {data.reason} ·{" "}
                                                    {data.changed_by_name}
                                                </Text>
                                                {unread ? (
                                                    <Button
                                                        compact
                                                        mode="contained-tonal"
                                                        onPress={() =>
                                                            onMarkRead(
                                                                notification,
                                                            )
                                                        }
                                                        style={
                                                            styles.understoodButton
                                                        }
                                                    >
                                                        Entendido
                                                    </Button>
                                                ) : null}
                                            </View>
                                        );
                                    })
                                )}
                            </ScrollView>
                        )}
                    </KeyboardAvoidingView>
                </SafeAreaView>
            </View>
        </Modal>
    );
}

export function PriceNotificationsProvider({
    children,
}: {
    children: ReactNode;
}) {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [catalogVersion, setCatalogVersion] = useState(0);
    const [visible, setVisible] = useState(false);
    const [loading, setLoading] = useState(false);
    const knownIds = useRef<Set<string>>(new Set());
    const initialized = useRef(false);
    const pushReady = useRef(false);

    const refresh = useCallback(async () => {
        if (!user) return;

        setLoading(true);
        try {
            const response = await api.get("/notifications");
            const nextNotifications = (response.data.data?.items ??
                []) as AppNotification[];
            const newNotifications = initialized.current
                ? nextNotifications.filter(
                      (notification) => !knownIds.current.has(notification.id),
                  )
                : [];

            setNotifications(nextNotifications);
            setUnreadCount(Number(response.data.data?.unread_count) || 0);
            knownIds.current = new Set(
                nextNotifications.map((notification) => notification.id),
            );

            if (newNotifications.length > 0) {
                setCatalogVersion((current) => current + 1);
                if (!pushReady.current && Platform.OS !== "web") {
                    const newest = newNotifications[0];
                    const count = newNotifications.length;
                    await Notifications.scheduleNotificationAsync({
                        content: {
                            title:
                                count === 1
                                    ? "Precio actualizado"
                                    : `${count} precios actualizados`,
                            body:
                                count === 1
                                    ? `${newest.data.product_name} · ${newest.data.tier_label}`
                                    : "Abre Mayoreo para revisar los precios nuevos.",
                            data: {
                                kind: "price_change",
                                event_id: newest.data.event_id,
                            },
                            // In Android dev builds, the string "default" may be treated like
                            // a custom bundled sound file. Use the boolean form so Expo falls
                            // back to the system default sound without requiring extra assets.
                            sound: true,
                        },
                        trigger: null,
                    });
                }
            }
            initialized.current = true;
            await Notifications.setBadgeCountAsync(
                Number(response.data.data?.unread_count) || 0,
            ).catch(() => false);
        } catch {
            // Keep the last successful notification state during temporary network failures.
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        knownIds.current = new Set();
        initialized.current = false;
        pushReady.current = false;
        setNotifications([]);
        setUnreadCount(0);
        if (!user) return;

        let active = true;
        async function setup() {
            try {
                pushReady.current = await registerNativePush();
            } catch {
                pushReady.current = false;
            }
            if (active) await refresh();
        }
        void setup();

        const interval = setInterval(() => void refresh(), POLL_INTERVAL_MS);
        const appStateSubscription = AppState.addEventListener(
            "change",
            (state) => {
                if (state === "active") void refresh();
            },
        );
        const receivedSubscription =
            Platform.OS === "web"
                ? null
                : Notifications.addNotificationReceivedListener(() => {
                      void refresh();
                  });
        const responseSubscription =
            Platform.OS === "web"
                ? null
                : Notifications.addNotificationResponseReceivedListener(() => {
                      setVisible(true);
                      void refresh();
                  });

        return () => {
            active = false;
            clearInterval(interval);
            appStateSubscription.remove();
            receivedSubscription?.remove();
            responseSubscription?.remove();
        };
    }, [refresh, user]);

    async function markRead(notification: AppNotification) {
        await api.patch(`/notifications/${notification.id}/read`);
        setNotifications((current) =>
            current.map((item) =>
                item.id === notification.id
                    ? { ...item, read_at: new Date().toISOString() }
                    : item,
            ),
        );
        setUnreadCount((current) => Math.max(0, current - 1));
    }

    async function markAllRead() {
        await api.patch("/notifications/read-all");
        const readAt = new Date().toISOString();
        setNotifications((current) =>
            current.map((notification) => ({
                ...notification,
                read_at: notification.read_at ?? readAt,
            })),
        );
        setUnreadCount(0);
        await Notifications.setBadgeCountAsync(0).catch(() => false);
    }

    const value = useMemo<PriceNotificationsContextValue>(
        () => ({
            catalogVersion,
            notifications,
            unreadCount,
            openNotifications: () => {
                setVisible(true);
                void refresh();
            },
            refreshNotifications: refresh,
        }),
        [catalogVersion, notifications, refresh, unreadCount],
    );

    return (
        <PriceNotificationsContext.Provider value={value}>
            {children}
            <NotificationCenter
                loading={loading}
                notifications={notifications}
                onClose={() => setVisible(false)}
                onMarkAllRead={() => void markAllRead()}
                onMarkRead={(notification) => void markRead(notification)}
                visible={visible}
            />
        </PriceNotificationsContext.Provider>
    );
}

export function usePriceNotifications(): PriceNotificationsContextValue {
    const context = useContext(PriceNotificationsContext);
    if (!context)
        throw new Error(
            "usePriceNotifications must be used inside PriceNotificationsProvider",
        );
    return context;
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        justifyContent: "flex-end",
        backgroundColor: "rgba(23,36,35,0.42)",
    },
    sheetSafeArea: {
        maxHeight: "92%",
        backgroundColor: COLORS.surface,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
    },
    sheet: { minHeight: 320, maxHeight: "100%" },
    header: {
        padding: 18,
        flexDirection: "row",
        alignItems: "center",
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    title: { color: COLORS.text, fontSize: 20, fontWeight: "900" },
    subtitle: { marginTop: 3, color: COLORS.textMuted, fontSize: 11 },
    closeButton: {
        marginLeft: "auto",
        width: 40,
        height: 40,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 12,
    },
    readAllButton: { alignSelf: "flex-end", marginTop: 6, marginRight: 12 },
    loader: { padding: 48 },
    list: { padding: 14, paddingBottom: 30, gap: 10 },
    empty: { padding: 52, alignItems: "center", gap: 7 },
    emptyTitle: { color: COLORS.text, fontSize: 16, fontWeight: "900" },
    emptyText: { color: COLORS.textMuted, fontSize: 11 },
    card: {
        padding: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 12,
        backgroundColor: COLORS.surface,
    },
    cardUnread: {
        borderColor: "#E7A83D",
        backgroundColor: COLORS.warningContainer,
    },
    cardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
    statusIcon: {
        width: 34,
        height: 34,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 17,
        backgroundColor: COLORS.infoContainer,
    },
    statusIconUnread: { backgroundColor: "#FFE1A8" },
    cardHeading: { flex: 1 },
    productName: { color: COLORS.text, fontSize: 14, fontWeight: "900" },
    meta: {
        marginTop: 2,
        color: COLORS.textMuted,
        fontSize: 10,
        fontWeight: "700",
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: "#E08A00",
    },
    priceRow: {
        marginTop: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    oldPrice: {
        color: COLORS.textMuted,
        fontSize: 14,
        textDecorationLine: "line-through",
    },
    newPrice: { color: COLORS.primaryDark, fontSize: 15, fontWeight: "900" },
    deletedPrice: { color: COLORS.error, fontSize: 13, fontWeight: "800" },
    reason: { marginTop: 7, color: COLORS.textMuted, fontSize: 10 },
    understoodButton: { marginTop: 11, alignSelf: "flex-end" },
});
