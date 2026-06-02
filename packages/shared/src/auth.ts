export enum CrmUserRole {
  Sales = 'SALES',
  Build = 'BUILD',
  Partner = 'PARTNER',
}

export enum CrmUserStatus {
  Active = 'active',
  Pending = 'pending',
  Rejected = 'rejected',
}

export enum CrmAuthTokenType {
  Access = 'access',
  Refresh = 'refresh',
}

export enum CrmAuthCookieName {
  Access = 'crm_access_token',
  Refresh = 'crm_refresh_token',
}

export enum HttpMethod {
  Get = 'GET',
  Head = 'HEAD',
  Options = 'OPTIONS',
  Post = 'POST',
  Put = 'PUT',
  Patch = 'PATCH',
  Delete = 'DELETE',
}
