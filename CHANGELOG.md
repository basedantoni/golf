# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Database schemas for golf statistics tracking
  - `clubs` table for golf courses/clubs
  - `rounds` table for individual golf rounds with user and club references
  - `round_holes` table for hole-by-hole stroke data
  - `round_stats` table for comprehensive round statistics (scoring, fairway, GIR, putting, stroke gain)
  - `round_recommended_stats` table for recommended statistics per round
  - `user_followed_clubs`, `user_played_clubs`, and `user_posted_in_clubs` junction tables for club relationships
  - Appropriate indexes on frequently queried columns (userId, clubId, timestamp)
  - Foreign key relationships between tables
