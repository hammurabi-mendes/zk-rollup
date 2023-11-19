pragma circom 2.0.4;

include "TransactionVerifier.circom";

template BatchVerifier(nLevels, mLevels) {
    signal input txRoot;

	signal input siblingsTx[2 ** mLevels][mLevels];
	signal input isLeftTx[2 ** mLevels][mLevels];

    signal input signature_R8[2 ** mLevels][2];
    signal input signature_S[2 ** mLevels];

    signal input pubkey_src[2 ** mLevels][2];
    signal input balance_src[2 ** mLevels];

    signal input pubkey_dst[2 ** mLevels][2];
    signal input balance_dst[2 ** mLevels];

    signal input transfer_amount[2 ** mLevels];

	signal input siblingsSrc[2 ** mLevels][nLevels];
	signal input isLeftSrc[2 ** mLevels][nLevels];

	signal input siblingsDst[2 ** mLevels][nLevels];
	signal input isLeftDst[2 ** mLevels][nLevels];

    signal input roots[2 * (2 ** mLevels) + 1];

    signal input oldRoot;
    signal input newRoot;

    signal input nLevelsUsed;

    // Make sure that we start at the oldRoot and finish at the newRoot
    roots[0] === oldRoot;
    roots[2 * (2 ** mLevels)] === newRoot;

    // For each transaction, verifies that it moves the state to the next root
    component transactionVerifier[2 ** mLevels];

    for(var t = 0; t < (2 ** mLevels); t++) {
        transactionVerifier[t] = TransactionVerifier(nLevels, mLevels);

        transactionVerifier[t].txRoot <== txRoot;

        for(var i = 0; i < mLevels; i++) {
            transactionVerifier[t].siblingsTx[i] <== siblingsTx[t][i];
            transactionVerifier[t].isLeftTx[i] <== isLeftTx[t][i];
        }

        transactionVerifier[t].signature_R8[0] <== signature_R8[t][0];
        transactionVerifier[t].signature_R8[1] <== signature_R8[t][1];
        transactionVerifier[t].signature_S <== signature_S[t];

        transactionVerifier[t].pubkey_src[0] <== pubkey_src[t][0];
        transactionVerifier[t].pubkey_src[1] <== pubkey_src[t][1];
        transactionVerifier[t].balance_src <== balance_src[t];

        transactionVerifier[t].pubkey_dst[0] <== pubkey_dst[t][0];
        transactionVerifier[t].pubkey_dst[1] <== pubkey_dst[t][1];
        transactionVerifier[t].balance_dst <== balance_dst[t];

        transactionVerifier[t].transfer_amount <== transfer_amount[t];

        for(var i = 0; i < nLevels; i++) {
            transactionVerifier[t].siblingsSrc[i] <== siblingsSrc[t][i];
            transactionVerifier[t].isLeftSrc[i] <== isLeftSrc[t][i];

            transactionVerifier[t].siblingsDst[i] <== siblingsDst[t][i];
            transactionVerifier[t].isLeftDst[i] <== isLeftDst[t][i];
        }

        transactionVerifier[t].oldRoot <== roots[2*t];
        transactionVerifier[t].midRoot <== roots[2*t + 1];
        transactionVerifier[t].newRoot <== roots[2*t + 2];

        transactionVerifier[t].nLevelsUsed <== nLevelsUsed;
    }
}

component main { public [ txRoot, oldRoot, newRoot ] } = BatchVerifier(8, 2);