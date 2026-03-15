-- ═══════════════════════════════════════════════════════════════════════════
-- Loop-26.0: Reference DB Schema
-- ═══════════════════════════════════════════════════════════════════════════

-- project_references
CREATE TABLE IF NOT EXISTS project_references (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_project_references_project_id ON project_references(project_id);

-- ref_milestones
CREATE TABLE IF NOT EXISTS ref_milestones (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id   uuid NOT NULL REFERENCES project_references(id) ON DELETE CASCADE,
  project_id     text NOT NULL,
  created_by     uuid,
  title          text NOT NULL DEFAULT '',
  description    text,
  start_date     date,
  end_date       date,
  color          text DEFAULT '#1D9E75',
  sort_order     integer DEFAULT 0,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ref_milestones_reference_id ON ref_milestones(reference_id);
CREATE INDEX IF NOT EXISTS idx_ref_milestones_project_id ON ref_milestones(project_id);

-- ref_deliverables
CREATE TABLE IF NOT EXISTS ref_deliverables (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id   uuid NOT NULL REFERENCES project_references(id) ON DELETE CASCADE,
  milestone_id   uuid REFERENCES ref_milestones(id) ON DELETE SET NULL,
  project_id     text NOT NULL,
  created_by     uuid,
  title          text NOT NULL DEFAULT '',
  description    text,
  assignee_ids   text[],
  due_label      text,
  tag_label      text,
  tag_bg         text DEFAULT '#E6F1FB',
  tag_text_color text DEFAULT '#185FA5',
  sort_order     integer DEFAULT 0,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ref_deliverables_reference_id ON ref_deliverables(reference_id);
CREATE INDEX IF NOT EXISTS idx_ref_deliverables_milestone_id ON ref_deliverables(milestone_id);
CREATE INDEX IF NOT EXISTS idx_ref_deliverables_project_id ON ref_deliverables(project_id);

-- ref_links
CREATE TABLE IF NOT EXISTS ref_links (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id uuid NOT NULL REFERENCES project_references(id) ON DELETE CASCADE,
  project_id   text NOT NULL,
  created_by   uuid,
  title        text NOT NULL DEFAULT '',
  url          text,
  description  text,
  sort_order   integer DEFAULT 0,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ref_links_reference_id ON ref_links(reference_id);

-- ref_policies
CREATE TABLE IF NOT EXISTS ref_policies (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id uuid NOT NULL REFERENCES project_references(id) ON DELETE CASCADE,
  project_id   text NOT NULL,
  created_by   uuid,
  title        text NOT NULL DEFAULT '',
  description  text,
  tag_label    text,
  tag_type     text DEFAULT 'internal',
  sort_order   integer DEFAULT 0,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ref_policies_reference_id ON ref_policies(reference_id);

-- tasks.deliverable_id 추가
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deliverable_id uuid REFERENCES ref_deliverables(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_deliverable_id ON tasks(deliverable_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS 활성화 (정책 없이 - service_role로 접근)
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE project_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_policies ENABLE ROW LEVEL SECURITY;

-- Service role bypass (임시 - 추후 RLS 정책 추가)
CREATE POLICY "service_role_all_project_references" ON project_references FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_ref_milestones" ON ref_milestones FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_ref_deliverables" ON ref_deliverables FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_ref_links" ON ref_links FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_ref_policies" ON ref_policies FOR ALL USING (true) WITH CHECK (true);
