'use strict';

const BigNumber = require('bignumber.js');
const SLPSDK = require("slp-sdk");
const fs = require("fs");
const forEach = require('async-foreach').forEach;


const config = require(__dirname + '/config.json');
const walletFile = __dirname + '/wallet.json';

if (!fs.existsSync(walletFile)) {
    console.error('error_no_wallet_file', walletFile);
    process.exit(1);
}

const wallet = require(walletFile);

const net = config.testnet ? config.network_testnet : config.network_mainnet;
const webSocketUrl = config.testnet ? config.ws_testnet : config.ws_mainnet;

const SLP = new SLPSDK({ restURL: net });
const slpjs = SLP.slpjs;
const bitbox = SLP;
const bitboxNetwork = new slpjs.BitboxNetwork(SLP);

var token = {

    addToBalance: function (balance, addAmount) {
        return (new BigNumber(balance)).plus((new BigNumber(addAmount))).toPrecision();
    },

    substractFromBalance: function (balance, subtractAmount) {
        return (new BigNumber(balance)).minus((new BigNumber(subtractAmount))).toPrecision();
    },

    getTokenInfo: function () {
        return bitboxNetwork.getTokenInformation(config.tokenAddress);
    },

    generateDepositAddress: function (derivePathInteger) {
        return new Promise(function (resolve, reject) {
            let seedBuffer = bitbox.Mnemonic.toSeed(wallet.mnemonic);
            const masterHDNode = bitbox.HDNode.fromSeed(seedBuffer);
            const childNode = masterHDNode.derivePath(`m/44'/145'/0'/0/${derivePathInteger}`)
            let newAddr = bitbox.HDNode.toCashAddress(childNode);
            let slpAddr = slpjs.Utils.toSlpAddress(newAddr);
            if (slpAddr) {
                resolve(slpAddr);
            } else {
                reject();
            }
        });
    },

    getBalance: function (address) {
        return bitboxNetwork.getAllSlpBalancesAndUtxos(address || wallet.cashAddress);
    },

    findFundsForTx: function (addresses, requiredAmount) {
        return new Promise(function (resolve, reject) {

            let txos = [];
            let have = 0;

            forEach(addresses, function (address, index, arr) {
                let done = this.async();
                // console.info('have: ', have);
                // console.info('requiredAmount: ', requiredAmount);
                // console.info('checking balance of address: ', address);
                if (have >= requiredAmount) {
                    done(false);
                }
                token.getBalance(address.deposit_addr).then(function (balances) {
                    if (balances.slpTokenBalances[config.tokenAddress] !== undefined) {
                        // token
                        let inputUtxos = balances.slpTokenUtxos[config.tokenAddress];
                        
                        // add bch
                        inputUtxos = inputUtxos.concat(balances.nonSlpUtxos);

                        txos = txos.concat(inputUtxos);
                        have = token.addToBalance(have, balances.slpTokenBalances[config.tokenAddress]);
                    }
                    done();
                })

            }, function (notAborted, arr) {
                resolve(txos);
            });

        });

    },

    // Assumes user is permitted to retrieve amount
    withdraw: function (slpOutAddress, amount, txos) {

        (async function () {

            let tokenInfo = await token.getTokenInfo();
            let sendAmounts = [amount];
            let bchChangeReceiverAddress = slpjs.Utils.toSlpAddress(wallet.cashAddress);

            sendAmounts = sendAmounts.map(a => (new BigNumber(a)).times(10 ** tokenInfo.decimals));

            // console.info('tokenAddress', config.tokenAddress);
            // console.info('sendAmounts', sendAmounts);
            // console.info('txos', txos);
            // console.info('slpOutAddress', slpOutAddress);
            // console.info('bchChangeReceiverAddress', bchChangeReceiverAddress);

            // Set the proper private key for each Utxo
            txos.forEach(txo => txo.wif = wallet.WIF);

            // Send token
            let sendTxid;
            (async function () {
             
                sendTxid = await bitboxNetwork.simpleTokenSend(
                    config.tokenAddress, // tokenId
                    sendAmounts,
                    txos,
                    slpOutAddress, // tokenReceiverAddress
                    bchChangeReceiverAddress // bchChangeReceiverAddress
                ).catch(function (error) {
                    console.info('error', error);
                })

                if (sendTxid) {
                    console.info("SEND txn complete:", sendTxid);
                    return sendTxid;
                } else {
                    console.info("txn failed: ", slpOutAddress, amount);
                    return false;
                }
            })();
        })();

    },

    startWebSocket: function (__callback) {

        // listen for mempool entries
        let socket = new SLP.Socket({
            callback: () => {
                console.info("Web Socket Connected")
            },
            wsURL: webSocketUrl
        })
        socket.listen(
            {
                v: 3,
                q: {
                    find: {
                    }
                }
            },
            (message) => {

                let obj = JSON.parse(message);

                // console.log(message);

                if (obj.type === "mempool") {
                    obj.data.forEach(data => {
                        if (data.slp) {
                            // is this my token
                            if (data.slp.detail.tokenIdHex === config.tokenAddress) {
                                // console.log(data.slp.detail);
                                // console.log(data.slp.detail.outputs);

                                for (const output of data.slp.detail.outputs) {
                                    __callback({
                                        outputAddress: output.address,
                                        amount: output.amount
                                    });
                                };
                            }
                        }
                    });
                }
            }
        )
    }

};

module.exports = token;