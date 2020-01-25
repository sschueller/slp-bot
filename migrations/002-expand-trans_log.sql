-- Up
ALTER TABLE trans_log ADD COLUMN timestamp TEXT;
ALTER TABLE trans_log ADD COLUMN type TEXT;
ALTER TABLE trans_log ADD COLUMN amount TEXT;
ALTER TABLE trans_log ADD COLUMN to_user TEXT;
ALTER TABLE trans_log ADD COLUMN from_user TEXT;

-- Down
ALTER TABLE trans_log RENAME TO trans_log_tmp;
CREATE TABLE IF NOT EXISTS trans_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    tx_id TEXT
);
INSERT INTO trans_log (id, tx_id) SELECT id, tx_id FROM trans_log_tmp;
DROP TABLE trans_log_tmp;

