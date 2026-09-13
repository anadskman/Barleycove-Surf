CREATE TABLE surf_reports (
    id SERIAL PRIMARY KEY,
    wave_height REAL NOT NULL,
    wave_shape TEXT NOT NULL,
    crowd TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX surf_reports_created_at_idx
ON surf_reports (created_at DESC);