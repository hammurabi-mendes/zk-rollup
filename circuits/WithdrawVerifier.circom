pragma circom 2.0.4;

include "../node_modules/circomlib/circuits/comparators.circom";

include "../node_modules/circomlib/circuits/eddsaposeidon.circom";
include "../node_modules/circomlib/circuits/poseidon.circom";

include "MerkleVerifier.circom";

template WithdrawVerifier(mLevels) {
    signal input tx;
    signal input txRoot;

	signal input siblingsTx[mLevels];
	signal input isLeftTx[mLevels];

    signal input signature_R8[2];
    signal input signature_S;

    signal input pubkey_src[2];
    signal input pubkey_dst[2];

    signal input transfer_amount;

    // 1) Verifies transaction validity: balance, signature, presence in txRoot
    component transactionHasher = Poseidon(5);

    transactionHasher.inputs[0] <== pubkey_src[0];
    transactionHasher.inputs[1] <== pubkey_src[1];
    transactionHasher.inputs[2] <== pubkey_dst[0];
    transactionHasher.inputs[3] <== pubkey_dst[1];
    transactionHasher.inputs[4] <== transfer_amount;

    transactionHasher.out === tx;

    //  1.1) Verifies that the recipient is the zero address
    pubkey_dst[0] === 0;
    pubkey_dst[1] === 0;

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
}

component main { public [ tx, txRoot, transfer_amount ] } = WithdrawVerifier(2);