pragma circom 2.0.4;

include "../node_modules/circomlib/circuits/switcher.circom";
include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

template MerkleVerifier(nLevels) {
	signal input root;
	signal input element;
	signal input siblings[nLevels];
	signal input isLeft[nLevels];

	signal input nLevelsUsed;

	component hashers[nLevels];
	component switchers[nLevels];

	// Used to select the hash to compare with the root
	component compareLevelRoot[nLevels];
	component constaintLevelRoot[nLevels];

	var current = element;

	for(var i = nLevels - 1; i >= 0; i--) {
		switchers[i] = Switcher();
		switchers[i].sel <== (1 - isLeft[i]);
		switchers[i].L <== current;
		switchers[i].R <== siblings[i];

		hashers[i] = Poseidon(2);
		hashers[i].inputs[0] <== switchers[i].outL;
		hashers[i].inputs[1] <== switchers[i].outR;

		current = hashers[i].out;

		compareLevelRoot[i] = IsEqual();
		compareLevelRoot[i].in[0] <== (nLevels - nLevelsUsed);
		compareLevelRoot[i].in[1] <== i;

		constaintLevelRoot[i] = ForceEqualIfEnabled();
		constaintLevelRoot[i].in[0] <== current;
		constaintLevelRoot[i].in[1] <== root;
		constaintLevelRoot[i].enabled <== compareLevelRoot[i].out;
	}

	// current === root;
}