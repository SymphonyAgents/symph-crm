export enum PartnerCommissionStatus {
  Pending = 'pending',
  Approved = 'approved',
  Paid = 'paid',
  Void = 'void',
}

export const PARTNER_COMMISSION_STATUSES = [
  PartnerCommissionStatus.Pending,
  PartnerCommissionStatus.Approved,
  PartnerCommissionStatus.Paid,
  PartnerCommissionStatus.Void,
] as const
