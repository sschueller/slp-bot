#!/usr/bin/env node

const fs = require("fs")
const BITBOX = require('bitbox-sdk').BITBOX
const config = require('./config.json');

const walletFile = "wallet.json";
const walletInfoFile = "wallet-info.txt";

const net = config.testnet ? config.network_testnet : config.network_mainnet;

// Instantiate BITBOX based on the network.
const bitbox = new BITBOX({ restURL: net });
const lang = config.wordListLanguage; // Set the language of the wallet.

console.info("Using network: ", net);

// These objects used for writing wallet information out to a file.
let outStr = ""
const outObj = {}

// Check if this will overwrite existing wallet
if (fs.existsSync(walletFile) || fs.existsSync(walletInfoFile)) {
  console.error('Wallet files ('+walletFile+', '+walletInfoFile+') exist and would be overwritten!!')
  process.exit(1);
}

// create 256 bit BIP39 mnemonic
const mnemonic = bitbox.Mnemonic.generate(
  128,
  bitbox.Mnemonic.wordLists()[lang]
)

console.log("BIP44 $BCH Wallet")
outStr += "BIP44 $BCH Wallet\n"
console.log(`128 bit ${lang} BIP39 Mnemonic: `, mnemonic)
outStr += `\n128 bit ${lang} BIP32 Mnemonic:\n${mnemonic}\n\n`
outObj.mnemonic = mnemonic

// root seed buffer
const rootSeed = bitbox.Mnemonic.toSeed(mnemonic)

// master HDNode
const masterHDNode = bitbox.HDNode.fromSeed(rootSeed, config.network)

// HDNode of BIP44 account
console.log(`BIP44 Account: "m/44'/145'/0'"`)
outStr += `BIP44 Account: "m/44'/145'/0'"\n`

// Generate the first 3 seed addresses.
for (let i = 0; i < 3; i++) {
  const childNode = masterHDNode.derivePath(`m/44'/145'/0'/0/${i}`)
  console.log(`m/44'/145'/0'/0/${i}: ${bitbox.HDNode.toCashAddress(childNode)}`)
  outStr += `m/44'/145'/0'/0/${i}: ${bitbox.HDNode.toCashAddress(childNode)}\n`

  // Save the first seed address for use in the .json output file.
  if (i === 0) {
    outObj.cashAddress = bitbox.HDNode.toCashAddress(childNode)
    outObj.legacyAddress = bitbox.HDNode.toLegacyAddress(childNode)
    outObj.WIF = bitbox.HDNode.toWIF(childNode)
  }
}

// Write the extended wallet information into a text file.
fs.writeFile(walletInfoFile, outStr, function (err) {
  if (err) return console.error(err)
  console.log(walletInfoFile +" written successfully.")
})

// Write out the basic information into a json file for other example apps to use.
fs.writeFile(walletFile, JSON.stringify(outObj, null, 2), function (err) {
  if (err) return console.error(err)
  console.log(walletFile + " written successfully.")
})