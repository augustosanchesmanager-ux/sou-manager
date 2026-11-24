import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import Sidebar, {
  buildRawSidebarMenu,
  filterSidebarMenu,
  isSidebarPathActive,
} from '../../components/Sidebar';
import { getBusinessLabels } from '../../src/lib/apps/businessLabels';

const mockUseAuth = vi.fn();
const mockUseFeatureFlags = vi.fn();

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../../src/hooks/useFeatureFlags', () => ({
  useFeatureFlags: () => mockUseFeatureFlags(),
}));

describe('Sidebar Navigation Architecture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      accessRole: 'manager',
      canAccessSuperAdmin: false,
      appSlug: 'barber',
    });
    mockUseFeatureFlags.mockReturnValue({
      can: () => true,
    });
  });

  const buildMenu = () =>
    buildRawSidebarMenu({
      isEsteticaApp: false,
      labels: getBusinessLabels('barber'),
      unreadNotificationsCount: 2,
      releaseNotesUnseen: false,
      onClose: vi.fn(),
      onOpenNotifications: vi.fn(),
      onOpenReleaseNotes: vi.fn(),
    });

  it('should_organize_groups_without_duplicate_routes_for_barber_manager', () => {
    // Arrange
    const raw = buildMenu();

    // Act
    const filtered = filterSidebarMenu({
      rawMenuStructure: raw,
      isEsteticaApp: false,
      isOperationalOnly: false,
      canAccessSuperAdmin: false,
      isModuleAllowed: () => true,
    });
    const groupNames = filtered.map((group) => group.name);
    const paths = filtered.flatMap((group) =>
      (group.items || []).map((item) => item.path).filter(Boolean) as string[],
    );

    // Assert
    expect(groupNames).toEqual([
      'Principal',
      'Club dos Chefes',
      'Cadastros',
      'CRM & Retenção',
      'Estoque & Compras',
      'Financeiro',
      'Relatórios',
      'Configurações',
      'Sistema',
    ]);
    expect(paths).toContain('/quality');
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('should_isolate_chef_club_group_with_all_three_club_routes', () => {
    // Arrange
    const raw = buildMenu();

    // Act
    const clubGroup = raw.find((group) => group.name === 'Club dos Chefes');
    const clubPaths = (clubGroup?.items || []).map((item) => item.path);

    // Assert
    expect(clubGroup).toBeDefined();
    expect(clubPaths).toEqual([
      '/chef-club-subscriptions',
      '/chef-club-receivables',
      '/chef-club-plans',
    ]);
  });

  it('should_separate_stock_and_purchases_from_cadastros', () => {
    // Arrange
    const raw = buildMenu();

    // Act
    const cadastrosPaths = (raw.find((group) => group.name === 'Cadastros')?.items || []).map((i) => i.path);
    const crmPaths = (raw.find((group) => group.name === 'CRM & Retenção')?.items || []).map((i) => i.path);
    const stockPaths = (raw.find((group) => group.name === 'Estoque & Compras')?.items || []).map((i) => i.path);

    // Assert
    expect(cadastrosPaths).toEqual(['/clients', '/team', '/services', '/promotions']);
    expect(crmPaths).toEqual(['/smart-return']);
    expect(stockPaths).toEqual(['/products', '/categories', '/orders', '/suppliers']);
  });

  it('should_hide_observability_and_superadmin_from_barber_manager_in_system_group', () => {
    // Arrange
    const raw = buildMenu();

    // Act
    const filtered = filterSidebarMenu({
      rawMenuStructure: raw,
      isEsteticaApp: false,
      isOperationalOnly: false,
      canAccessSuperAdmin: false,
      isModuleAllowed: () => true,
    });
    const systemItems = (filtered.find((group) => group.name === 'Sistema')?.items || []).map((i) => i.name);

    // Assert
    expect(systemItems).toEqual(['Avisos', 'Novidades']);
    expect(systemItems).not.toContain('Observabilidade');
    expect(systemItems).not.toContain('Super Admin');
    expect(systemItems).not.toContain('Event Versioning');
  });

  it('should_hide_observability_and_superadmin_from_operational_staff_in_system_group', () => {
    // Arrange
    const raw = buildMenu();

    // Act
    const filtered = filterSidebarMenu({
      rawMenuStructure: raw,
      isEsteticaApp: false,
      isOperationalOnly: true,
      canAccessSuperAdmin: false,
      isModuleAllowed: () => true,
    });
    const systemItems = (filtered.find((group) => group.name === 'Sistema')?.items || []).map((i) => i.name);

    // Assert
    expect(systemItems).toEqual(['Avisos', 'Novidades']);
  });

  it('should_expose_observability_and_superadmin_without_event_versioning_when_user_is_superadmin', () => {
    // Arrange
    const raw = buildMenu();

    // Act
    const filtered = filterSidebarMenu({
      rawMenuStructure: raw,
      isEsteticaApp: false,
      isOperationalOnly: false,
      canAccessSuperAdmin: true,
      isModuleAllowed: () => true,
    });
    const systemItems = (filtered.find((group) => group.name === 'Sistema')?.items || []).map((i) => i.name);

    // Assert
    expect(systemItems).toEqual([
      'Avisos',
      'Novidades',
      'Observabilidade',
      'Super Admin',
    ]);
    expect(systemItems).not.toContain('Event Versioning');
  });

  it('should_hide_observability_from_manager_and_show_for_superadmin_in_rendered_sidebar', () => {
    // Act — manager comum não vê Observabilidade nem Super Admin
    const managerHtml = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/observability']}>
        <Sidebar isOpen={true} onClose={vi.fn()} />
      </MemoryRouter>,
    );

    // Assert
    expect(managerHtml).toContain('Club dos Chefes');
    expect(managerHtml).toContain('Estoque &amp; Compras');
    expect(managerHtml).not.toContain('Observabilidade');
    expect(managerHtml).not.toContain('Super Admin');

    // Act — superadmin vê Observabilidade e Super Admin
    mockUseAuth.mockReturnValue({
      accessRole: 'superadmin',
      canAccessSuperAdmin: true,
      appSlug: 'barber',
    });
    const superAdminHtml = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/observability']}>
        <Sidebar isOpen={true} onClose={vi.fn()} />
      </MemoryRouter>,
    );

    expect(superAdminHtml).toContain('Observabilidade');
    expect(superAdminHtml).toContain('Super Admin');
  });

  it('should_match_subroutes_accurately_when_evaluating_active_sidebar_path', () => {
    expect(isSidebarPathActive('/chef-club-subscriptions/new', '/chef-club-subscriptions')).toBe(true);
    expect(isSidebarPathActive('/orders/order-123', '/orders')).toBe(true);
    expect(isSidebarPathActive('/chef-club-plans', '/chef-club-subscriptions')).toBe(false);
    expect(isSidebarPathActive('/checkout/abc', '/checkout?mode=pdv')).toBe(true);
  });
});
