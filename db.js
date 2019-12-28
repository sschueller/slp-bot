'use strict';

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(__dirname + '/sqlite3.db');

db.run("CREATE TABLE IF NOT EXISTS balances (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER UNIQUE, balance NUMERIC DEFAULT 0, deposit_addr TEXT);");

var database = {

    getFundingAddresses: function (offset, limit) {
        return new Promise(function (resolve, reject) {
            db.all("SELECT id, deposit_addr FROM balances WHERE deposit_addr IS NOT NULL ORDER BY id DESC LIMIT $offset, $limit", {
                $offset: offset || 0,
                $limit: limit || 100
            }, function (error, rows) {
                if (error) {
                    reject(error);
                } else {
                    resolve(rows);
                }
            });
        });
    },

    getDbIndexFromUserId: function (userId) {
        return new Promise(function (resolve, reject) {
            db.get("SELECT id FROM balances WHERE user_id = $userId", {
                $userId: userId
            }, function (error, row) {
                if (error) {
                    reject(error);
                } else {
                    resolve(row.id);
                }
            });
        });
    },

    getTotalBalance: function () {
        return new Promise(function (resolve, reject) {
            db.get("SELECT SUM(balance) FROM balances", {}, function (error, row) {
                if (error) {
                    reject(error);
                } else {
                    resolve(row ? row : 0);
                }
            });
        });
    },

    getUserIdByDepositAddress: function (depositAddress) {
        return new Promise(function (resolve, reject) {
            db.get("SELECT user_id FROM balances WHERE deposit_addr = $depositAddress", {
                $depositAddress: depositAddress
            }, function (error, row) {
                if (error) {
                    reject(error);
                } else {
                    resolve(row ? row.user_id : false);
                }
            });
        });
    },

    userIdExists: function (userId) {
        return new Promise(function (resolve, reject) {
            db.get("SELECT id FROM balances WHERE user_id = $userId", {
                $userId: userId
            }, function (error, row) {
                if (error) {
                    reject(error);
                } else {
                    resolve(row ? true : false);
                }
            });
        });
    },

    userIdHasBalance: function (userId, balance) {
        return new Promise(function (resolve, reject) {
            database.getBalanceFromUserId(userId).then(function (currentBalance) {
                resolve(currentBalance >= balance);
            }).catch(function () {
                reject();
            });
        });
    },

    getBalanceFromUserId: function (userId) {
        return new Promise(function (resolve, reject) {
            db.get("SELECT balance FROM balances WHERE user_id = $userId", {
                $userId: userId
            }, function (error, row) {
                if (error) {
                    reject(error);
                } else {
                    let balance = row ? row.balance : 0;
                    resolve(balance);
                }
            });
        });
    },

    setBalanceForUserId: function (userId, newBalance) {
        return new Promise(function (resolve, reject) {
            database.userIdExists(userId).then(function (result) {
                if (!result) {
                    return database.insertBalanceForUserId(userId, newBalance)
                        .then(function () {
                            resolve();
                        }).catch(function (error) {
                            reject(error);
                        });
                } else {
                    //console.log('user exist ', newBalance, userId);
                    db.run("UPDATE balances SET balance = $balance WHERE user_id = $userId", {
                        $balance: newBalance,
                        $userId: userId
                    }, function (error) {
                        if (error) {
                            reject(error);
                        } else {
                            resolve();
                        }
                    });
                }
            }).catch(function (error) {
                reject(error);
            });
        });
    },

    insertBalanceForUserId: function (userId, balance) {
        return new Promise(function (resolve, reject) {
            db.run("INSERT INTO balances (balance, user_id) VALUES ($balance, $userId)", {
                $balance: balance,
                $userId: userId
            }, function (error) {
                if (error) {
                    reject(error);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    },

    getBalanceForUserId: function (userId) {
        return new Promise(function (resolve, reject) {
            db.get("SELECT balance FROM balances WHERE user_id = $userId", {
                $userId: userId
            }, function (error, row) {
                if (error) {
                    reject(error);
                } else {
                    let balance = row ? row.balance : 0;
                    resolve(balance);
                }
            });
        });
    },

    getDepositAddressForUserId: function (userId) {
        return new Promise(function (resolve, reject) {
            db.get("SELECT deposit_addr FROM balances WHERE user_id = $userId", {
                $userId: userId
            }, function (error, row) {
                if (error) {
                    reject(error);
                } else {
                    if (row) {
                        resolve(row.deposit_addr);
                    } else {
                        resolve(false);
                    }
                }
            });
        });
    },

    setDepositAddressForUserId: function (userId, depositAddress) {
        return new Promise(function (resolve, reject) {
            database.userIdExists(userId)
                .then(function () {
                    db.run("UPDATE balances SET deposit_addr = $depositAddress WHERE user_id = $userId", {
                        $depositAddress: depositAddress,
                        $userId: userId
                    }, function (error) {
                        if (error) {
                            reject(error);
                        } else {
                            resolve();
                        }
                    });
                }).catch(function (error) {
                    reject(error);
                });
        });
    }
};

module.exports = database;