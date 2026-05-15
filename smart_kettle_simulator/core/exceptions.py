class SmartKettleError(Exception):
    """Base exception for the smart kettle simulator."""


class ValidationError(SmartKettleError):
    """Raised when incoming data is invalid."""


class DittoClientError(SmartKettleError):
    """Raised when Ditto communication fails."""


class Neo4jModuleError(SmartKettleError):
    """Raised when Neo4j access fails."""
