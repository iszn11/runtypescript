import * as expressions from "./expressions.js";
import * as statements from "./statements.js";
import * as values from "./values.js";

export type Binding = {
	constant: boolean;
	declaredType: values.Value;
	value: values.Value;
};

export type Scope = { [_: string]: Binding };

/* TODO ON MUTATION OF LVALUES
 * Validate all existing bindings against mutated binding, if it's being used as
 * a decltype. Might be convoluted when function scopes are involved, but worth
 * trying.
 */

type LValueRef = {
	name: string;
	binding: Binding;
	path: (number | string)[];
};

const GLOBAL_SCOPE = (): Scope => ({
	"nil": { constant: true, declaredType: values.NilValue, value: values.NilValue },
	"false": { constant: true, declaredType: values.FalseValue, value: values.FalseValue },
	"true": { constant: true, declaredType: values.FalseValue, value: values.FalseValue },
	"boolean": { constant: true, declaredType: values.BooleanValue, value: values.BooleanValue },
	"string": { constant: true, declaredType: values.StringValue, value: values.StringValue },
	"number": { constant: true, declaredType: values.NumberValue, value: values.NumberValue },
	"any": { constant: true, declaredType: values.AnyValue, value: values.AnyValue },
});

type Context = {
	scopeStack: Scope[];
	unwind: {
		type: "break";
	} | {
		type: "continue";
	} | {
		type: "return";
		value: values.Value;
	} | null;
};

export function run(block: readonly statements.Statement[]) {
	const ctx: Context = {
		scopeStack: [GLOBAL_SCOPE()],
		unwind: null,
	}
	runBlock(ctx, block, true);
	if (ctx.unwind !== null) {
		throw new Error(`Cannot ${ctx.unwind.type} from top-level code`);
	}
}

function runBlock(ctx: Context, block: readonly statements.Statement[], sameScope = false) {
	if (!sameScope) ctx.scopeStack.push({});
	for (const statement of block) {
		runStatement(ctx, statement);
		if (ctx.unwind !== null) {
			break;
		}
	}
	if (!sameScope) ctx.scopeStack.pop();
}

function runStatement(ctx: Context, statement: statements.Statement) {
	switch (statement.type) {
		case statements.DECLARATION: {
			const value = evaluateExpression(ctx, statement.value);
			let declaredType: values.Value;
			if ("declaredType" in statement) {
				declaredType = evaluateExpression(ctx, statement.declaredType);
				if (!values.assignableTo(value, declaredType)) {
					throw new Error(`Value ${values.toString(value)} is not assignable to declared type ${declaredType}`);
				}
			} else {
				declaredType = values.deliteralize(value);
			}
			const constant = statement.constant;
			createBinding(ctx, statement.name, { constant, declaredType, value });
			break;
		}
		case statements.ASSIGNMENT: {
			const lvalue = evaluateLValue(ctx, statement.lhs);
			const rvalue = evaluateExpression(ctx, statement.rhs);
			if (lvalue.path.length === 0) {
				if (lvalue.binding.constant) {
					throw new Error(`Cannot assign to constant binding ${lvalue.name}`);
				}
				if (!values.assignableTo(rvalue, lvalue.binding.declaredType)) {
					throw new Error(`Value ${values.toString(rvalue)} is not assignable to declared type ${lvalue.binding.declaredType}`);
				}
			} else {
				assignPath(ctx, lvalue, rvalue);
			}
			break;
		}
		case statements.IF_ELSE_CHAIN: runIfElseChain(ctx, statement); break;
		case statements.WHILE_LOOP: runWhileLoop(ctx, statement); break;
		case statements.EXPRESSION: evaluateExpression(ctx, statement.expression); break;
		case statements.RETURN: {
			const value = "expression" in statement
				? evaluateExpression(ctx, statement.expression)
				: values.NilValue;
			ctx.unwind = { type: "return", value };
			break;
		}
		case statements.BREAK: ctx.unwind = { type: "break" }; break;
		case statements.CONTINUE: ctx.unwind = { type: "continue" }; break;
	}
}

function runIfElseChain(ctx: Context, statement: statements.IfElseChainStatement) {
	for (const ifBlock of statement.chain) {
		const condition = evaluateExpression(ctx, ifBlock.condition);
		if (condition.type === values.FALSE) continue;
		if (condition.type === values.TRUE) {
			runBlock(ctx, ifBlock.block);
			return;
		}
		throw new Error(`Condition evaluated to ${values.toString(condition)}, false or true expected`);
	}
	if ("elseBlock" in statement) {
		runBlock(ctx, statement.elseBlock);
	}
}

function runWhileLoop(ctx: Context, statement: statements.WhileLoopStatement) {
	while (true) {
		const condition = evaluateExpression(ctx, statement.condition);
		if (condition.type === values.FALSE) {
			if (ctx.unwind?.type === "continue") {
				ctx.unwind = null;
			}
			return;
		}
		if (condition.type !== values.TRUE) {
			throw new Error(`Condition evaluated to ${values.toString(condition)}, false or true expected`);
		}
		runBlock(ctx, statement.block);
		if (ctx.unwind?.type === "break") {
			ctx.unwind = null;
			return;
		}
		if (ctx.unwind?.type === "return") {
			return;
		}
	}
}

function evaluateExpression(ctx: Context, expression: expressions.Expression): values.Value {
	switch (expression.type) {
		case expressions.ADD: {
			const a = evaluateExpression(ctx, expression.a);
			const b = evaluateExpression(ctx, expression.b);
			if (a.type !== values.NUMBER_LITERAL || b.type !== values.NUMBER_LITERAL) {
				throw new Error(`Tried adding ${values.toString(a)} and ${values.toString(b)}`);
			}
			return values.NumberLiteralValue(a.value + b.value);
		}
		case expressions.SUB: {
			const a = evaluateExpression(ctx, expression.a);
			const b = evaluateExpression(ctx, expression.b);
			if (a.type !== values.NUMBER_LITERAL || b.type !== values.NUMBER_LITERAL) {
				throw new Error(`Tried subtracting ${values.toString(a)} and ${values.toString(b)}`);
			}
			return values.NumberLiteralValue(a.value - b.value);
		}
		case expressions.MUL: {
			const a = evaluateExpression(ctx, expression.a);
			const b = evaluateExpression(ctx, expression.b);
			if (a.type !== values.NUMBER_LITERAL || b.type !== values.NUMBER_LITERAL) {
				throw new Error(`Tried multiplying ${values.toString(a)} and ${values.toString(b)}`);
			}
			return values.NumberLiteralValue(a.value * b.value);
		}
		case expressions.DIV: {
			const a = evaluateExpression(ctx, expression.a);
			const b = evaluateExpression(ctx, expression.b);
			if (a.type !== values.NUMBER_LITERAL || b.type !== values.NUMBER_LITERAL) {
				throw new Error(`Tried dividing ${values.toString(a)} and ${values.toString(b)}`);
			}
			return values.NumberLiteralValue(a.value / b.value);
		}
		case expressions.MOD: {
			const a = evaluateExpression(ctx, expression.a);
			const b = evaluateExpression(ctx, expression.b);
			if (a.type !== values.NUMBER_LITERAL || b.type !== values.NUMBER_LITERAL) {
				throw new Error(`Tried modulo division with ${values.toString(a)} and ${values.toString(b)}`);
			}
			return values.NumberLiteralValue(a.value % b.value);
		}
		case expressions.EQUAL: {
			const a = evaluateExpression(ctx, expression.a);
			const b = evaluateExpression(ctx, expression.b);
			return values.equals(a, b) ? values.TrueValue : values.FalseValue;
		}
		case expressions.NOT_EQUAL: {
			const a = evaluateExpression(ctx, expression.a);
			const b = evaluateExpression(ctx, expression.b);
			return values.equals(a, b) ? values.FalseValue : values.TrueValue;
		}
		case expressions.GREATER: {
			const a = evaluateExpression(ctx, expression.a);
			const b = evaluateExpression(ctx, expression.b);
			if (a.type !== values.NUMBER_LITERAL || b.type !== values.NUMBER_LITERAL) {
				throw new Error(`Tried comparing ${values.toString(a)} and ${values.toString(b)}`);
			}
			return a > b ? values.TrueValue : values.FalseValue;
		}
		case expressions.GREATER_OR_EQUAL: {
			const a = evaluateExpression(ctx, expression.a);
			const b = evaluateExpression(ctx, expression.b);
			if (a.type !== values.NUMBER_LITERAL || b.type !== values.NUMBER_LITERAL) {
				throw new Error(`Tried comparing ${values.toString(a)} and ${values.toString(b)}`);
			}
			return a >= b ? values.TrueValue : values.FalseValue;
		}
		case expressions.LESS: {
			const a = evaluateExpression(ctx, expression.a);
			const b = evaluateExpression(ctx, expression.b);
			if (a.type !== values.NUMBER_LITERAL || b.type !== values.NUMBER_LITERAL) {
				throw new Error(`Tried comparing ${values.toString(a)} and ${values.toString(b)}`);
			}
			return a < b ? values.TrueValue : values.FalseValue;
		}
		case expressions.LESS_OR_EQUAL: {
			const a = evaluateExpression(ctx, expression.a);
			const b = evaluateExpression(ctx, expression.b);
			if (a.type !== values.NUMBER_LITERAL || b.type !== values.NUMBER_LITERAL) {
				throw new Error(`Tried comparing ${values.toString(a)} and ${values.toString(b)}`);
			}
			return a <= b ? values.TrueValue : values.FalseValue;
		}
		case expressions.AND: {
			const a = evaluateExpression(ctx, expression.a);
			const b = evaluateExpression(ctx, expression.b);
			if (
				a.type !== values.FALSE && a.type !== values.TRUE
				|| b.type !== values.FALSE && b.type !== values.TRUE
			) {
				throw new Error(`Tried logical and with ${values.toString(a)} and ${values.toString(b)}`);
			}
			return a.type === values.TRUE && b.type === values.TRUE ? values.TrueValue : values.FalseValue;
		}
		case expressions.OR: {
			const a = evaluateExpression(ctx, expression.a);
			const b = evaluateExpression(ctx, expression.b);
			if (
				a.type !== values.FALSE && a.type !== values.TRUE
				|| b.type !== values.FALSE && b.type !== values.TRUE
			) {
				throw new Error(`Tried logical or with ${values.toString(a)} and ${values.toString(b)}`);
			}
			return a.type === values.TRUE || b.type === values.TRUE ? values.TrueValue : values.FalseValue;
		}
		case expressions.NOT: {
			const op = evaluateExpression(ctx, expression.op);
			if (op.type !== values.FALSE && op.type !== values.TRUE) {
				throw new Error(`Tried logical not with ${values.toString(op)}`);
			}
			return op.type === values.TRUE ? values.FalseValue : values.TrueValue;
		}
		case expressions.NEGATE: {
			const op = evaluateExpression(ctx, expression.op);
			if (op.type !== values.NUMBER_LITERAL) {
				throw new Error(`Tried negating ${values.toString(op)}`);
			}
			return values.NumberLiteralValue(-op.value);
		}
		case expressions.ARRAY_LENGTH: {
			const op = evaluateExpression(ctx, expression.op);
			if (op.type !== values.TUPLE) {
				throw new Error(`Tried getting length of non-tuple ${values.toString(op)}`);
			}
			return values.NumberLiteralValue(op.value.length);
		}
		case expressions.DELITERALIZE: {
			const op = evaluateExpression(ctx, expression.op);
			return values.deliteralize(op);
		}
		case expressions.UNION: {
			const a = evaluateExpression(ctx, expression.a);
			const b = evaluateExpression(ctx, expression.b);
			return values.union(a, b);
		}
		case expressions.INTERSECT: {
			const a = evaluateExpression(ctx, expression.a);
			const b = evaluateExpression(ctx, expression.b);
			const i = values.intersection(a, b);
			if (i === undefined) {
				throw new Error(`Intersecting ${values.toString(a)} and ${values.toString(b)} results in an impossible value`);
			}
			return i;
		}
		case expressions.EXTENDS: {
			const a = evaluateExpression(ctx, expression.a);
			const b = evaluateExpression(ctx, expression.b);
			return values.assignableTo(a, b) ? values.TrueValue : values.FalseValue;
		}
		case expressions.LITERAL: return expression.value;
		case expressions.TYPED_ARRAY: {
			const elementType = evaluateExpression(ctx, expression.elementType);
			return values.TypedArrayValue(elementType);
		}
		case expressions.TUPLE: {
			const value = expression.value.map(e => evaluateExpression(ctx, e));
			return values.TupleValue(value);
		}
		case expressions.OBJECT: {
			const value = Object.fromEntries(Object.entries(expression.value).map(([k, v]) => ([k, evaluateExpression(ctx, v)])));
			return values.ObjectValue(value);
		}
		case expressions.SIGNATURE: {
			const argumentTypes = expression.argumentTypes.map(e => evaluateExpression(ctx, e));
			const returnType = evaluateExpression(ctx, expression.returnType);
			return values.SignatureValue(argumentTypes, returnType);
		}
		case expressions.FUNCTION: {
			const args = expression.arguments.map(arg => ({ name: arg.name, type: evaluateExpression(ctx, arg.type) }));
			const returnType = evaluateExpression(ctx, expression.returnType);
			return values.FunctionValue(args, returnType, expression.body, ctx.scopeStack);
		}
		case expressions.IDENTIFIER: return getBindingValue(ctx, expression.name);
		case expressions.CALL: {
			const fn = evaluateExpression(ctx, expression.fn);
			const args = expression.arguments.map(arg => evaluateExpression(ctx, arg));
			if (fn.type !== values.FUNCTION) {
				throw new Error(`Cannot call ${values.toString(fn)}`);
			}
			if (fn.arguments.length !== args.length) {
				throw new Error(`Function ${values.toString(fn)} has ${fn.arguments} argument(s), but ${args.length} provided`);
			}

			const fnCtx: Context = {
				scopeStack: [...fn.scopeStack, {}],
				unwind: null,
			};

			for (let i = args.length; i < args.length; ++i) {
				const arg = args[i];
				const { name, type } = fn.arguments[i];
				if (!values.assignableTo(arg, type)) {
					throw new Error(`Argument ${values.toString(arg)} named ${name} is not assignable to ${values.toString(type)}`);
				}
				createBinding(fnCtx, name, {
					constant: false,
					declaredType: type,
					value: arg,
				});
			}

			runBlock(fnCtx, fn.body, true);

			if (fnCtx.unwind?.type === "return") {
				return fnCtx.unwind.value;
			} else if (fnCtx.unwind?.type !== undefined) {
				throw new Error(`No while loop found to ${fnCtx.unwind.type}`);
			}

			return values.NilValue;
		}
		case expressions.INDEXING: {
			const lhs = evaluateExpression(ctx, expression.a);
			const index = evaluateExpression(ctx, expression.b);
			if (lhs.type === values.OBJECT && index.type === values.STRING_LITERAL) {
				if (index.value in lhs.value) {
					return lhs.value[index.value];
				} else {
					return values.NilValue;
				}
			}
			if (lhs.type === values.TUPLE && index.type === values.NUMBER_LITERAL) {
				if (index.value in lhs.value) {
					return lhs.value[index.value];
				} else {
					return values.NilValue;
				}
			}
			throw new Error(`Cannot index ${values.toString(lhs)} with ${values.toString(index)}`);
		}
		case expressions.DECLTYPE: {
			const binding = getBinding(ctx, expression.name);
			return binding.declaredType;
		}
	}
}

function createBinding(ctx: Context, name: string, binding: Binding) {
	for (const scope of ctx.scopeStack) {
		if (name in scope) {
			throw new Error(`Binding ${name} shadows an already existing binding`);
		}
	}
	ctx.scopeStack[ctx.scopeStack.length - 1][name] = binding;
}

function getBinding(ctx: Context, name: string): Binding {
	for (let i = ctx.scopeStack.length - 1; i >= 0; --i) {
		const scope = ctx.scopeStack[i];
		if (name in scope) {
			return scope[name];
		}
	}
	throw new Error(`Binding ${name} does not exist`);
}

function getBindingValue(ctx: Context, name: string): values.Value {
	const binding = getBinding(ctx, name);
	return binding.value;
}

function evaluateLValue(ctx: Context, expression: expressions.Expression): LValueRef {
	const path: (string | number)[] = [];

	while (true) {
		switch (expression.type) {
			case expressions.IDENTIFIER: {
				const name = expression.name;
				const binding = getBinding(ctx, name);
				return { name, binding, path };
			}
			case expressions.INDEXING: {
				const index = evaluateExpression(ctx, expression.b);
				if (index.type !== values.STRING_LITERAL && index.type !== values.NUMBER_LITERAL) {
					throw new Error(`Cannot index with ${values.toString(index)}`);
				}
				path.unshift(index.value);
				expression = expression.a;
				break;
			}
			default:
				throw new Error("Only indexing and identifiers are supported for lvalues");
		}
	}
}

function assignPath(ctx: Context, ref: LValueRef, rvalue: values.Value) {
	let declType = ref.binding.declaredType;
	let lvalue = ref.binding.value;
	for (let i = 0; i < ref.path.length - 1; ++i) {
		const node = ref.path[i];
		switch (typeof node) {
			case "string": {
				if (lvalue.type !== values.OBJECT) {
					throw new Error(`Tried indexing non-object with string`);
				}
				if (declType.type !== values.OBJECT) {
					throw new Error("Indexed type is an object, but its declared type is not");
				}
				if (!(node in declType.value)) {
					throw new Error(`Index ${node} does not exist in declared type ${values.toString(declType)}`);
				}
				if (i === ref.path.length - 1) {
					lvalue.value[node] = rvalue;
				} else {
					declType = declType.value[node];
					lvalue = lvalue.value[node];
				}
				break;
			}
			case "number": {
				if (lvalue.type !== values.TUPLE) {
					throw new Error(`Tried indexing non-tuple with number`);
				}
				if (declType.type !== values.TUPLE && declType.type !== values.TYPED_ARRAY) {
					throw new Error("Indexed type is a tuple, but its declared type is not a tuple nor a typed array");
				}
				if (Number.isSafeInteger(node)) {
					throw new Error(`Invalid index ${node}`);
				}
				if (node < 0 || (declType.type === values.TUPLE && node >= declType.value.length)) {
					throw new Error(`Index ${node} is out of range for ${values.toString(declType)}`);
				}
				if (i === ref.path.length - 1) {
					declType = declType.type === values.TUPLE ? declType.value[node] : declType.elementType;
					lvalue = lvalue.value[node];
				} else {
					lvalue.value[node] = rvalue;
				}
				break;
			}
		}
	}
}
