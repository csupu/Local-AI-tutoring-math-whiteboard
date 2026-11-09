"""Best-effort SymPy verification of simple linear equations found in the conversation."""

from __future__ import annotations

import re

try:
    import sympy as sp
except Exception:  # pragma: no cover - sympy is expected to be installed
    sp = None  # type: ignore[assignment]

# Matches e.g. "2x+3=11", "3y - 7 = 8", "-x + 4 = -2"
_LINEAR = re.compile(
    r"([+-]?\s*\d*\.?\d*)\s*([a-zA-Z])\s*([+-])\s*(\d*\.?\d+)\s*=\s*([+-]?\s*\d*\.?\d+)"
)


def verify_equation(text: str | None) -> str | None:
    """Solve the first recognizable linear equation in `text` with SymPy.

    Returns a short verification string, or None when nothing verifiable is found.
    Never raises: verification is strictly best-effort.
    """
    if sp is None or not text:
        return None
    match = _LINEAR.search(text)
    if not match:
        return None
    try:
        coefficient = match.group(1).replace(" ", "")
        a = sp.Rational(coefficient if coefficient not in ("", "+", "-") else coefficient + "1")
        var = match.group(2)
        sign = match.group(3)
        b = sp.Rational(match.group(4))
        rhs = sp.Rational(match.group(5).replace(" ", ""))
        if a == 0:
            return None
        symbol = sp.Symbol(var)
        lhs = a * symbol + (b if sign == "+" else -b)
        solution = sp.solve(sp.Eq(lhs, rhs), symbol)
        if not solution:
            return None
        value = solution[0]
        return (
            f"SymPy independently solves {lhs} = {rhs}: {var} = {value}. "
            "This checks the equation, not the AI explanation."
        )
    except Exception:
        return None
