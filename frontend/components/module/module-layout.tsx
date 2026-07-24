import { router, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Snackbar } from 'react-native-paper';
import { getVisibleMenu, type MenuItem, type MenuModule } from '../../config/menu';
import { useAuth } from '../../lib/auth-context';
import { AppScreenLayout } from '../layout/app-screen-layout';
import { ApplicationSwitcher } from '../navigation/application-switcher';
import { ModuleDrawer } from '../navigation/module-drawer';

const APP_MODULES = getVisibleMenu();

type ModuleLayoutProps = {
  children: ReactNode;
  module: MenuModule;
  selectedItemId: string;
};

export function ModuleLayout({ children, module, selectedItemId }: ModuleLayoutProps) {
  const { user, logout } = useAuth();
  const [applicationsVisible, setApplicationsVisible] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [message, setMessage] = useState('');

  function openModule(nextModule: MenuModule) {
    setApplicationsVisible(false);
    router.replace({ pathname: '/module/[moduleId]', params: { moduleId: nextModule.id } } as Href);
  }

  function openItem(item: MenuItem) {
    setDrawerVisible(false);
    router.replace({
      pathname: '/module/[moduleId]/[itemId]',
      params: { moduleId: module.id, itemId: item.id },
    } as Href);
  }

  async function handleLogout() {
    setDrawerVisible(false);
    await logout();
    router.replace('/login');
  }

  return (
    <AppScreenLayout
      icon={module.icon}
      iconColor={module.color}
      onApplicationsPress={() => setApplicationsVisible(true)}
      onMenuPress={() => setDrawerVisible(true)}
      onNotificationsPress={() => setMessage('No tienes notificaciones nuevas')}
      onProfilePress={() => setDrawerVisible(true)}
      title={module.title}
      userName={user?.name}
    >
      {children}

      <ApplicationSwitcher
        modules={APP_MODULES}
        onClose={() => setApplicationsVisible(false)}
        onModulePress={openModule}
        visible={applicationsVisible}
      />
      <ModuleDrawer
        module={module}
        onApplicationsPress={() => {
          setDrawerVisible(false);
          setTimeout(() => setApplicationsVisible(true), 180);
        }}
        onClose={() => setDrawerVisible(false)}
        onItemPress={openItem}
        onLogoutPress={handleLogout}
        selectedItemId={selectedItemId}
        user={user}
        visible={drawerVisible}
      />
      <Snackbar duration={2600} onDismiss={() => setMessage('')} visible={Boolean(message)}>
        {message}
      </Snackbar>
    </AppScreenLayout>
  );
}
