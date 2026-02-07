"""Unit tests for password hashing and verification."""

from app.auth.password import hash_password, verify_password


# Hash tests


def test_hash_password_returns_string():
    """Test hash_password returns a non-empty string."""
    password = "test"
    hashed = hash_password(password)

    assert isinstance(hashed, str)
    assert len(hashed) > 0


def test_hash_password_not_plaintext():
    """Test hash_password does not return plaintext password."""
    password = "mypassword"
    hashed = hash_password(password)

    assert hashed != password


def test_hash_password_different_hashes():
    """Test that hashing the same password twice produces different hashes (salt)."""
    password = "samepassword"
    hash1 = hash_password(password)
    hash2 = hash_password(password)

    # Argon2id uses random salt, so hashes should be different
    assert hash1 != hash2


# Verify tests


def test_verify_correct_password():
    """Test verifying correct password returns True."""
    password = "correct_password"
    hashed = hash_password(password)

    result = verify_password(password, hashed)

    assert result is True


def test_verify_wrong_password():
    """Test verifying wrong password returns False."""
    correct_password = "correct_password"
    wrong_password = "wrong_password"
    hashed = hash_password(correct_password)

    result = verify_password(wrong_password, hashed)

    assert result is False


def test_verify_none_hashed_password():
    """Test verifying password with None hashed_password returns False (OAuth users)."""
    password = "anything"

    result = verify_password(password, None)

    assert result is False
