"""Factory Boy factories for test data generation.

These factories are used as simple data builders (not bound to SQLAlchemy sessions)
to avoid sync/async session issues. Build instances with factory.build() and add
to the database manually.
"""

from datetime import datetime, timedelta

import factory
from faker import Faker

from app.models.organization import Organization
from app.models.refresh_token import RefreshToken
from app.models.user import User

fake = Faker()


class OrganizationFactory(factory.Factory):
    """Factory for Organization model."""

    class Meta:
        model = Organization

    name = factory.LazyFunction(lambda: fake.company())


class UserFactory(factory.Factory):
    """Factory for User model."""

    class Meta:
        model = User

    email = factory.LazyFunction(lambda: fake.email())
    full_name = factory.LazyFunction(lambda: fake.name())
    hashed_password = "hashed_password_placeholder"
    auth_provider = "email"
    email_verified = True
    is_active = True
    organization_id = None  # Must be set when creating


class RefreshTokenFactory(factory.Factory):
    """Factory for RefreshToken model."""

    class Meta:
        model = RefreshToken

    jti = factory.LazyFunction(lambda: fake.uuid4())
    user_id = None  # Must be set when creating
    expires_at = factory.LazyFunction(lambda: datetime.utcnow() + timedelta(days=7))
    revoked = False
