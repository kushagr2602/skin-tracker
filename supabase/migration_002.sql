-- Run this in your Supabase SQL editor after the initial schema.sql

-- Add frequency + photo to product and medication libraries
alter table skincare_products
  add column if not exists frequency text,
  add column if not exists photo_url text;

alter table medications
  add column if not exists frequency text,
  add column if not exists dosage text,
  add column if not exists photo_url text;

-- Add meal type to diet entries
alter table diet_entries
  add column if not exists meal_type text default 'meal';

-- Add workout fields to lifestyle factors
alter table lifestyle_factors
  add column if not exists workout_type text,
  add column if not exists workout_intensity text;
