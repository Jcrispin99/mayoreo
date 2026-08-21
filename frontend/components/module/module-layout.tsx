import { router, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { getVisibleMenu, type MenuItem, type MenuModule } from '../../config/menu';
import { useAuth } from '../../lib/auth-context';
import { usePriceNotifications } from '../../lib/price-notifications-context';
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
  const { openNotifications, unreadCount } = usePriceNotifications();
  const [applicationsVisible, setApplicationsVisible] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const selectedItemTitle = module.items.find((item) => item.id === selectedItemId)?.title ?? module.title;
  const canMarkAttendance = user !== null && (!user.permissions || user.permissions.includes('attendance.mark'));

  function openModule(nextModule: MenuModule) {
    setApplicationsVisible(false);
    router.replace({ pathname: '/module/[moduleId]', params: { moduleId: nextModule.id } } as Href);
  }

  function openAttendanceMark() {
    setApplicationsVisible(false);
    router.replace({
      pathname: '/module/[moduleId]/[itemId]',
      params: { moduleId: 'access', itemId: 'attendance-mark' },
    } as Href);
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
      onAttendanceMarkPress={canMarkAttendance ? openAttendanceMark : undefined}
      onMenuPress={() => setDrawerVisible(true)}
      notificationCount={unreadCount}
      onNotificationsPress={openNotifications}
      onProfilePress={() => setDrawerVisible(true)}
      title={selectedItemTitle}
      userName={user?.name}
    >
      {children}

      <ApplicationSwitcher
        canMarkAttendance={canMarkAttendance}
        modules={APP_MODULES}
        onClose={() => setApplicationsVisible(false)}
        onAttendanceMarkPress={openAttendanceMark}
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
    </AppScreenLayout>
  );
}
