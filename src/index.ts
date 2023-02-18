import { tokenize } from "./parser.js";

const CODE = `
const isPrime = fn (value: number) boolean {
	if (i == 1) return false;
	if (i == 2) return true;

	var i = 2;
	while (i * i <= n) {
		if (number % i == 0) return false;
		i += 1;
	}

	return true;
}

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
}

var onlyPrimes: primesUpTo(100) = 5;
print("The type is: " + to_string(primesUpTo(100)) + "\\n");
print("Trying to assign 6 to onlyPrimes");
onlyPrimes = 6; // should fail
`;

const tokens = tokenize(CODE);
console.log(JSON.stringify(tokens, (k, v) => typeof v === "symbol" ? v.description : v, 4));
