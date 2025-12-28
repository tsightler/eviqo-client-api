# Eviqo MQTT Gateway

This addon bridges your Eviqo EV charger to MQTT, enabling seamless integration with Home Assistant through auto-discovery.

## Features

- **Automatic Entity Discovery**: Sensors and controls automatically appear in Home Assistant
- **Real-time Updates**: Charging status, power, voltage, and session data
- **Charging Control**: Start/stop charging sessions via Home Assistant switch
- **Current Limit Control**: Adjust charging current via slider (0-48A)

## Entities Created

### Sensors
- **Status**: Current charger state (unplugged, plugged, charging, stopped)
- **Voltage**: Line voltage (V)
- **Power**: Current charging power (kW)
- **Amperage**: Current draw (A)
- **Session Duration**: Current session length
- **Session Power**: Energy delivered this session (kWh)
- **Session Cost**: Cost of current session

### Controls
- **Charging**: Switch to start/stop charging
- **Current Limit**: Number slider to set max charging current (A)

### Binary Sensors
- **Connectivity**: Online/offline status

## Configuration

### MQTT Settings

The addon supports automatic MQTT discovery using special `auto_*` placeholders in the URL.

#### Auto-Discovery (Default)
The default `mqtt_url` is:
```
mqtt://auto_username:auto_password@auto_hostname
```

When the addon starts, any `auto_*` values are automatically replaced with the MQTT broker settings discovered from Home Assistant's Mosquitto addon:
- `auto_hostname` → Discovered MQTT host
- `auto_username` → Discovered MQTT username
- `auto_password` → Discovered MQTT password

#### Manual Configuration
If using an external MQTT broker, replace the auto values with your broker details:
- **mqtt_url**: Full MQTT broker URL
  - Format: `mqtt://host:port` or `mqtt://user:pass@host:port`
  - Example: `mqtt://192.168.1.100:1883`
  - With auth: `mqtt://myuser:mypass@192.168.1.100:1883`

#### Mixed Mode
You can mix auto and manual values. For example, to use auto-discovered credentials with a custom host:
```
mqtt://auto_username:auto_password@192.168.1.100:1883
```

### Eviqo Credentials

Enter your Eviqo app credentials:
- **eviqo_email**: Your Eviqo account email
- **eviqo_password**: Your Eviqo account password

### Debug Mode

Enable **debug** to see detailed logging for troubleshooting.

## Docker Standalone Usage

You can also run this as a standalone Docker container:

```bash
docker run -d \
  --name eviqo-mqtt \
  -e EVIQO_EMAIL=your@email.com \
  -e EVIQO_PASSWORD=yourpassword \
  -e EVIQO_MQTT_URL=mqtt://192.168.1.100:1883 \
  ghcr.io/tsightler/eviqo-mqtt-amd64
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| EVIQO_EMAIL | Yes | Eviqo account email |
| EVIQO_PASSWORD | Yes | Eviqo account password |
| EVIQO_MQTT_URL | Yes | MQTT broker URL (mqtt://[user:pass@]host[:port]) |
| EVIQO_LOG_LEVEL | No | Log level: debug, info, warn, error (default: info) |

## Troubleshooting

### Entities not appearing
1. Check the addon logs for errors
2. Verify MQTT connection is working
3. Try restarting the addon

### Authentication errors
- Verify your Eviqo credentials are correct
- Ensure you can log into the Eviqo mobile app

### Debug logging
Enable debug mode in the addon configuration to see detailed logs.

## Support

For issues and feature requests, please visit:
https://github.com/tsightler/eviqo/issues
