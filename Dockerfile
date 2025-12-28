# Build stage - always run natively (JS is platform-independent)
FROM --platform=$BUILDPLATFORM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/eviqo-client-api/package*.json ./packages/eviqo-client-api/
COPY packages/eviqo-mqtt/package*.json ./packages/eviqo-mqtt/

# Install ALL dependencies (including dev for TypeScript)
RUN npm ci

# Copy source code
COPY packages/ ./packages/
COPY tsconfig*.json ./

# Build TypeScript
RUN npm run build

# Prune dev dependencies
RUN npm prune --omit=dev

# Runtime stage
FROM node:20-alpine

# Build arguments
ARG BUILD_ARCH=amd64
ARG S6_OVERLAY_VERSION=3.2.0.0
ARG BASHIO_VERSION=0.16.2

# Environment
ENV LANG=C.UTF-8
ENV S6_BEHAVIOUR_IF_STAGE2_FAILS=2
ENV S6_CMD_WAIT_FOR_SERVICES_MAXTIME=0

# Install base packages
RUN apk add --no-cache \
    bash \
    curl \
    jq \
    mosquitto-clients \
    tzdata \
    && rm -rf /var/cache/apk/*

# Install s6-overlay
RUN case "${BUILD_ARCH}" in \
        amd64)   S6_ARCH="x86_64" ;; \
        aarch64) S6_ARCH="aarch64" ;; \
        armv7)   S6_ARCH="arm" ;; \
        armhf)   S6_ARCH="armhf" ;; \
        i386)    S6_ARCH="i686" ;; \
        *)       echo "Unsupported architecture: ${BUILD_ARCH}"; exit 1 ;; \
    esac \
    && curl -L -s "https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-noarch.tar.xz" | tar Jxpf - -C / \
    && curl -L -s "https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-${S6_ARCH}.tar.xz" | tar Jxpf - -C /

# Install bashio
RUN curl -L -s "https://github.com/hassio-addons/bashio/archive/v${BASHIO_VERSION}.tar.gz" | tar -xzf - \
    && mv "bashio-${BASHIO_VERSION}/lib" /usr/lib/bashio \
    && ln -s /usr/lib/bashio/bashio /usr/bin/bashio \
    && rm -rf "bashio-${BASHIO_VERSION}"

# Set working directory
WORKDIR /app/eviqo-mqtt

# Copy built application from builder (only production deps + compiled JS)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/package*.json ./

# Copy init scripts
COPY init/services.d/ /etc/services.d/
RUN chmod +x /etc/services.d/*/run

# Labels
LABEL \
    io.hass.name="Eviqo MQTT" \
    io.hass.description="Eviqo EV Charger to MQTT Bridge with Home Assistant Discovery" \
    io.hass.type="addon" \
    io.hass.version="1.0.0" \
    org.opencontainers.image.title="Eviqo MQTT" \
    org.opencontainers.image.description="Bridges Eviqo EV charger data to MQTT with Home Assistant auto-discovery" \
    org.opencontainers.image.source="https://github.com/tsightler/eviqo" \
    org.opencontainers.image.licenses="MIT"

# s6-overlay entrypoint
ENTRYPOINT ["/init"]
