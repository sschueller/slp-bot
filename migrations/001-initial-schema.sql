-- Up
CREATE TABLE IF NOT EXISTS balances (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    user_id INTEGER UNIQUE, 
    balance NUMERIC DEFAULT 0, 
    deposit_addr TEXT
);

CREATE TABLE IF NOT EXISTS trans_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    tx_id TEXT
);

-- Down
DROP TABLE balances
DROP TABLE trans_log;