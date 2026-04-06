-- RankYatra Seed Data for EC2 Production Database
-- Run with: psql postgresql://rankyatra:StrongPass123@localhost:5432/rankyatradb -f seed.sql

-- Users (demo accounts with bcrypt hashed passwords)
INSERT INTO users (id, name, email, password_hash, wallet_balance, is_admin, phone, verification_status, created_at, updated_at)
VALUES
  (1, 'Admin User',       'admin@rankyatra.com',  '$2b$10$GbNOpPcEGQeqXhSk4UcQ8.3PGXrzgIuRM1JIOMnJtfPcqqa4ra/G6', 9995.00, true,  NULL,         'not_submitted', NOW(), NOW()),
  (2, 'Priya Sharma',     'priya@rankyatra.com',  '$2b$10$ZJiy7TLmRhiA1.NvT7G8X.kgC5BDoYZ6ndBZ.khorsAt/haCfwhXW', 980.00,  false, '9957608761', 'verified',      NOW(), NOW()),
  (3, 'Rohit Verma',      'rohit@rankyatra.com',  '$2b$10$A21OKRlKTJWMoHZU0oxWX.FSxC.DViptg5GLkE0dx3xG12LVGo21e', 0.00,    false, NULL,         'not_submitted', NOW(), NOW()),
  (4, 'Anjali Singh',     'anjali@rankyatra.com', '$2b$10$ojOo4GD5p8ifBuFM9QyfNusmtn/p2u6l9jGr8Pl/RIaPrAYXCDPwS', 0.00,    false, NULL,         'not_submitted', NOW(), NOW()),
  (5, 'Vikram Patel',     'vikram@rankyatra.com', '$2b$10$tPHuBbYdje2Qeud4mV1areVOJ0FITFsZbNso6TabQ9YqvY4S0u/pm', 0.00,    false, NULL,         'not_submitted', NOW(), NOW()),
  (6, 'Sneha Rao',        'sneha@rankyatra.com',  '$2b$10$qmraVv2bwgX.GL.xxkQTJOhVq0RqkPaE.PFMVsRyoIGPZp/jutntm', 400.00,  false, NULL,         'not_submitted', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Reset sequence to avoid ID conflicts
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));

-- Categories
INSERT INTO categories (id, name, display_order, is_active, created_at)
VALUES
  (1, 'SSC',     0, true, NOW()),
  (2, 'UPSC',    1, true, NOW()),
  (3, 'Banking', 2, true, NOW()),
  (4, 'Railways',3, true, NOW()),
  (5, 'Defence', 4, true, NOW()),
  (6, 'NEET',    5, true, NOW()),
  (7, 'IIT JEE', 6, true, NOW())
ON CONFLICT (id) DO NOTHING;

SELECT setval('categories_id_seq', (SELECT MAX(id) FROM categories));

-- Banners
INSERT INTO banners (id, title, subtitle, emoji, bg_from, bg_to, link_url, link_label, display_order, is_active, created_at, updated_at)
VALUES
  (1, 'Win ₹50,000+ Cash Prizes',        'Pay ₹5 · Compete with top aspirants across India',         '⚡',  '#f97316', '#ea580c', '/', 'Join Now',       0, true, NOW(), NOW()),
  (2, 'SSC CGL & CHSL Mock Tests',       'Live ranked exams · Real exam pattern · Instant results',   '🏛️', '#3b82f6', '#1d4ed8', '/', 'Start SSC Prep', 1, true, NOW(), NOW()),
  (3, 'UPSC Prelims Practice Arena',     'GS Paper I & II · Compete with 10,000+ aspirants',          '🇮🇳','#8b5cf6', '#6d28d9', '/', 'Take UPSC Test', 2, true, NOW(), NOW()),
  (4, 'Banking PO & Clerk Exams',        'SBI · IBPS · RBI · Reasoning + Quant live battles',         '🏦', '#10b981', '#047857', '/', 'Attempt Banking',3, true, NOW(), NOW()),
  (5, 'Railways NTPC · ALP · Group D',   'CBT pattern mock exams · Win cash prizes daily',             '🚆', '#ef4444', '#b91c1c', '/', 'Railways Exam',  4, true, NOW(), NOW()),
  (6, 'Defence NDA · CDS · AFCAT',       'Serve the nation · Score high · Win scholarship prizes',    '🎖️', '#6366f1', '#4338ca', '/', 'Defence Prep',   5, true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

SELECT setval('banners_id_seq', (SELECT MAX(id) FROM banners));

-- Exams (dates set 7 days from now so they show as upcoming)
INSERT INTO exams (id, title, category, entry_fee, prize_pool, start_time, end_time, status, created_at, updated_at)
VALUES
  (1,  'SSC CGL Tier-I Mock Test',          'SSC',     5.00, 50000.00,  NOW() + INTERVAL '1 day',  NOW() + INTERVAL '1 day 20 minutes',  'upcoming', NOW(), NOW()),
  (2,  'UPSC Prelims Mock Test',             'UPSC',    5.00, 30000.00,  NOW() + INTERVAL '2 days', NOW() + INTERVAL '2 days 2 hours',    'upcoming', NOW(), NOW()),
  (3,  'Banking Awareness Test',             'Banking', 5.00, 25000.00,  NOW() + INTERVAL '1 day',  NOW() + INTERVAL '1 day 45 minutes',  'upcoming', NOW(), NOW()),
  (4,  'UPSC Civil Services Prelims 2026',   'UPSC',    5.00, 100000.00, NOW() + INTERVAL '3 days', NOW() + INTERVAL '3 days 25 minutes', 'upcoming', NOW(), NOW()),
  (5,  'IBPS PO Reasoning & Aptitude',       'Banking', 5.00, 30000.00,  NOW() + INTERVAL '2 days', NOW() + INTERVAL '2 days 20 minutes', 'upcoming', NOW(), NOW()),
  (6,  'RRB NTPC General Awareness',         'Railways',5.00, 25000.00,  NOW() + INTERVAL '4 days', NOW() + INTERVAL '4 days 20 minutes', 'upcoming', NOW(), NOW()),
  (7,  'SSC CHSL General Studies',           'SSC',     5.00, 20000.00,  NOW() + INTERVAL '1 day',  NOW() + INTERVAL '1 day 30 minutes',  'upcoming', NOW(), NOW()),
  (8,  'SBI Clerk Prelims Mock',             'Banking', 5.00, 35000.00,  NOW() + INTERVAL '5 days', NOW() + INTERVAL '5 days 40 minutes', 'upcoming', NOW(), NOW()),
  (9,  'Indian Army GD Agniveer',            'Defence', 5.00, 15000.00,  NOW() + INTERVAL '2 days', NOW() + INTERVAL '2 days 20 minutes', 'upcoming', NOW(), NOW()),
  (10, 'NDA & NA Mathematics Mock',          'Defence', 5.00, 18000.00,  NOW() + INTERVAL '3 days', NOW() + INTERVAL '3 days 30 minutes', 'upcoming', NOW(), NOW()),
  (11, 'NEET Biology Practice Test',         'NEET',    5.00, 40000.00,  NOW() + INTERVAL '6 days', NOW() + INTERVAL '6 days 45 minutes', 'upcoming', NOW(), NOW()),
  (12, 'IIT JEE Physics Mock Battle',        'IIT JEE', 5.00, 60000.00,  NOW() + INTERVAL '7 days', NOW() + INTERVAL '7 days 35 minutes', 'upcoming', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

SELECT setval('exams_id_seq', (SELECT MAX(id) FROM exams));
