-- Migration 007: Add 'needs_attention' to court_status enum
-- Matches application types and transitions.ts state machine definition

ALTER TYPE court_status ADD VALUE IF NOT EXISTS 'needs_attention';
