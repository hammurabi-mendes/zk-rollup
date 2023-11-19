pragma circom 2.0.4;

include "../node_modules/circomlib/circuits/comparators.circom";

include "../node_modules/circomlib/circuits/eddsaposeidon.circom";
include "../node_modules/circomlib/circuits/poseidon.circom";

include "MerkleVerifier.circom";

template TransactionVerifier(nLevels, mLevels) {
    signal input txRoot;

	signal input siblingsTx[mLevels];
	signal input isLeftTx[mLevels];

    signal input signature_R8[2];
    signal input signature_S;

    signal input pubkey_src[2];
    signal input balance_src;

    signal input pubkey_dst[2];
    signal input balance_dst;

    signal input transfer_amount;

	signal input siblingsSrc[nLevels];
	signal input isLeftSrc[nLevels];

	signal input siblingsDst[nLevels];
	signal input isLeftDst[nLevels];

    signal input oldRoot;
    signal input midRoot;
    signal input newRoot;

    signal input nLevelsUsed;

    // 1) Verifies transaction validity: balance, signature, presence in txRoot
    component transactionHasher = Poseidon(5);

    transactionHasher.inputs[0] <== pubkey_src[0];
    transactionHasher.inputs[1] <== pubkey_src[1];
    transactionHasher.inputs[2] <== pubkey_dst[0];
    transactionHasher.inputs[3] <== pubkey_dst[1];
    transactionHasher.inputs[4] <== transfer_amount;

    //  1.1) First verify that the transfer amount is smaller than the sender balance
    component validTransferVerifier = LessEqThan(252);

    validTransferVerifier.in[0] <== transfer_amount;
    validTransferVerifier.in[1] <== balance_src;

    validTransferVerifier.out === 1;

    //  1.2) Verifies the signature of the transaction with EDDSA/Poseidon
    component signatureVerifier = EdDSAPoseidonVerifier();

    signatureVerifier.enabled <== 1;
    signatureVerifier.Ax <== pubkey_src[0];
    signatureVerifier.Ay <== pubkey_src[1];
    signatureVerifier.S <== signature_S;
    signatureVerifier.R8x <== signature_R8[0];
    signatureVerifier.R8y <== signature_R8[1];
    signatureVerifier.M <== transactionHasher.out;

    //  1.3) Verifies that the transaction record exists in txRoot
    component txRootVerifier = MerkleVerifier(mLevels);

    txRootVerifier.root <== txRoot;
    txRootVerifier.element <== transactionHasher.out;

	for(var i = 0; i < mLevels; i++) {
        txRootVerifier.siblings[i] <== siblingsTx[i];
        txRootVerifier.isLeft[i] <== isLeftTx[i];
    }

    txRootVerifier.nLevelsUsed <== mLevels;

    // 2) Verifies that the original sender record exists in the oldRoot

    //  2.1) Hash the old sender account
    component oldSenderLeafHasher = Poseidon(3);

    oldSenderLeafHasher.inputs[0] <== pubkey_src[0];
    oldSenderLeafHasher.inputs[1] <== pubkey_src[1];
    oldSenderLeafHasher.inputs[2] <== balance_src;

    //  2.2) Verifies that the old sender exists in the oldRoot
    component oldRootVerifier = MerkleVerifier(nLevels);

    oldRootVerifier.root <== oldRoot;
    oldRootVerifier.element <== oldSenderLeafHasher.out;

	for(var i = 0; i < nLevels; i++) {
        oldRootVerifier.siblings[i] <== siblingsSrc[i];
        oldRootVerifier.isLeft[i] <== isLeftSrc[i];
    }
    
    oldRootVerifier.nLevelsUsed <== nLevelsUsed;

    // 3) Verifies that the deducted sender record exists in the midRoot

    //  3.1) Hash the mid sender account
    component midSenderLeafHasher = Poseidon(3);

    midSenderLeafHasher.inputs[0] <== pubkey_src[0];
    midSenderLeafHasher.inputs[1] <== pubkey_src[1];
    midSenderLeafHasher.inputs[2] <== balance_src - transfer_amount;

    //  3.2) Verifies that the mid sender exists in the midRoot
    component midRootVerifier1 = MerkleVerifier(nLevels);

    midRootVerifier1.root <== midRoot;
    midRootVerifier1.element <== midSenderLeafHasher.out;

	for(var i = 0; i < nLevels; i++) {
        midRootVerifier1.siblings[i] <== siblingsSrc[i];
        midRootVerifier1.isLeft[i] <== isLeftSrc[i];
    }

    midRootVerifier1.nLevelsUsed <== nLevelsUsed;

    // 4) Verifies that the original receiver record exists in the midRoot

    //  4.1) Hash the old receiver account
    component oldReceiverLeafHasher = Poseidon(3);

    oldReceiverLeafHasher.inputs[0] <== pubkey_dst[0];
    oldReceiverLeafHasher.inputs[1] <== pubkey_dst[1];
    oldReceiverLeafHasher.inputs[2] <== balance_dst;

    //  4.2) Verifies that the old receiver exists in the midRoot
    component midRootVerifier2 = MerkleVerifier(nLevels);

    midRootVerifier2.root <== midRoot;
    midRootVerifier2.element <== oldReceiverLeafHasher.out;

	for(var i = 0; i < nLevels; i++) {
        midRootVerifier2.siblings[i] <== siblingsDst[i];
        midRootVerifier2.isLeft[i] <== isLeftDst[i];
    }

    midRootVerifier2.nLevelsUsed <== nLevelsUsed;

    // 5) Verifies that the credited receiver record exists in the newRoot

    //  5.1) Hash the new receiver account
    component newReceiverLeafHasher = Poseidon(3);

    newReceiverLeafHasher.inputs[0] <== pubkey_dst[0];
    newReceiverLeafHasher.inputs[1] <== pubkey_dst[1];
    newReceiverLeafHasher.inputs[2] <== balance_dst + transfer_amount;

    //  5.2) Verifies that the new receiver exists in the newRoot
    component newRootVerifier = MerkleVerifier(nLevels);

    newRootVerifier.root <== newRoot;
    newRootVerifier.element <== newReceiverLeafHasher.out;

	for(var i = 0; i < nLevels; i++) {
        newRootVerifier.siblings[i] <== siblingsDst[i];
        newRootVerifier.isLeft[i] <== isLeftDst[i];
    }

    newRootVerifier.nLevelsUsed <== nLevelsUsed;
}