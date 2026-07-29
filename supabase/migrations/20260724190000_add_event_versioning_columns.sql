-- Migration: Add version columns to event_store
-- Phase 4.8.2: Event Versioning Infrastructure
-- Date: 2026-07-24

-- Add event_type_version column (per-event-type schema version)
ALTER TABLE event_store ADD COLUMN IF NOT EXISTS event_type_version INTEGER NOT NULL DEFAULT 1;

-- Add schema_version column (envelope structure version)
ALTER TABLE event_store ADD COLUMN IF NOT EXISTS schema_version INTEGER NOT NULL DEFAULT 1;

-- Index for version queries (filter by event type + version)
CREATE INDEX IF NOT EXISTS idx_event_store_version ON event_store(event_type, event_type_version);

-- Index for schema version queries
CREATE INDEX IF NOT EXISTS idx_event_store_schema ON event_store(schema_version);
