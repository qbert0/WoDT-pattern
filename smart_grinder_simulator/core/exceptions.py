class SmartGrinderError(Exception):
    """Base exception for the smart grinder simulator."""


class ValidationError(SmartGrinderError):
    """Raised when incoming data is invalid."""


class DittoClientError(SmartGrinderError):
    """Raised when Ditto communication fails."""


class Neo4jModuleError(SmartGrinderError):
    """Raised when Neo4j access fails."""
