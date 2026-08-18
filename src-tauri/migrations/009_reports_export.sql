CREATE TABLE reports_v2 (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    campaign_id TEXT REFERENCES campaigns(id) ON DELETE SET NULL,
    report_type TEXT NOT NULL CHECK (report_type IN ('weekly','monthly','campaign','platform','client')),
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    metrics_snapshot TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metrics_snapshot)),
    analysis_prompt TEXT,
    imported_analysis TEXT,
    recommendations TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(recommendations)),
    export_path TEXT,
    status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('ready','archived')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
INSERT INTO reports_v2(id,client_id,campaign_id,report_type,period_start,period_end,metrics_snapshot,analysis_prompt,imported_analysis,recommendations,created_at,updated_at)
 SELECT id,client_id,campaign_id,report_type,period_start,period_end,metrics_snapshot,analysis_prompt,imported_analysis,recommendations,created_at,updated_at FROM reports;
DROP TABLE reports;
ALTER TABLE reports_v2 RENAME TO reports;
CREATE INDEX idx_reports_client_period ON reports(client_id,period_start DESC,period_end DESC);

INSERT INTO schema_migrations (version, name) VALUES (9, 'reports_export');
