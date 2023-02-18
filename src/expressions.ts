import type { Statement } from "./statements.js";
import type { Value } from "./values.js";

export const ADD = Symbol("add");
export const SUB = Symbol("sub");
export const MUL = Symbol("mul");
export const DIV = Symbol("div");
export const MOD = Symbol("mod");
export const EQUAL = Symbol("equal");
export const NOT_EQUAL = Symbol("not equal");
export const GREATER = Symbol("greater");
export const GREATER_OR_EQUAL = Symbol("greater or equal");
export const LESS = Symbol("less");
export const LESS_OR_EQUAL = Symbol("less or equal");
export const AND = Symbol("and");
export const OR = Symbol("or");
export const NOT = Symbol("not");
export const NEGATE = Symbol("negate");
export const ARRAY_LENGTH = Symbol("array length");
export const DELITERALIZE = Symbol("deliteralize");
export const UNION = Symbol("union");
export const INTERSECT = Symbol("intersect");
export const EXTENDS = Symbol("extends");
export const LITERAL = Symbol("literal");
export const TYPED_ARRAY = Symbol("typed array");
export const TUPLE = Symbol("tuple");
export const OBJECT = Symbol("object");
export const SIGNATURE = Symbol("signature");
export const FUNCTION = Symbol("function");
export const IDENTIFIER = Symbol("identifier");
export const CALL = Symbol("call");
export const INDEXING = Symbol("indexing");
export const DECLTYPE = Symbol("decltype");

export type UnaryExpression = {
	readonly type:
		| typeof NOT
		| typeof NEGATE
		| typeof ARRAY_LENGTH
		| typeof DELITERALIZE;
	readonly op: Expression;
};

export type BinaryExpression = {
	readonly type:
		| typeof ADD
		| typeof SUB
		| typeof MUL
		| typeof DIV
		| typeof MOD
		| typeof EQUAL
		| typeof NOT_EQUAL
		| typeof GREATER
		| typeof GREATER_OR_EQUAL
		| typeof LESS
		| typeof LESS_OR_EQUAL
		| typeof AND
		| typeof OR
		| typeof UNION
		| typeof INTERSECT
		| typeof EXTENDS
		| typeof INDEXING;
	readonly a: Expression;
	readonly b: Expression;
};

export type LiteralExpression = {
	readonly type: typeof LITERAL;
	readonly value: Value;
};

export type TypedArrayExpression = {
	readonly type: typeof TYPED_ARRAY;
	readonly elementType: Expression;
};

export type TupleExpression = {
	readonly type: typeof TUPLE;
	readonly value: readonly Expression[];
};

export type ObjectExpression = {
	readonly type: typeof OBJECT;
	readonly value: { readonly [_: string]: Expression };
};

export type SignatureExpression = {
	readonly type: typeof SIGNATURE;
	readonly argumentTypes: readonly Expression[];
	readonly returnType: Expression;
};

export type FunctionExpression = {
	readonly type: typeof FUNCTION;
	readonly arguments: FunctionArgument[];
	readonly returnType: Expression;
	readonly body: readonly Statement[];
}

export type IdentifierExpression = {
	readonly type: typeof IDENTIFIER;
	readonly name: string;
};

export type CallExpression = {
	readonly type: typeof CALL;
	readonly fn: Expression;
	readonly arguments: readonly Expression[];
};

export type DecltypeExpression = {
	readonly type: typeof DECLTYPE;
	readonly name: string;
};

export type Expression =
	| UnaryExpression
	| BinaryExpression
	| LiteralExpression
	| TypedArrayExpression
	| TupleExpression
	| ObjectExpression
	| SignatureExpression
	| FunctionExpression
	| IdentifierExpression
	| CallExpression
	| DecltypeExpression;

export const UnaryExpression = (type: UnaryExpression["type"], op: Expression): UnaryExpression => ({ type, op });
export const BinaryExpression = (type: BinaryExpression["type"], a: Expression, b: Expression): BinaryExpression => ({ type, a, b });
export const LiteralExpression = (value: Value): LiteralExpression => ({ type: LITERAL, value });
export const IdentifierExpression = (name: string): IdentifierExpression => ({ type: IDENTIFIER, name });
export const CallExpression = (fn: Expression, args: readonly Expression[]) => ({ type: CALL, arguments: [...args] })
export const DecltypeExpression = (name: string): DecltypeExpression => ({ type: DECLTYPE, name });

export type FunctionArgument = {
	name: string;
	type: Expression;
};
