"""Small, fail-closed interpreter for allocation expressions (never eval)."""
import ast
import io
import operator
import tokenize

UNKNOWN = object()
OPS = {ast.Eq: operator.eq, ast.NotEq: operator.ne, ast.Lt: operator.lt,
       ast.LtE: operator.le, ast.Gt: operator.gt, ast.GtE: operator.ge,
       ast.In: lambda a, b: a in b, ast.NotIn: lambda a, b: a not in b}
WORDS = {"AND": "and", "OR": "or", "NOT": "not", "IN": "in",
         "true": "True", "false": "False", "null": "None"}


def evaluate(expression, context):
    """True/False/UNKNOWN; missing is distinct from an explicit null."""
    def visit(n):
        if isinstance(n, ast.Constant):
            return n.value
        if isinstance(n, ast.Name):
            return context.get(n.id, UNKNOWN)
        if isinstance(n, ast.Attribute):
            value = visit(n.value)
            return value.get(n.attr, UNKNOWN) if isinstance(value, dict) and not n.attr.startswith('_') else UNKNOWN
        if isinstance(n, ast.List):
            values = [visit(e) for e in n.elts]
            return UNKNOWN if any(v is UNKNOWN for v in values) else values
        if isinstance(n, ast.BoolOp):
            values = [visit(v) for v in n.values]
            if isinstance(n.op, ast.And):
                if any(v is False for v in values): return False
                return True if all(v is True for v in values) else UNKNOWN
            if isinstance(n.op, ast.Or):
                if any(v is True for v in values): return True
                return False if all(v is False for v in values) else UNKNOWN
        if isinstance(n, ast.UnaryOp) and isinstance(n.op, ast.Not):
            value = visit(n.operand)
            return not value if type(value) is bool else UNKNOWN
        if isinstance(n, ast.Compare):
            left = visit(n.left)
            for op, right_node in zip(n.ops, n.comparators):
                right = visit(right_node)
                if left is UNKNOWN or right is UNKNOWN or type(op) not in OPS: return UNKNOWN
                if not OPS[type(op)](left, right): return False
                left = right
            return True
        return UNKNOWN
    try:
        tokens = [(t.type, WORDS.get(t.string, t.string) if t.type == tokenize.NAME else t.string)
                  for t in tokenize.generate_tokens(io.StringIO(expression).readline)]
        tree = ast.parse(tokenize.untokenize(tokens), mode='eval')
        # Reject unsupported syntax even in a branch that would short-circuit.
        allowed = (ast.Expression, ast.Constant, ast.Name, ast.Load, ast.Attribute, ast.List,
                   ast.BoolOp, ast.And, ast.Or, ast.UnaryOp, ast.Not, ast.Compare, *OPS)
        if any(not isinstance(n, allowed) for n in ast.walk(tree)): return UNKNOWN
        return visit(tree.body)
    except (SyntaxError, TypeError, ValueError, tokenize.TokenError):
        return UNKNOWN
