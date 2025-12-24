/**
 * Device query data models
 * Generated from Python Pydantic models
 */

export interface DeviceDocs {
  isSharedWithUser?: boolean;
  orgId?: number;
  templateId?: string;
  name?: string;
  token?: string;
  deviceId?: number;
  productId?: number;
  ownerId?: number;
  productName?: string;
  isLocked?: boolean;
  email?: string;
  userId?: number;
  icon?: string;
  color?: string;
  type?: string;
}

export interface EviqoDeviceQueryModel {
  count: number;
  docs: Array<Array<number | string | unknown[] | DeviceDocs>>;
}
