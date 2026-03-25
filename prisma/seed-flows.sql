-- Flow Builder - Idempotent Global Flow Seed
-- Safe to run multiple times. No hardcoded tenant IDs or flow IDs.

DO $$
DECLARE
  target_tenant_id text;
  flow_id text;
BEGIN
  SELECT id INTO target_tenant_id
  FROM tenants
  ORDER BY "createdAt" ASC
  LIMIT 1;

  IF target_tenant_id IS NULL THEN
    RAISE NOTICE 'No tenant found. Skipping flow seeding.';
    RETURN;
  END IF;

  -- 1) Welcome & Lead Capture
  SELECT id INTO flow_id
  FROM flows
  WHERE "tenantId" = target_tenant_id
    AND name = 'Welcome & Lead Capture'
  LIMIT 1;

  IF flow_id IS NULL THEN
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
      'c' || substr(md5(random()::text || clock_timestamp()::text), 1, 23),
      'Welcome & Lead Capture',
      'A simple flow to greet new users and collect their contact information',
      target_tenant_id,
      NULL,
      true,
      true,
      1,
      'en',
      'Sorry, I didn''t understand that. Please try again.',
      300,
      NOW(),
      NOW()
    )
    RETURNING id INTO flow_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM flow_nodes WHERE "flowId" = flow_id) THEN
    INSERT INTO flow_nodes (id, "flowId", type, content, "order", "createdAt", "updatedAt") VALUES
    ('c' || substr(md5(random()::text || clock_timestamp()::text), 1, 23), flow_id, 'message', '{"text": "Welcome! Thanks for reaching out to us. We would love to learn more about you."}', 0, NOW(), NOW()),
    ('c' || substr(md5(random()::text || clock_timestamp()::text), 1, 23), flow_id, 'input', '{"text": "Great! What is your name?", "variableName": "user_name", "inputType": "text"}', 1, NOW(), NOW()),
    ('c' || substr(md5(random()::text || clock_timestamp()::text), 1, 23), flow_id, 'input', '{"text": "Nice to meet you! What is your email address?", "variableName": "user_email", "inputType": "email"}', 2, NOW(), NOW()),
    ('c' || substr(md5(random()::text || clock_timestamp()::text), 1, 23), flow_id, 'input', '{"text": "And your phone number? (optional)", "variableName": "user_phone", "inputType": "phone"}', 3, NOW(), NOW()),
    ('c' || substr(md5(random()::text || clock_timestamp()::text), 1, 23), flow_id, 'action', '{"action": "tag_user", "tags": ["lead", "captured"]}', 4, NOW(), NOW()),
    ('c' || substr(md5(random()::text || clock_timestamp()::text), 1, 23), flow_id, 'message', '{"text": "Perfect! Thank you for sharing your information. Our team will reach out to you soon."}', 5, NOW(), NOW()),
    ('c' || substr(md5(random()::text || clock_timestamp()::text), 1, 23), flow_id, 'end', '{}', 6, NOW(), NOW());
  END IF;

  -- 2) Product Interest Qualifier
  SELECT id INTO flow_id
  FROM flows
  WHERE "tenantId" = target_tenant_id
    AND name = 'Product Interest Qualifier'
  LIMIT 1;

  IF flow_id IS NULL THEN
    INSERT INTO flows (
      id, name, description, "tenantId", "ownerId", "isGlobal", "isActive",
      version, language, "fallbackMessage", "maxTimeout", "createdAt", "updatedAt"
    ) VALUES (
      'c' || substr(md5(random()::text || clock_timestamp()::text), 1, 23),
      'Product Interest Qualifier',
      'Qualify leads by understanding their product interests and needs',
      target_tenant_id,
      NULL,
      true,
      true,
      1,
      'en',
      'Sorry, I did not understand that. Please respond with one of the options.',
      300,
      NOW(),
      NOW()
    )
    RETURNING id INTO flow_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM flow_nodes WHERE "flowId" = flow_id) THEN
    INSERT INTO flow_nodes (id, "flowId", type, content, "order", "createdAt", "updatedAt") VALUES
    ('c' || substr(md5(random()::text || clock_timestamp()::text), 1, 23), flow_id, 'message', '{"text": "Hello! Let us help you find the perfect solution."}', 0, NOW(), NOW()),
    ('c' || substr(md5(random()::text || clock_timestamp()::text), 1, 23), flow_id, 'input', '{"text": "What type of business do you have?", "variableName": "business_type", "inputType": "text"}', 1, NOW(), NOW()),
    ('c' || substr(md5(random()::text || clock_timestamp()::text), 1, 23), flow_id, 'input', '{"text": "How many team members do you have?", "variableName": "team_size", "inputType": "number"}', 2, NOW(), NOW()),
    ('c' || substr(md5(random()::text || clock_timestamp()::text), 1, 23), flow_id, 'action', '{"action": "tag_user", "tags": ["qualified", "interested"]}', 3, NOW(), NOW()),
    ('c' || substr(md5(random()::text || clock_timestamp()::text), 1, 23), flow_id, 'message', '{"text": "Thanks! Based on your needs, our team will prepare a custom solution for you."}', 4, NOW(), NOW()),
    ('c' || substr(md5(random()::text || clock_timestamp()::text), 1, 23), flow_id, 'end', '{}', 5, NOW(), NOW());
  END IF;

  -- 3) Appointment Booking
  SELECT id INTO flow_id
  FROM flows
  WHERE "tenantId" = target_tenant_id
    AND name = 'Appointment Booking'
  LIMIT 1;

  IF flow_id IS NULL THEN
    INSERT INTO flows (
      id, name, description, "tenantId", "ownerId", "isGlobal", "isActive",
      version, language, "fallbackMessage", "maxTimeout", "createdAt", "updatedAt"
    ) VALUES (
      'c' || substr(md5(random()::text || clock_timestamp()::text), 1, 23),
      'Appointment Booking',
      'Help users schedule a consultation or demo with your team',
      target_tenant_id,
      NULL,
      true,
      true,
      1,
      'en',
      'Sorry, I did not understand. Please try again.',
      300,
      NOW(),
      NOW()
    )
    RETURNING id INTO flow_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM flow_nodes WHERE "flowId" = flow_id) THEN
    INSERT INTO flow_nodes (id, "flowId", type, content, "order", "createdAt", "updatedAt") VALUES
    ('c' || substr(md5(random()::text || clock_timestamp()::text), 1, 23), flow_id, 'message', '{"text": "Would you like to schedule a consultation with our team?"}', 0, NOW(), NOW()),
    ('c' || substr(md5(random()::text || clock_timestamp()::text), 1, 23), flow_id, 'input', '{"text": "What is your preferred date?", "variableName": "preferred_date", "inputType": "text"}', 1, NOW(), NOW()),
    ('c' || substr(md5(random()::text || clock_timestamp()::text), 1, 23), flow_id, 'input', '{"text": "What time works best for you?", "variableName": "preferred_time", "inputType": "text"}', 2, NOW(), NOW()),
    ('c' || substr(md5(random()::text || clock_timestamp()::text), 1, 23), flow_id, 'input', '{"text": "What is your email so we can send a calendar invite?", "variableName": "user_email", "inputType": "email"}', 3, NOW(), NOW()),
    ('c' || substr(md5(random()::text || clock_timestamp()::text), 1, 23), flow_id, 'action', '{"action": "tag_user", "tags": ["appointment", "scheduled"]}', 4, NOW(), NOW()),
    ('c' || substr(md5(random()::text || clock_timestamp()::text), 1, 23), flow_id, 'message', '{"text": "All set! We received your appointment request."}', 5, NOW(), NOW()),
    ('c' || substr(md5(random()::text || clock_timestamp()::text), 1, 23), flow_id, 'end', '{}', 6, NOW(), NOW());
  END IF;
END $$;

-- Update plan limits to match current plan names.
UPDATE plans SET "maxFlows" = 3 WHERE name = 'free';
UPDATE plans SET "maxFlows" = GREATEST("maxFlows", 10) WHERE name = 'starter';
UPDATE plans SET "maxFlows" = GREATEST("maxFlows", 50) WHERE name = 'pro';
UPDATE plans SET "maxFlows" = GREATEST("maxFlows", 999) WHERE name = 'business';
