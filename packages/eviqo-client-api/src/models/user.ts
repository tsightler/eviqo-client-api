/**
 * User data models for Eviqo authentication
 * Generated from Python Pydantic models
 */

export interface IpInfo {
  ip: string;
  country: string;
  isoStateCode: string;
  lat: number;
  lon: number;
}

export interface User {
  id: number;
  roleId: number;
  email: string;
  tz: string;
  locale: string;
  orgId: number;
  status: string;
  lastLoggedAt: number;
  registeredAt: number;
  ipInfo: IpInfo;
  country: string;
  phoneNumber: string;
  customFields: Record<string, unknown>;
  isDev: boolean;
  isDarkMode: boolean;
  address: Record<string, unknown>;
}

export interface Role {
  id: number;
  name: string;
  permissionGroup1: number;
  permissionGroup2: number;
  permissionGroup3: number;
  permissionGroup4: number;
}

export interface Address {
  fullAddress: string;
  city: string;
  country: string;
  state: string;
  zip: string;
}

export interface SmsSettings {
  enabled: boolean;
  provider: string;
}

export interface Organization {
  id: number;
  name: string;
  type: string;
  tz: string;
  lastModifiedTs: number;
  parentId: number;
  parentOrgName: string;
  roles: Role[];
  hierarchy: number[];
  deviceCount: number;
  childrenCount: number;
  userCount: number;
  totalUserCount: number;
  templatesCount: number;
  hasAnalytic: boolean;
  address: Address;
  phoneNumber: string;
  areAutomationConditionsEnabled: boolean;
  areAutomationActionsEnabled: boolean;
  hasAutomations: boolean;
  hasProductWithContentEvent: boolean;
  hasEventAnalyticsDashboards: boolean;
  smsSettings: SmsSettings;
  isShared: boolean;
}

export interface GeneralSettings {
  appName: string;
  locationTerm: string;
  isGeoCloud: boolean;
  isBillingEnabled: boolean;
  allowedClientTypes: string[];
  allowRegisterFrom: string[];
  theme: string;
  period: string;
  websiteUrl: string;
  docsUrl: string;
  defaultRoleId: number;
  isFleetEnabled: boolean;
  isDREnabled: boolean;
  isRuleEngineEnabled: boolean;
  isInAppCampaignsEnabled: boolean;
  isSharingEnabled: boolean;
  isInviteWithoutVerificationEnabled: boolean;
  useOldReportingFormat: boolean;
  isTranslationEnabled: boolean;
  isBLEAssistEnabled: boolean;
  isBlueprintsEnabled: boolean;
  isImageStreamingEnabled: boolean;
  isUnitConversionEnabled: boolean;
  isHealthCheckWorkerEnabled: boolean;
  isShipmentsMobileDownloadEnabled: boolean;
  isOrgDataStoragePeriodEnabled: boolean;
  isMobileConnectedRuleEnabled: boolean;
  isUserInMultipleOrganizationsEnabled: boolean;
  isCustomDataEnabled: boolean;
  isCustomRolesEnabled: boolean;
  isRawStringStorageEnabled: boolean;
  isAiEnabled: boolean;
  isDecodersEnabled: boolean;
  isWLBillingEnabled: boolean;
  isManagementApiEnabled: boolean;
}

export interface EviqoUserModel {
  user: User;
  organization: Organization;
  role: Role;
  showSurvey: boolean;
  generalSettings: GeneralSettings;
  mapboxToken: string;
  hasSimCardInfo: boolean;
  deviceFileStorageEnabled: boolean;
  serverVersion: string;
  sharedOrgsCount: number;
}
