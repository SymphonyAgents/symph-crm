export class UpdateCatalogItemDto {
  productType?: 'internal' | 'service' | 'reseller' | 'partnership'
  slug?: string | null
  name?: string
  industry?: string | null
  landingPageLink?: string | null
  iconUrl?: string | null
  isActive?: boolean
}
