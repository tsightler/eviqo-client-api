/**
 * Widget update data class
 */

import { DisplayDataStream } from './device-page';

export interface WidgetUpdate {
  widgetId: string;
  widgetStream: DisplayDataStream;
  deviceId: string;
  widgetValue: string;
  time: Date;
}
