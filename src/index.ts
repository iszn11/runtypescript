import { run } from "./interpreter.js";
import { parse } from "./parser.js";
import { tokenize } from "./tokenizer.js";

const CODE = `
const isPrime = fn (value: number) boolean {
	if (value == 1) { return false; }
	if (value == 2) { return true; }

	var i = 2;
	while (i * i <= value) {
		if (value % i == 0) {
			return false;
		}
		i += 1;
	}

	return true;
};

const primesUpTo = fn (n: number) any {
	var i = 2;
	var ret: any = 2;

	while (i <= n) {
		if (isPrime(i)) {
			ret |= i;
		}
		i += 1;
	}

	return ret;
};

const type = primesUpTo(20);
var onlyPrimes: type = 5;
println("The type is: " + to_string(type));
println("Deliteralized: " + to_string(~type));

const buildStringDictionary = fn (keys: string[]) any {
	var i = 0;
	const ret: any = {};
	while (i < #keys) {
		ret[keys[i]] = string;
		i += 1;
	}
	return ret;
};

println(buildStringDictionary(["foo", "bar"]));
println(buildStringDictionary(["foo", "bar", "baz"]));

const obj: buildStringDictionary(["foo"]) = { foo: "should work" };
println("decltype of obj: " + to_string(decltype obj));

println("Trying to assign 11 to onlyPrimes");
onlyPrimes = 11; // should work
println("Trying to assign 6 to onlyPrimes");
onlyPrimes = 6; // should fail
`;

let tokens;
try {
	tokens = tokenize(CODE);
	console.log(JSON.stringify(tokens, (k, v) => typeof v === "symbol" ? v.description : v, 4));
} catch (error: any) {
	console.error(`Tokenizer error: ${error.message}`);
	process.exit(1);
}

let ast;
try {
	ast = parse(tokens);
	console.log(JSON.stringify(ast, (k, v) => typeof v === "symbol" ? v.description : v, 4));
} catch (error: any) {
	console.error(`Parser error: ${error.message}`);
	process.exit(1);
}

try {
	run(ast);
} catch (error: any) {
	console.error(`Runtime error: ${error.message}`);
	process.exit(1);
}
