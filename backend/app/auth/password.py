"""Password hashing utilities using pwdlib with Argon2id."""

from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher

# Initialize password hasher with Argon2id (secure, memory-hard algorithm)
password_hash = PasswordHash((Argon2Hasher(),))


def hash_password(password: str) -> str:
    """
    Hash a plain password using Argon2id.

    Args:
        password: Plain text password to hash

    Returns:
        Hashed password string safe for database storage
    """
    return password_hash.hash(password)


def verify_password(plain_password: str, hashed_password: str | None) -> bool:
    """
    Verify a plain password against a hashed password.

    Args:
        plain_password: Plain text password from user input
        hashed_password: Hashed password from database (may be None for OAuth users)

    Returns:
        True if password matches, False otherwise

    Note:
        Returns False if hashed_password is None (OAuth users without password)
    """
    if hashed_password is None:
        return False
    return password_hash.verify(plain_password, hashed_password)
