import { router, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Snackbar } from 'react-native-paper';
import { AppScreenLayout } from '../components/layout/app-screen-layout';
import { ApplicationGrid } from '../components/menu/application-grid';
import { AppDrawer } from '../components/navigation/app-drawer';
import { getVisibleMenu, type MenuModule } from '../config/menu';
import { useAuth } from '../lib/auth-context';
import { usePriceNotifications } from '../lib/price-notifications-context';

export default function HomeScreen() {
  const { user, logout } = useAuth();
  const { openNotifications, unreadCount } = usePriceNotifications();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [message, setMessage] = useState('');
  const modules = useMemo(() => getVisibleMenu(user?.permissions), [user?.permissions]);

  function openModule(module: MenuModule) {
    router.push({ pathname: '/module/[moduleId]', params: { moduleId: module.id } } as Href);
  }

  function openSettings() {
    setDrawerVisible(false);
    const settingsModule = modules.find((module) => module.id === 'settings');
    if (settingsModule) openModule(settingsModule);
  }

  async function handleLogout() {
    setDrawerVisible(false);
    await logout();
    router.replace('/login');
  }

  return (
    <AppScreenLayout
      onMenuPress={() => setDrawerVisible(true)}
      notificationCount={unreadCount}
      onNotificationsPress={openNotifications}
      onProfilePress={() => setDrawerVisible(true)}
      title="Mayoreo"
      userName={user?.name}
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ApplicationGrid modules={modules} onModulePress={openModule} />
      </ScrollView>

      <AppDrawer
        onClose={() => setDrawerVisible(false)}
        onHelpPress={() => {
          setDrawerVisible(false);
          setMessage('Ayuda estará disponible próximamente');
        }}
        onHomePress={() => setDrawerVisible(false)}
        onLogoutPress={handleLogout}
        onSettingsPress={openSettings}
        user={user}
        visible={drawerVisible}
      />

      <Snackbar duration={2600} onDismiss={() => setMessage('')} visible={Boolean(message)}>
        {message}
      </Snackbar>
    </AppScreenLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 44,
  },
});
