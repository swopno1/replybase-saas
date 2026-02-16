-- Flow Builder - Default Global Flows Seed Data
-- Run this after the initial migration to create template flows

-- Note: Replace 'YOUR_TENANT_ID_HERE' with an actual tenant ID from your database
-- For global flows, you might want to use a system tenant or the first admin tenant

-- ============================================================================
-- 1. WELCOME & LEAD CAPTURE FLOW
-- ============================================================================

-- Insert Welcome Flow
INSERT INTO flows (
  id,
  name,
  description,
  "tenantId",
  "ownerId",
  "isGlobal",
  "isActive",
  version,
  language,
  "fallbackMessage",
  "maxTimeout",
  "createdAt",
  "updatedAt"
) VALUES (
  gen_random_uuid(),
  'Welcome & Lead Capture',
  'A simple flow to greet new users and collect their contact information',
  'cmliz8ul8000013t5xffrwlok',  -- Replace with system/admin tenant ID
  NULL,  -- No owner = global flow
  true,
  true,
  1,
  'en',
  'Sorry, I didn''t understand that. Please try again.',
  300,
  NOW(),
  NOW()
) RETURNING id;

-- Store the flow ID for use in node creation
-- Note: In practice, you'll need to run this query first, get the ID, then use it below

-- Insert nodes for Welcome Flow (replace 'FLOW_ID_HERE' with the actual ID)
INSERT INTO flow_nodes (id, "flowId", type, content, "order", "createdAt", "updatedAt") VALUES
(gen_random_uuid(), '1ade0648-7491-4732-a7f6-b4193133466d', 'message', '{"text": "👋 Welcome! Thanks for reaching out to us. We''d love to learn more about you!", "buttons": [{"type": "postback", "title": "Let''s Get Started", "payload": "start"}]}', 0, NOW(), NOW()),
(gen_random_uuid(), '1ade0648-7491-4732-a7f6-b4193133466d', 'input', '{"text": "Great! What''s your name?", "variableName": "user_name", "inputType": "text"}', 1, NOW(), NOW()),
(gen_random_uuid(), '1ade0648-7491-4732-a7f6-b4193133466d', 'input', '{"text": "Nice to meet you! What''s your email address?", "variableName": "user_email", "inputType": "email"}', 2, NOW(), NOW()),
(gen_random_uuid(), '1ade0648-7491-4732-a7f6-b4193133466d', 'input', '{"text": "And your phone number? (optional)", "variableName": "user_phone", "inputType": "phone"}', 3, NOW(), NOW()),
(gen_random_uuid(), '1ade0648-7491-4732-a7f6-b4193133466d', 'action', '{"action": "tag_user", "tags": ["lead", "captured"]}', 4, NOW(), NOW()),
(gen_random_uuid(), '1ade0648-7491-4732-a7f6-b4193133466d', 'message', '{"text": "Perfect! Thank you for sharing your information. Our team will reach out to you soon! 🎉"}', 5, NOW(), NOW()),
(gen_random_uuid(), '1ade0648-7491-4732-a7f6-b4193133466d', 'end', '{}', 6, NOW(), NOW());

-- ============================================================================
-- 2. PRODUCT INTEREST QUALIFIER
-- ============================================================================

INSERT INTO flows (
  id,
  name,
  description,
  "tenantId",
  "ownerId",
  "isGlobal",
  "isActive",
  version,
  language,
  "fallbackMessage",
  "maxTimeout",
  "createdAt",
  "updatedAt"
) VALUES (
  gen_random_uuid(),
  'Product Interest Qualifier',
  'Qualify leads by understanding their product interests and needs',
  'cmliz8ul8000013t5xffrwlok',
  NULL,
  true,
  true,
  1,
  'en',
  'Sorry, I didn''t understand that. Please respond with one of the options.',
  300,
  NOW(),
  NOW()
);

-- Insert nodes (replace FLOW_ID_HERE)
INSERT INTO flow_nodes (id, "flowId", type, content, "order", "createdAt", "updatedAt") VALUES
(gen_random_uuid(), '40435cc3-c71f-404f-8271-6835ea79d3ca', 'message', '{"text": "Hello! 👋 Let us help you find the perfect solution.", "buttons": [{"type": "postback", "title": "I''m Interested", "payload": "interested"}]}', 0, NOW(), NOW()),
(gen_random_uuid(), '40435cc3-c71f-404f-8271-6835ea79d3ca', 'input', '{"text": "What type of business do you have?", "variableName": "business_type", "inputType": "text"}', 1, NOW(), NOW()),
(gen_random_uuid(), '40435cc3-c71f-404f-8271-6835ea79d3ca', 'input', '{"text": "How many team members do you have?", "variableName": "team_size", "inputType": "number"}', 2, NOW(), NOW()),
(gen_random_uuid(), '40435cc3-c71f-404f-8271-6835ea79d3ca', 'action', '{"action": "tag_user", "tags": ["qualified", "interested"]}', 3, NOW(), NOW()),
(gen_random_uuid(), '40435cc3-c71f-404f-8271-6835ea79d3ca', 'message', '{"text": "Thanks! Based on your needs, our team will prepare a custom solution for you. Expect to hear from us within 24 hours! ✅"}', 4, NOW(), NOW()),
(gen_random_uuid(), '40435cc3-c71f-404f-8271-6835ea79d3ca', 'end', '{}', 5, NOW(), NOW());

-- ============================================================================
-- 3. APPOINTMENT BOOKING FLOW
-- ============================================================================

INSERT INTO flows (
  id,
  name,
  description,
  "tenantId",
  "ownerId",
  "isGlobal",
  "isActive",
  version,
  language,
  "fallbackMessage",
  "maxTimeout",
  "createdAt",
  "updatedAt"
) VALUES (
  gen_random_uuid(),
  'Appointment Booking',
  'Help users schedule a consultation or demo with your team',
  'cmliz8ul8000013t5xffrwlok',
  NULL,
  true,
  true,
  1,
  'en',
  'Sorry, I didn''t understand. Please try again.',
  300,
  NOW(),
  NOW()
);

-- Insert nodes (replace FLOW_ID_HERE)
INSERT INTO flow_nodes (id, "flowId", type, content, "order", "createdAt", "updatedAt") VALUES
(gen_random_uuid(), 'f62dbc60-f55e-4b94-9353-8a5c697a868f', 'message', '{"text": "📅 Would you like to schedule a consultation with our team?", "buttons": [{"type": "postback", "title": "Yes, Let''s Book", "payload": "book"}]}', 0, NOW(), NOW()),
(gen_random_uuid(), 'f62dbc60-f55e-4b94-9353-8a5c697a868f', 'input', '{"text": "Great! What''s your preferred date? (e.g., Tomorrow, Next Monday, Feb 20)", "variableName": "preferred_date", "inputType": "text"}', 1, NOW(), NOW()),
(gen_random_uuid(), 'f62dbc60-f55e-4b94-9353-8a5c697a868f', 'input', '{"text": "And what time works best for you? (e.g., 10am, 2pm, 4pm)", "variableName": "preferred_time", "inputType": "text"}', 2, NOW(), NOW()),
(gen_random_uuid(), 'f62dbc60-f55e-4b94-9353-8a5c697a868f', 'input', '{"text": "Perfect! What''s your email so we can send you a calendar invite?", "variableName": "user_email", "inputType": "email"}', 3, NOW(), NOW()),
(gen_random_uuid(), 'f62dbc60-f55e-4b94-9353-8a5c697a868f', 'action', '{"action": "tag_user", "tags": ["appointment", "scheduled"]}', 4, NOW(), NOW()),
(gen_random_uuid(), 'f62dbc60-f55e-4b94-9353-8a5c697a868f', 'message', '{"text": "✅ All set! We''ve received your appointment request. You''ll receive a calendar invite at your email shortly. Looking forward to speaking with you!"}', 5, NOW(), NOW()),
(gen_random_uuid(), 'f62dbc60-f55e-4b94-9353-8a5c697a868f', 'end', '{}', 6, NOW(), NOW());

-- ============================================================================
-- 4. FEEDBACK COLLECTION FLOW
-- ============================================================================

INSERT INTO flows (
  id,
  name,
  description,
  "tenantId",
  "ownerId",
  "isGlobal",
  "isActive",
  version,
  language,
  "fallbackMessage",
  "maxTimeout",
  "createdAt",
  "updatedAt"
) VALUES (
  gen_random_uuid(),
  'Customer Feedback',
  'Collect feedback and satisfaction ratings from customers',
  'cmliz8ul8000013t5xffrwlok',
  NULL,
  true,
  true,
  1,
  'en',
  'Please provide your feedback.',
  300,
  NOW(),
  NOW()
);

-- Insert nodes (replace FLOW_ID_HERE)
INSERT INTO flow_nodes (id, "flowId", type, content, "order", "createdAt", "updatedAt") VALUES
(gen_random_uuid(), 'b67edf16-50a4-4d92-a76c-ab9106bdee7f', 'message', '{"text": "💬 We value your feedback! How was your experience with us?", "buttons": [{"type": "postback", "title": "Share Feedback", "payload": "feedback"}]}', 0, NOW(), NOW()),
(gen_random_uuid(), 'b67edf16-50a4-4d92-a76c-ab9106bdee7f', 'input', '{"text": "On a scale of 1-10, how likely are you to recommend us to a friend?", "variableName": "nps_score", "inputType": "number"}', 1, NOW(), NOW()),
(gen_random_uuid(), 'b67edf16-50a4-4d92-a76c-ab9106bdee7f', 'input', '{"text": "What did you like most about our service?", "variableName": "positive_feedback", "inputType": "text"}', 2, NOW(), NOW()),
(gen_random_uuid(), 'b67edf16-50a4-4d92-a76c-ab9106bdee7f', 'input', '{"text": "What could we improve?", "variableName": "improvement_feedback", "inputType": "text"}', 3, NOW(), NOW()),
(gen_random_uuid(), 'b67edf16-50a4-4d92-a76c-ab9106bdee7f', 'action', '{"action": "tag_user", "tags": ["feedback_provided"]}', 4, NOW(), NOW()),
(gen_random_uuid(), 'b67edf16-50a4-4d92-a76c-ab9106bdee7f', 'message', '{"text": "🙏 Thank you so much for your valuable feedback! We truly appreciate it and will use it to improve our service."}', 5, NOW(), NOW()),
(gen_random_uuid(), 'b67edf16-50a4-4d92-a76c-ab9106bdee7f', 'end', '{}', 6, NOW(), NOW());

-- ============================================================================
-- 5. FAQ / SELF-SERVICE FLOW
-- ============================================================================

INSERT INTO flows (
  id,
  name,
  description,
  "tenantId",
  "ownerId",
  "isGlobal",
  "isActive",
  version,
  language,
  "fallbackMessage",
  "maxTimeout",
  "createdAt",
  "updatedAt"
) VALUES (
  gen_random_uuid(),
  'FAQ / Self-Service',
  'Help users find answers to common questions',
  'cmliz8ul8000013t5xffrwlok',
  NULL,
  true,
  true,
  1,
  'en',
  'Sorry, I didn''t understand. Please select from the options.',
  300,
  NOW(),
  NOW()
);

-- Insert nodes (replace FLOW_ID_HERE)
INSERT INTO flow_nodes (id, "flowId", type, content, "order", "createdAt", "updatedAt") VALUES
(gen_random_uuid(), 'd7919435-f5b1-4956-b9c5-f5b5e0de2e10', 'message', '{"text": "❓ How can I help you today?", "buttons": [{"type": "postback", "title": "Pricing", "payload": "pricing"}, {"type": "postback", "title": "Features", "payload": "features"}, {"type": "postback", "title": "Support", "payload": "support"}]}', 0, NOW(), NOW()),
(gen_random_uuid(), 'd7919435-f5b1-4956-b9c5-f5b5e0de2e10', 'input', '{"text": "Please type your question or select from the options above.", "variableName": "user_question", "inputType": "text"}', 1, NOW(), NOW()),
(gen_random_uuid(), 'd7919435-f5b1-4956-b9c5-f5b5e0de2e10', 'message', '{"text": "Thanks for your question! Here are some helpful resources: [Link 1], [Link 2]. Would you like to speak with a team member?", "buttons": [{"type": "postback", "title": "Yes, Contact Team", "payload": "contact"}]}', 2, NOW(), NOW()),
(gen_random_uuid(), 'd7919435-f5b1-4956-b9c5-f5b5e0de2e10', 'action', '{"action": "tag_user", "tags": ["faq_user"]}', 3, NOW(), NOW()),
(gen_random_uuid(), 'd7919435-f5b1-4956-b9c5-f5b5e0de2e10', 'end', '{}', 4, NOW(), NOW());

-- ============================================================================
-- UPDATE PLAN LIMITS
-- ============================================================================

-- Update plan limits to support Flow Builder
UPDATE plans SET "maxFlows" = 3 WHERE name = 'free';
UPDATE plans SET "maxFlows" = 3 WHERE name = 'starter';
UPDATE plans SET "maxFlows" = 10 WHERE name = 'standard';
UPDATE plans SET "maxFlows" = 999999 WHERE name = 'premium';

-- Note: Adjust plan names based on your actual plan structure
