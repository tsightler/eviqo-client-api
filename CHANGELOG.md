# Changelog

## [1.0.5] - 2025-01-03

### Changed
- Session entities now only publish during active charging sessions
- Added logo to README and icons for Home Assistant addon

### Added
- Automated version release script

## [1.0.4] - 2025-01-02

### Changed
- Reduced log verbosity by downgrading frequent logs to debug level
- Set Amperage sensor display precision to 1 decimal place

## [1.0.3] - 2025-01-01

### Added
- Optimistic state updates for charging switch (immediate UI feedback)

### Fixed
- Fixed charging command sequences and added proper delays

## [1.0.2] - 2024-12-30

### Fixed
- Fixed container shutdown handling
- Added s6-overlay finish script for proper shutdown handling

## [1.0.1] - 2024-12-29

### Changed
- Upgraded to Node.js 22 (jod-alpine)

### Fixed
- Fixed Docker build using multi-stage build for TypeScript compilation
- Fixed ARM builds by running builder stage natively with --platform=$BUILDPLATFORM
- Fixed manifest creation using buildx imagetools instead of docker manifest

## [1.0.0] - 2024-12-28

### Added
- Initial release
- Eviqo EV charger to MQTT bridge
- Home Assistant auto-discovery support
- Sensors: Status, Voltage, Power, Amperage, Session Duration, Session Power, Session Cost
- Controls: Charging switch, Current Limit slider
- Docker container support
- Home Assistant Add-on support
- MQTT auto-discovery from Home Assistant Mosquitto broker
