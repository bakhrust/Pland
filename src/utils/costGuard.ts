export type CostGuardScope = 'firestore:read' | 'firestore:write' | 'gcal:api';

export interface WindowRule {
  windowMs: number;
  maxRequests: number;
}

export interface ScopePolicy {
  rules: WindowRule[];
  cooldownMs: number;
}

export const DEFAULT_COST_GUARD_POLICIES: Record<CostGuardScope, ScopePolicy> = {
  'firestore:read': {
    rules: [
      { windowMs: 15_000, maxRequests: 40 },
      { windowMs: 60_000, maxRequests: 120 },
    ],
    cooldownMs: 5_000,
  },
  'firestore:write': {
    rules: [
      { windowMs: 10_000, maxRequests: 80 },
      { windowMs: 60_000, maxRequests: 250 },
    ],
    cooldownMs: 5_000,
  },
  'gcal:api': {
    rules: [
      { windowMs: 15_000, maxRequests: 30 },
      { windowMs: 60_000, maxRequests: 100 },
    ],
    cooldownMs: 5_000,
  },
};

export class CostGuardError extends Error {
  readonly scope: CostGuardScope;
  readonly retryAfterMs: number;

  constructor(scope: CostGuardScope, retryAfterMs: number) {
    const seconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
    super(
      `Сработала защита от лишних запросов (${scope}). Повторите через ${seconds} сек.`
    );
    this.name = 'CostGuardError';
    this.scope = scope;
    this.retryAfterMs = retryAfterMs;
  }
}

export function isCostGuardError(error: unknown): error is CostGuardError {
  if (error instanceof CostGuardError) return true;
  if (error instanceof Error && error.name === 'CostGuardError') return true;
  return false;
}

export function createCostGuard(
  policies: Record<CostGuardScope, ScopePolicy> = DEFAULT_COST_GUARD_POLICIES,
  nowFn: () => number = () => Date.now()
) {
  const history = new Map<CostGuardScope, number[]>();
  const blockedUntil = new Map<CostGuardScope, number>();

  function consume(scope: CostGuardScope, cost = 1): void {
    const safeCost = Math.max(1, Math.floor(cost));
    const policy = policies[scope];
    const now = nowFn();

    const cooldownEnd = blockedUntil.get(scope) ?? 0;
    if (now < cooldownEnd) {
      throw new CostGuardError(scope, cooldownEnd - now);
    }

    const maxWindowMs = policy.rules.reduce((acc, r) => Math.max(acc, r.windowMs), 0);
    const cutoff = now - maxWindowMs;
    const prevTimestamps = (history.get(scope) ?? []).filter((ts) => ts > cutoff);

    for (const rule of policy.rules) {
      const ruleCutoff = now - rule.windowMs;
      let countInWindow = 0;
      for (let i = prevTimestamps.length - 1; i >= 0; i -= 1) {
        if (prevTimestamps[i] > ruleCutoff) {
          countInWindow += 1;
        } else {
          break;
        }
      }
      if (countInWindow + safeCost > rule.maxRequests) {
        blockedUntil.set(scope, now + policy.cooldownMs);
        history.set(scope, prevTimestamps);
        throw new CostGuardError(scope, policy.cooldownMs);
      }
    }

    for (let i = 0; i < safeCost; i += 1) {
      prevTimestamps.push(now);
    }
    history.set(scope, prevTimestamps);
  }

  function reset(scope?: CostGuardScope): void {
    if (scope) {
      history.delete(scope);
      blockedUntil.delete(scope);
    } else {
      history.clear();
      blockedUntil.clear();
    }
  }

  return { consume, reset };
}

const globalCostGuard = createCostGuard();

export function consumeCostBudget(scope: CostGuardScope, cost = 1): void {
  globalCostGuard.consume(scope, cost);
}

export function resetCostGuard(): void {
  globalCostGuard.reset();
}
