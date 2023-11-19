import  { buildPoseidon, buildEddsa } from 'circomlibjs'
import { wtns, groth16 } from 'snarkjs'
import { program } from 'commander'
import { utils } from 'ffjavascript'
import fs from 'fs'

import { Wallet } from 'ethers'

import { Sequencer } from './sequencer.mjs'
import * as blockchainInterface from './blockchainInterface.mjs'

const PROVIDER = "http://127.0.0.1:8545/"

const TEST_TOKEN_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
const ROLLUP_ADDRESS = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";

let provider = blockchainInterface.getProvider(PROVIDER)
let contractJson

contractJson = blockchainInterface.readJSON("./artifacts/contracts/TestToken.sol/TestToken.json")
let testToken = blockchainInterface.getContract(provider, TEST_TOKEN_ADDRESS, contractJson.abi)

contractJson = blockchainInterface.readJSON("./artifacts/contracts/Rollup.sol/Rollup.json")
let rollup = blockchainInterface.getContract(provider, ROLLUP_ADDRESS, contractJson.abi)

// You can create a Wallet from a private key
// let wallet = new Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80")

// You can create a Wallet by asking for a private key if you blockchain is a local development network
let wallet = await provider.getSigner(0)

let eddsa = await buildEddsa()

let poseidon = await buildPoseidon()

let accounts = []

const zeroPubkey = [0n, 0n]

function importAccounts() {
	const privkeys = [
		"ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
		"59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
		"5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
		"7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
		"47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
		"8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba",
		"92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e",
		"4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356",
		"dbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97"
	]
	const balances = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90]

	// The Merkle tree looks like this:
	// .
	// .    .
	// ..   ..    .
	// .... ....  ..

	for (var i = 0; i < privkeys.length; i++) {
		let privkey = Buffer.from(privkeys[i], 'hex')
		let pubkey = eddsa.prv2pub(privkey)
		let balance = balances[i]

		pubkey = [
			poseidon.F.toObject(pubkey[0]),
			poseidon.F.toObject(pubkey[1])
		]

		let account = {
			privkey,
			pubkey,
			balance
		}

		accounts.push(account)
	}

	console.log(accounts)
}

let sequencer = new Sequencer(8, 2, poseidon, eddsa)

async function deposit() {
	await testToken.connect(wallet).approve(await rollup.getAddress(), 100000000000000000000n)

	for(var i = 0; i < accounts.length; i++) {
		let account = accounts[i]

		// Append the deposits into a local merkle tree
		sequencer.deposit(account.pubkey, account.balance)
		await rollup.connect(wallet).deposit([account.pubkey[0], account.pubkey[1]], account.balance, {
			gasLimit: 1000000})
	}

	sequencer.processPendingDeposits()
	await rollup.connect(wallet).processPendingDeposits()
}

async function verifyBatch() {
	let [
		txRoot,
		siblingsTx,
		isLeftTx,
		signature_R8,
		signature_S,
		pubkey_src,
		balance_src,
		pubkey_dst,
		balance_dst,
		siblingsSrc,
		isLeftSrc,
		siblingsDst,
		isLeftDst,
		transfer_amount,
		roots,
		oldRoot,
		newRoot
	] = sequencer.getUpdateProof()

	const circuitInput = {
		txRoot,
		siblingsTx,
		isLeftTx,
		signature_R8,
		signature_S,
		pubkey_src,
		balance_src,
		pubkey_dst,
		balance_dst,
		siblingsSrc,
		isLeftSrc,
		siblingsDst,
		isLeftDst,
		transfer_amount,
		roots,
		oldRoot,
		newRoot,
		nLevelsUsed: sequencer.nLevelsUsed
	}

	// console.log(circuitInput)
	// let input1 = utils.stringifyBigInts(circuitInput)
	// fs.writeFileSync("./input1.json", JSON.stringify(input1, undefined, 2))

	let witness = {type: "mem"}
	await wtns.calculate(circuitInput, "./BatchVerifier_js/BatchVerifier.wasm", witness)

	const proofResponse = await groth16.prove("./BatchVerifier_js/batchverifier_final.zkey", witness)

	let proof = utils.unstringifyBigInts(proofResponse.proof)
	let publicSignals = utils.unstringifyBigInts(proofResponse.publicSignals)

	// (optional) Prints proof, public part, and Solidity calldata

	// console.log("Proof:")
	// console.log(proof)
	// console.log("Public:")
	// console.log(publicSignals)
	// console.log("Solidity calldata:")
	// console.log(await groth16.exportSolidityCallData(proof, publicSignals))

	// (optional) Verifies proof locally

	let verificationKey = JSON.parse(fs.readFileSync("./BatchVerifier_js/verification_key.json"))

	const verificationResponse = await groth16.verify(verificationKey, publicSignals, proof)

	console.log("Local verification response: " + verificationResponse)

	// Calls the update function on the Rollup contract

	let resultUpdate = await rollup.connect(wallet).update(
		[proof.pi_a[0], proof.pi_a[1]],
		[[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]],
		[proof.pi_c[0], proof.pi_c[1]],
		circuitInput.txRoot, circuitInput.oldRoot, circuitInput.newRoot,
		{ gasLimit: 1000000 }
	)

	let t1 = await resultUpdate.wait()

	console.log(resultUpdate)
	console.log(t1)

	// We don't need to return here; we can collect the event in the blockchain with those numbers
	return [oldRoot, txRoot, newRoot]
}

async function withdrawFunds(tx, txRoot, txSignature, pubkey_src, pubkey_dst, transfer_amount) {
	let [
		siblingsTx,
		isLeftTx,
	] = sequencer.getWithdrawProof(tx, txRoot)
	
	const circuitInput = {
		tx,
		txRoot,
		siblingsTx,
		isLeftTx,
		signature_R8: txSignature.R8,
		signature_S: txSignature.S,
		pubkey_src,
		pubkey_dst,
		transfer_amount
	}

	// console.log(circuitInput)
	// let input2 = utils.stringifyBigInts(circuitInput)
	// fs.writeFileSync("./input2.json", JSON.stringify(input2, undefined, 2))

	let witness = {type: "mem"}
	await wtns.calculate(circuitInput, "./WithdrawVerifier_js/WithdrawVerifier.wasm", witness)

	const proofResponse = await groth16.prove("./WithdrawVerifier_js/withdrawverifier_final.zkey", witness)

	let proof = utils.unstringifyBigInts(proofResponse.proof)
	let publicSignals = utils.unstringifyBigInts(proofResponse.publicSignals)

	// (optional) Prints proof, public part, and Solidity calldata

	// console.log("Proof:")
	// console.log(proof)
	// console.log("Public:")
	// console.log(publicSignals)
	// console.log("Solidity calldata:")
	// console.log(await groth16.exportSolidityCallData(proof, publicSignals))

	// (optional) Verifies proof locally

	let verificationKey = JSON.parse(fs.readFileSync("./WithdrawVerifier_js/verification_key.json"))

	const verificationResponse = await groth16.verify(verificationKey, publicSignals, proof)

	console.log("Local verification response: " + verificationResponse)

	// Calls the withdraw function on the Rollup contract

	let resultUpdate = await rollup.connect(wallet).withdraw(
		[proof.pi_a[0], proof.pi_a[1]],
		[[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]],
		[proof.pi_c[0], proof.pi_c[1]],
		"0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", 4n, tx, txRoot,
		{ gasLimit: 1000000 }
	)

	let t1 = await resultUpdate.wait()

	console.log(resultUpdate)
	console.log(t1)
}

async function main() {
	importAccounts()
	await deposit()

	// This one will fail
	sequencer.hashSignTransferTransaction(accounts[0].privkey, accounts[0].pubkey, accounts[3].pubkey, 2)

	sequencer.hashSignTransferTransaction(accounts[3].privkey, accounts[3].pubkey, accounts[5].pubkey, 3)
	sequencer.hashSignTransferTransaction(accounts[2].privkey, accounts[2].pubkey, accounts[4].pubkey, 5)
	sequencer.hashSignTransferTransaction(accounts[4].privkey, accounts[4].pubkey, accounts[0].pubkey, 5)

	// This one will be withdrawn
	let [tx, txSignature, txIndex] = sequencer.hashSignTransferTransaction(accounts[4].privkey, accounts[4].pubkey, zeroPubkey, 4)

	let [oldRoot, txRoot, newRoot] = await verifyBatch()
	sequencer.restart()

	await withdrawFunds(tx, txRoot, txSignature, accounts[4].pubkey, zeroPubkey, 4)
}

await main()