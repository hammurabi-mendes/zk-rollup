import { MerkleTree } from "./merkle_tree.mjs"

export class Sequencer {
    constructor(nBottomLevel, mBottomLevel, poseidon, eddsa) {
        this.nBottomLevel = nBottomLevel
        this.mBottomLevel = mBottomLevel

        this.poseidon = poseidon

        this.hasher2 = (a, b) => {
            return poseidon.F.toObject(poseidon([a, b]))
        }

        this.hasher3 = (a, b, c) => {
            return poseidon.F.toObject(poseidon([a, b, c]))
        }

        this.hasher5 = (a, b, c, d, e) => {
            return poseidon.F.toObject(poseidon([a, b, c, d, e]))
        }

        this.eddsa = eddsa

        this.accountsTree = new MerkleTree(nBottomLevel, this.hasher2)
        this.accountPosition = new Map() // pubkey -> position in accountsTree
        this.accounts = [] // account high level information
        this.lastAccountPosition = 0

        this.transactionsTree = new MerkleTree(mBottomLevel, this.hasher2)
        this.transactionPosition = new Map() // txHash -> position in transactionsTree
        this.transactions = [] // transfer high level information
        this.lastTransactionPosition = 0

        this.committedBatches = new Map() // txRoot -> some Transaction Tree

        this.allRoots = undefined
        this.allSiblingsSrc = []
        this.allIsLeftSrc = []

        this.allSiblingsDst = []
        this.allIsLeftDst = []

        this.nLevelsUsed = 0

        const zero = Buffer.from("0000000000000000000000000000000000000000000000000000000000000000", 'hex')

        this.deposit([zero, zero], 0)
    }

    hashTransaction(pubkey1, pubkey2, value) {
        return this.hasher5(
            pubkey1[0],
            pubkey1[1],
            pubkey2[0],
            pubkey2[1],
            value
        )
    }

    signTransaction(privkey, transactionHash) {
        let signature = this.eddsa.signPoseidon(privkey, this.poseidon.F.fromObject(transactionHash))

        signature.R8 = [
            this.poseidon.F.toObject(signature.R8[0]),
            this.poseidon.F.toObject(signature.R8[1])
        ]

        return signature
    }

    hashSignTransferTransaction(privkey1, pubkey1, pubkey2, value) {
        let transactionHash = this.hashTransaction(pubkey1, pubkey2, value)

        let transactionSignature = this.signTransaction(privkey1, transactionHash)

        let transactionPosition = this.transfer(transactionSignature, transactionHash, pubkey1, pubkey2, value)

        return [transactionHash, transactionSignature, transactionPosition]
    }

    deposit(pubkey, amount) {
		// Hash the accounts using the same procedure as the smart contract
		let accountHash = this.hasher3(pubkey[0], pubkey[1], amount)

        this.accountsTree.append(accountHash)

        this.accountPosition.set(this.hasher2(pubkey[0], pubkey[1]), this.lastAccountPosition++)
        this.accounts.push({
            pubkey,
            balance: amount
        })
    }

    processPendingDeposits() {
        this.nLevelsUsed = Math.floor(Math.log2(this.accountsTree.size()))

        this.currentRoot = this.accountsTree.getNode(this.nBottomLevel - this.nLevelsUsed, 0)

        this.allRoots = [this.currentRoot]
    }

    transfer(transactionSignature, transactionHash, pubkey1, pubkey2, value) {
        if(this.currentRoot == undefined) {
            console.log("Pending deposits have not been processed")
            return
        }
     
        if(this.transactionsTree.size() == (2 ** this.mBottomLevel)) {
            console.log("Batch is full, please update contract")
            return
        }

        let position1 = this.accountPosition.get(this.hasher2(pubkey1[0], pubkey1[1]))
        let position2 = this.accountPosition.get(this.hasher2(pubkey2[0], pubkey2[1]))

        let account1 = this.accounts[position1]
        let account2 = this.accounts[position2]

        if(value > account1.balance) {
            console.log("Not enough balance on source account")
            return
        }

		let updatedAccount1 = this.hasher3(account1.pubkey[0], account1.pubkey[1], account1.balance - value)
		let updatedAccount2 = this.hasher3(account2.pubkey[0], account2.pubkey[1], account2.balance + value)

        let [root0, siblings0, isLeft0] = this.accountsTree.getLevelProof(position1, this.nBottomLevel - this.nLevelsUsed)
        console.assert(root0 == this.allRoots[this.allRoots.length - 1])

        this.accountsTree.insert(position1, updatedAccount1, true) // Last parameter: update entry if it exists
        let [root1, siblings1, isLeft1] = this.accountsTree.getLevelProof(position1, this.nBottomLevel - this.nLevelsUsed)

        this.accountsTree.insert(position2, updatedAccount2, true) // Last parameter: update entry if it exists
        let [root2, siblings2, isLeft2] = this.accountsTree.getLevelProof(position2, this.nBottomLevel - this.nLevelsUsed)

        this.transactionsTree.append(transactionHash)

        this.transactionPosition.set(transactionHash, this.lastTransactionPosition++)
        this.transactions.push({
            transactionSignature,
            pubkey1,
            balance1: account1.balance,
            pubkey2,
            balance2: account2.balance,
            transfer_amount: value
        })

        this.allRoots.push(root1)
        this.allRoots.push(root2)

        this.allSiblingsSrc.push(siblings1)
        this.allIsLeftSrc.push(isLeft1)

        this.allSiblingsDst.push(siblings2)
        this.allIsLeftDst.push(isLeft2)

        // Make sure to update balances for next transaction
        account1.balance -= value
        account2.balance += value
        
        return this.lastTransactionPosition
    }

    restart() {
        this.committedBatches.set(this.transactionsTree.getRoot(), this.transactionsTree)
        // TODO: transactionsTree.compact()

        this.transactionsTree = new Map()
        this.transactions = []
        this.lastTransactionPosition = 0

        let currentRoot = this.accountsTree.getNode(this.nBottomLevel - this.nLevelsUsed, 0)

        this.allRoots = [currentRoot]
        this.allSiblingsSrc = []
        this.allIsLeftSrc = []

        this.allSiblingsDst = []
        this.allIsLeftDst = []
    }

    getUpdateProof() {
        if(this.transactionsTree.size() != (2 ** this.mBottomLevel)) {
            console.log("Batch is not full, please perform more transactions")
            return
        }

        let [txRoot, _txSiblings, _txIsLeft] = this.transactionsTree.getProof(0)

        let allSiblingsTx = []
        let allIsLeftTx = []

        for(var i = 0; i < this.transactionsTree.size(); i++) {
            let [iTxRoot, iTxSiblings, iTxIsLeft] = this.transactionsTree.getProof(i)

            allSiblingsTx.push(iTxSiblings)
            allIsLeftTx.push(iTxIsLeft)
        }

        let allSignature_R8 = []
        let allSignature_S = []
        let allPubkey_src = []
        let allBalance_src = []
        let allPubkey_dst = []
        let allBalance_dst = []
        let allTransfer_amount = []

        for(var i = 0; i < this.transactions.length; i++) {
            allSignature_R8.push(this.transactions[i].transactionSignature.R8)
            allSignature_S.push(this.transactions[i].transactionSignature.S)
            allPubkey_src.push(this.transactions[i].pubkey1)
            allBalance_src.push(this.transactions[i].balance1)
            allPubkey_dst.push(this.transactions[i].pubkey2)
            allBalance_dst.push(this.transactions[i].balance2)
            allTransfer_amount.push(this.transactions[i].transfer_amount)
        }

        let oldRoot = this.allRoots[0]
        let newRoot = this.allRoots[this.allRoots.length - 1]

        return [
            txRoot,
            allSiblingsTx,
            allIsLeftTx,
            allSignature_R8,
            allSignature_S,
            allPubkey_src,
            allBalance_src,
            allPubkey_dst,
            allBalance_dst,
            this.allSiblingsSrc,
            this.allIsLeftSrc,
            this.allSiblingsDst,
            this.allIsLeftDst,
            allTransfer_amount,
            this.allRoots,
            oldRoot,
            newRoot
        ]
    }

    getWithdrawProof(tx, txRoot) {
        let txPosition = this.transactionPosition.get(tx)
        let txTree = this.committedBatches.get(txRoot)

        let [root, siblings, isLeft] = txTree.getProof(txPosition)

        console.assert(txRoot == root)

        return [siblings, isLeft]
    }
}