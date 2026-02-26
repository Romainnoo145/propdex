import type { ZoningPlan } from '@/lib/types/property'

const POLICY_TYPE_KEYWORDS = [
  'structuurvisie',
  'omgevingsvisie',
  'programma',
  'beleidsregel',
  'beleidsnota',
  'visie',
]

const POLICY_NAME_KEYWORDS = [
  'programma noordzee',
  'nationaal water programma',
  'nationale omgevingsvisie',
  'provinciale omgevingsvisie',
  'structuurvisie',
  'omgevingsvisie',
]

const normalize = (value?: string | null): string =>
  (value ?? '').trim().toLowerCase()

export const isPolicyPlan = (plan: ZoningPlan): boolean => {
  const planType = normalize(plan.plan_type)
  const planName = normalize(plan.plan_naam)

  if (POLICY_TYPE_KEYWORDS.some((keyword) => planType.includes(keyword))) {
    return true
  }

  if (POLICY_NAME_KEYWORDS.some((keyword) => planName.includes(keyword))) {
    return true
  }

  return false
}

export function splitZoningPlans(plans: ZoningPlan[] | null | undefined): {
  actionablePlans: ZoningPlan[]
  policyPlans: ZoningPlan[]
} {
  const allPlans = plans ?? []
  const actionablePlans: ZoningPlan[] = []
  const policyPlans: ZoningPlan[] = []

  for (const plan of allPlans) {
    if (isPolicyPlan(plan)) {
      policyPlans.push(plan)
    } else {
      actionablePlans.push(plan)
    }
  }

  return { actionablePlans, policyPlans }
}
