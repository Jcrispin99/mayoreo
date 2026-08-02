import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { DataTable, type DataTableColumn } from '../../components/data/data-table';
import { ListToolbar } from '../../components/data/list-toolbar';
import { api, apiErrorMessage } from '../../lib/api';
import type { AccessItem, AccessResourceKind, Role, UserAccount } from './access-types';

type AccessReferenceListProps = {
  kind: AccessResourceKind;
};

const PAGE_SIZE = 20;
const CONFIG = {
  users: { endpoint: '/users', title: 'Usuarios', empty: 'usuarios' },
  roles: { endpoint: '/roles', title: 'Roles', empty: 'roles' },
} as const;

const USER_FILTERS = [
  { id: 'verified', label: 'Verificados', group: 'Correo' },
  { id: 'unverified', label: 'Sin verificar', group: 'Correo' },
  { id: 'with-roles', label: 'Con roles', group: 'Roles' },
  { id: 'without-roles', label: 'Sin roles', group: 'Roles' },
];

const ROLE_FILTERS = [
  { id: 'with-permissions', label: 'Con permisos', group: 'Permisos' },
  { id: 'without-permissions', label: 'Sin permisos', group: 'Permisos' },
];

function itemSearchText(kind: AccessResourceKind, item: AccessItem) {
  if (kind === 'users') {
    const user = item as UserAccount;
    return `${user.name} ${user.email} ${user.roles.map((role) => role.name).join(' ')}`;
  }
  const role = item as Role;
  return `${role.name} ${(role.permissions ?? []).map((permission) => permission.name).join(' ')}`;
}

function matchesFilters(kind: AccessResourceKind, item: AccessItem, filterIds: string[]) {
  if (kind === 'users') {
    const user = item as UserAccount;
    const emailFilters = filterIds.filter((id) => id === 'verified' || id === 'unverified');
    const roleFilters = filterIds.filter((id) => id === 'with-roles' || id === 'without-roles');
    const matchesEmail = emailFilters.length === 0
      || (user.email_verified_at ? emailFilters.includes('verified') : emailFilters.includes('unverified'));
    const matchesRoles = roleFilters.length === 0
      || (user.roles.length > 0 ? roleFilters.includes('with-roles') : roleFilters.includes('without-roles'));
    return matchesEmail && matchesRoles;
  }

  const role = item as Role;
  const hasPermissions = (role.permissions?.length ?? 0) > 0;
  return filterIds.length === 0
    || (hasPermissions ? filterIds.includes('with-permissions') : filterIds.includes('without-permissions'));
}

function itemMeta(kind: AccessResourceKind, item: AccessItem) {
  if (kind === 'users') {
    const user = item as UserAccount;
    const roles = user.roles.map((role) => role.name).join(', ') || 'Sin roles';
    return `${user.email} · ${roles}`;
  }
  const permissionCount = (item as Role).permissions?.length ?? 0;
  return `${permissionCount} ${permissionCount === 1 ? 'permiso' : 'permisos'}`;
}

export function AccessReferenceList({ kind }: AccessReferenceListProps) {
  const config = CONFIG[kind];
  const [items, setItems] = useState<AccessItem[]>([]);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [activeFilterIds, setActiveFilterIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadItems = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      const response = await api.get(config.endpoint);
      setItems(response.data.data ?? []);
    } catch (requestError) {
      setError(apiErrorMessage(requestError, `No se pudieron cargar ${config.title.toLocaleLowerCase('es')}.`));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [config.endpoint, config.title]);

  useFocusEffect(useCallback(() => {
    void loadItems();
  }, [loadItems]));

  useEffect(() => {
    setPage(1);
    setQuery('');
    setActiveFilterIds([]);
  }, [kind]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('es');
    return items.filter((item) => {
      const matchesQuery = !normalizedQuery
        || itemSearchText(kind, item).toLocaleLowerCase('es').includes(normalizedQuery);
      return matchesQuery && matchesFilters(kind, item, activeFilterIds);
    });
  }, [activeFilterIds, items, kind, query]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleItems = useMemo(
    () => filteredItems.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [currentPage, filteredItems],
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const columns = useMemo<DataTableColumn<AccessItem>[]>(() => [
    {
      key: 'detail',
      title: 'Detalle',
      style: styles.detailColumn,
      renderCell: (item) => (
        <View>
          <View style={styles.nameRow}>
            <Text numberOfLines={1} style={styles.name}>{item.name}</Text>
            {kind === 'users' && !(item as UserAccount).email_verified_at
              ? <Text style={styles.pending}>Sin verificar</Text>
              : null}
          </View>
          <Text numberOfLines={2} style={styles.meta}>{itemMeta(kind, item)}</Text>
        </View>
      ),
    },
    {
      key: 'action',
      title: '',
      style: styles.actionColumn,
      renderCell: () => <Icon source="chevron-right" color="#60706E" size={22} />,
    },
  ], [kind]);

  function toggleFilter(filterId: string) {
    setActiveFilterIds((current) => current.includes(filterId)
      ? current.filter((id) => id !== filterId)
      : [...current, filterId]);
    setPage(1);
  }

  function openForm(item?: AccessItem) {
    const pathname = item ? '/access/[resource]/[itemId]' : '/access/[resource]/new';
    router.push({
      pathname,
      params: { resource: kind, ...(item ? { itemId: String(item.id) } : {}) },
    } as Href);
  }

  const filtered = Boolean(query.trim()) || activeFilterIds.length > 0;

  return (
    <View style={styles.screen}>
      <ListToolbar
        activeFilterIds={activeFilterIds}
        filterOptions={kind === 'users' ? USER_FILTERS : ROLE_FILTERS}
        onCreate={() => openForm()}
        onPageChange={setPage}
        onQueryChange={(value) => {
          setQuery(value);
          setPage(1);
        }}
        onToggleFilter={toggleFilter}
        page={currentPage}
        pageSize={PAGE_SIZE}
        query={query}
        title={config.title}
        totalItems={filteredItems.length}
      />
      <DataTable
        columns={columns}
        data={visibleItems}
        emptyIcon={kind === 'users' ? 'account-group-outline' : 'shield-account-outline'}
        emptyText={filtered ? 'Prueba con otro texto o cambia los filtros.' : 'Usa “Nuevo” para crear el primer registro.'}
        emptyTitle={filtered ? 'Sin resultados' : `Aún no hay ${config.empty}`}
        error={error}
        keyExtractor={(item) => String(item.id)}
        loading={loading}
        onRefresh={() => void loadItems(true)}
        onRetry={() => void loadItems()}
        onRowPress={openForm}
        refreshing={refreshing}
        rowAccessibilityLabel={(item) => `Editar ${item.name}`}
        rowStyle={styles.compactRow}
        showHeader={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F6F5' },
  compactRow: { minHeight: 68, paddingHorizontal: 16, paddingVertical: 9 },
  detailColumn: { flex: 1 },
  actionColumn: { width: 42, alignItems: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flexShrink: 1, color: '#172423', fontSize: 14, fontWeight: '800' },
  meta: { marginTop: 4, color: '#60706E', fontSize: 11, lineHeight: 15 },
  pending: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 7, color: '#925300', backgroundColor: '#FFF1D6', fontSize: 9, fontWeight: '800' },
});
