/**
 * Device page data models
 * Generated from Python Pydantic models
 */

export interface LifecycleStatus {
  name: string;
  icon: string;
  color: string;
  type: string;
}

export interface IpInfo {
  ip: string;
  country: string;
  isoStateCode: string;
  lat: number;
  lon: number;
}

export interface Header {
  name: string;
  type: string;
}

export interface Row {
  values: string[];
}

export interface MetaField {
  id: number;
  isEditableByUser: boolean;
  includeInProvision: boolean;
  isMandatory: boolean;
  isExcludedFromRecentUsed: boolean;
  isDisabled: boolean;
  icon?: string;
  isDefault: boolean;
  value?: string;
  name: string;
  type: string;
  userId?: number;
  description?: string;
  isFirstNameEnabled?: boolean;
  isLastNameEnabled?: boolean;
  isEmailEnabled?: boolean;
  isPhoneEnabled?: boolean;
  streetAddress?: string;
  isStreetAddressEnabled?: boolean;
  isStreetAddress2Enabled?: boolean;
  country?: string;
  isCountryEnabled?: boolean;
  city?: string;
  isCityEnabled?: boolean;
  state?: string;
  isStateEnabled?: boolean;
  zip?: string;
  isZipEnabled?: boolean;
  isDefaultsEnabled?: boolean;
  filename?: string;
  headers?: Header[];
  rows?: Row[];
  selectedRowIndex?: number;
}

export interface HardwareInfo {
  version: string;
  fwType: string;
  blynkVersion: string;
  build: string;
  templateId: string;
  heartbeatInterval: number;
  buffIn: number;
  type: string;
}

export interface TabPage {
  id: number;
  name: string;
  hideTimeRange: boolean;
}

export interface Visualization {
  type: string;
  value: string;
}

export interface OnOffDataStream {
  id: number;
  name: string;
  visualization: Visualization;
  pin: number;
  units: string;
}

export interface Visualization1 {
  type: string;
  value: string;
  step?: number;
  min?: number;
  max?: number;
  units?: string;
}

export interface DisplayDataStream {
  id: number;
  name: string;
  visualization: Visualization1;
  pin: number;
  units: string;
}

export interface Module {
  name: string;
  onOffDataStream: OnOffDataStream;
  displayDataStreams: DisplayDataStream[];
  backgroundColor: string;
}

export interface Widget {
  type: string;
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  isDisabled: boolean;
  isHidden: boolean;
  modules: Module[];
  alignment: string;
}

export interface Dashboard {
  widgets: Widget[];
  hideTimeRange: boolean;
  lifecycleStatus: LifecycleStatus;
}

export interface EviqoDevicePageModel {
  id: number;
  productId: number;
  orgId: number;
  name: string;
  token: string;
  updatedAt: number;
  status: string;
  lifecycleStatus: LifecycleStatus;
  activatedAt: number;
  activatedBy: string;
  disconnectTime: number;
  ipInfo: IpInfo;
  metadataUpdatedAt: number;
  metadataUpdatedBy?: string;
  lastReportedAt: number;
  connectTime: number;
  iconName: string;
  color: number;
  metaFields: MetaField[];
  productName: string;
  productLogoUrl: string;
  orgName: string;
  ownerEmail: string;
  ownerId: number;
  ownerOrgId: number;
  hardwareInfo: HardwareInfo;
  productHierarchy: number[];
  locationId: number;
  isSsl: boolean;
  showOnMap: boolean;
  originalProductOrgId: number;
  automationsCount: number;
  tabPages: TabPage[];
  dashboard: Dashboard;
  templateId: string;
  tz: string;
  connectionType: string;
  isSharedWithUser: boolean;
  isLocked: boolean;
}
