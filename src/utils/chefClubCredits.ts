/**
 * [SMG][DOMAIN][CHEF_CLUB] credits (re-export)
 *
 * Re-export barrel para backward compatibility.
 * Código canônico agora está em domain/chefClub/credits.ts.
 */
export {
  type ServiceCreditsEntry,
  type ServiceBalanceEntry,
  normalizePlanServiceCredits,
  normalizeCreditBalances,
  normalizeServiceBalanceEntry,
  getTotalPlannedCredits,
  getTotalAvailableCredits,
  getTotalUsedCredits,
  getAvailableCreditsForService,
  getPlanCreditsForService,
  buildServiceBalancesFromPlan,
} from '../../domain/chefClub/credits';
