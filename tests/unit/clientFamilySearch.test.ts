import { describe, it, expect } from 'vitest';
import {
  enrichClientsWithFamilyContext,
  getEligibleDependentCandidates,
  searchClientsWithDependents,
  type SearchableFamilyClient,
} from '../../src/utils/clientFamilySearch';

const buildFamilyFixtures = (): SearchableFamilyClient[] => [
  {
    id: 'parent-israel',
    name: 'Israel Oliveira',
    phone: '11958713888',
    parent_client_id: null,
    is_shared_phone: false,
  },
  {
    id: 'child-samuel-israel',
    name: 'Samuel',
    phone: '11958713888',
    parent_client_id: 'parent-israel',
    is_shared_phone: true,
  },
  {
    id: 'child-davi-israel',
    name: 'Davi',
    phone: '',
    parent_client_id: 'parent-israel',
    is_shared_phone: true,
  },
  {
    id: 'parent-elvinho',
    name: 'Elvinho',
    phone: '11994496447',
    parent_client_id: null,
    is_shared_phone: false,
  },
  {
    id: 'child-pietro-elvinho',
    name: 'Pietro',
    phone: '11994496447',
    parent_client_id: 'parent-elvinho',
    is_shared_phone: true,
  },
  {
    id: 'parent-carlos',
    name: 'Carlos Souza',
    phone: '11988887777',
    parent_client_id: null,
    is_shared_phone: false,
  },
  {
    id: 'child-samuel-carlos',
    name: 'Samuel',
    phone: '11988887777',
    parent_client_id: 'parent-carlos',
    is_shared_phone: true,
  },
  {
    id: 'solo-marcos',
    name: 'Marcos Rocha',
    phone: '11977776666',
    parent_client_id: null,
    is_shared_phone: false,
  },
];

describe('clientFamilySearch', () => {
  it('should_return_parent_followed_by_all_dependents_when_searching_by_parent_name', () => {
    // Arrange
    const clients = buildFamilyFixtures();

    // Act
    const results = searchClientsWithDependents(clients, 'Israel');

    // Assert
    expect(results.map((r) => r.id)).toEqual([
      'parent-israel',
      'child-samuel-israel',
      'child-davi-israel',
    ]);
    expect(results[0].isDependent).toBe(false);
    expect(results[0].dependentsCount).toBe(2);
    expect(results[1].parentName).toBe('Israel Oliveira');
    expect(results[1].matchedViaParent).toBe(true);
    expect(results[2].parentName).toBe('Israel Oliveira');
    expect(results[2].effectivePhone).toBe('11958713888');
  });

  it('should_return_parent_and_dependents_without_duplicates_when_searching_by_family_phone', () => {
    // Arrange
    const clients = buildFamilyFixtures();

    // Act
    const results = searchClientsWithDependents(clients, '95871-3888');

    // Assert
    expect(results.map((r) => r.id)).toEqual([
      'parent-israel',
      'child-samuel-israel',
      'child-davi-israel',
    ]);
  });

  it('should_return_dependent_with_parent_name_when_searching_by_child_name', () => {
    // Arrange
    const clients = buildFamilyFixtures();

    // Act
    const results = searchClientsWithDependents(clients, 'Pietro');

    // Assert
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('child-pietro-elvinho');
    expect(results[0].isDependent).toBe(true);
    expect(results[0].parentName).toBe('Elvinho');
    expect(results[0].effectivePhone).toBe('11994496447');
    expect(results[0].matchedViaParent).toBe(false);
  });

  it('should_distinguish_homonymous_children_from_different_families_by_parent_name_and_phone', () => {
    // Arrange
    const clients = buildFamilyFixtures();

    // Act
    const results = searchClientsWithDependents(clients, 'Samuel');

    // Assert
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      id: 'child-samuel-israel',
      name: 'Samuel',
      parentName: 'Israel Oliveira',
      effectivePhone: '11958713888',
    });
    expect(results[1]).toMatchObject({
      id: 'child-samuel-carlos',
      name: 'Samuel',
      parentName: 'Carlos Souza',
      effectivePhone: '11988887777',
    });
  });

  it('should_exclude_self_dependents_and_existing_parents_when_listing_eligible_dependent_candidates', () => {
    // Arrange
    const clients = buildFamilyFixtures();

    // Act
    const candidatesForIsrael = getEligibleDependentCandidates(clients, 'parent-israel');
    const candidatesForDependent = getEligibleDependentCandidates(clients, 'child-samuel-israel');

    // Assert
    // Apenas 'solo-marcos' não é dependente nem pai de outros dependentes
    expect(candidatesForIsrael.map((c) => c.id)).toEqual(['solo-marcos']);
    // Um dependente não pode ter dependentes (limite de 1 nível)
    expect(candidatesForDependent).toEqual([]);
  });

  it('should_enrich_dependents_with_inherited_phone_when_own_phone_is_empty', () => {
    // Arrange
    const clients = buildFamilyFixtures();

    // Act
    const enriched = enrichClientsWithFamilyContext(clients);
    const davi = enriched.find((c) => c.id === 'child-davi-israel');

    // Assert
    expect(davi?.effectivePhone).toBe('11958713888');
    expect(davi?.parentName).toBe('Israel Oliveira');
  });
});
