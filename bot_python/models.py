import uuid
from datetime import datetime, timezone
import enum
from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.dialects.postgresql import ENUM as PG_ENUM

Base = declarative_base()

def get_utc_now():
    return datetime.now(timezone.utc)

class AccountStatus(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    SOLD = "SOLD"

class OrderStatus(str, enum.Enum):
    DELIVERED = "DELIVERED"
    CANCELLED = "CANCELLED"

class PaymentStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"

class TransactionType(str, enum.Enum):
    WELCOME_BONUS = "WELCOME_BONUS"
    DEPOSIT = "DEPOSIT"
    REFERRAL_REWARD = "REFERRAL_REWARD"
    PURCHASE = "PURCHASE"
    ADMIN_ADJUSTMENT = "ADMIN_ADJUSTMENT"
    REFUND = "REFUND"

AccountStatusEnum = PG_ENUM(
    "AVAILABLE", "SOLD",
    name="AccountStatus",
    create_type=False,
)

OrderStatusEnum = PG_ENUM(
    "DELIVERED", "CANCELLED",
    name="OrderStatus",
    create_type=False,
)

PaymentStatusEnum = PG_ENUM(
    "PENDING", "APPROVED", "REJECTED",
    name="PaymentStatus",
    create_type=False,
)

TransactionTypeEnum = PG_ENUM(
    "WELCOME_BONUS", "DEPOSIT", "REFERRAL_REWARD", "PURCHASE", "ADMIN_ADJUSTMENT", "REFUND",
    name="TransactionType",
    create_type=False,
)

class User(Base):
    __tablename__ = "User"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    telegramId = Column(String, unique=True, nullable=False, index=True)
    username = Column(String, nullable=True)
    firstName = Column(String, nullable=True)
    lastName = Column(String, nullable=True)
    balancePaise = Column(BigInteger, default=0, nullable=False)
    referralCode = Column(String, unique=True, nullable=False, index=True)
    referredById = Column(String, ForeignKey("User.id"), nullable=True)
    referralRewardGiven = Column(Boolean, default=False, nullable=False)
    isRestricted = Column(Boolean, default=False, nullable=False)
    welcomeBonusGiven = Column(Boolean, default=False, nullable=False)
    createdAt = Column(DateTime(timezone=True), default=get_utc_now, nullable=False)
    updatedAt = Column(DateTime(timezone=True), default=get_utc_now, onupdate=get_utc_now, nullable=False)

    # Relationships
    orders = relationship("Order", back_populates="user", cascade="all, delete-orphan")
    purchasedAccounts = relationship("Account", back_populates="soldToUser", foreign_keys="Account.soldToUserId")
    payments = relationship("Payment", back_populates="user", cascade="all, delete-orphan")
    walletTransactions = relationship("WalletTransaction", back_populates="user", cascade="all, delete-orphan")


class StockBatch(Base):
    __tablename__ = "StockBatch"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    batchNumber = Column(Integer, nullable=True, index=True)
    fileName = Column(String, nullable=False)
    totalAccounts = Column(Integer, default=10, nullable=False)
    createdAt = Column(DateTime(timezone=True), default=get_utc_now, nullable=False)

    accounts = relationship("Account", back_populates="batch", cascade="all, delete-orphan")


class Account(Base):
    __tablename__ = "Account"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    batchId = Column(String, ForeignKey("StockBatch.id", ondelete="CASCADE"), nullable=False)
    fullName = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    password = Column(String, nullable=False)
    createdOn = Column(String, nullable=False)
    status = Column(AccountStatusEnum, default="AVAILABLE", nullable=False, index=True)
    soldToUserId = Column(String, ForeignKey("User.id"), nullable=True, index=True)
    soldAt = Column(DateTime(timezone=True), nullable=True)
    createdAt = Column(DateTime(timezone=True), default=get_utc_now, nullable=False)

    batch = relationship("StockBatch", back_populates="accounts")
    soldToUser = relationship("User", back_populates="purchasedAccounts", foreign_keys=[soldToUserId])
    orderItems = relationship("OrderItem", back_populates="account")


class Order(Base):
    __tablename__ = "Order"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    orderNumber = Column(String, unique=True, nullable=False, index=True)
    userId = Column(String, ForeignKey("User.id", ondelete="CASCADE"), nullable=False, index=True)
    quantity = Column(Integer, nullable=False)
    totalAmountPaise = Column(BigInteger, nullable=False)
    status = Column(OrderStatusEnum, default="DELIVERED", nullable=False)
    createdAt = Column(DateTime(timezone=True), default=get_utc_now, nullable=False)

    user = relationship("User", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "OrderItem"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    orderId = Column(String, ForeignKey("Order.id", ondelete="CASCADE"), nullable=False, index=True)
    accountId = Column(String, ForeignKey("Account.id"), nullable=False, index=True)

    order = relationship("Order", back_populates="items")
    account = relationship("Account", back_populates="orderItems")


class Payment(Base):
    __tablename__ = "Payment"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    userId = Column(String, ForeignKey("User.id", ondelete="CASCADE"), nullable=False, index=True)
    amountPaise = Column(BigInteger, nullable=False)
    utr = Column(String, unique=True, nullable=True, index=True)
    screenshotFileId = Column(String, nullable=True)
    status = Column(PaymentStatusEnum, default="PENDING", nullable=False, index=True)
    reviewedBy = Column(String, nullable=True)
    reviewedAt = Column(DateTime(timezone=True), nullable=True)
    adminNote = Column(String, nullable=True)
    createdAt = Column(DateTime(timezone=True), default=get_utc_now, nullable=False)

    user = relationship("User", back_populates="payments")


class WalletTransaction(Base):
    __tablename__ = "WalletTransaction"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    userId = Column(String, ForeignKey("User.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(TransactionTypeEnum, nullable=False, index=True)
    amountPaise = Column(BigInteger, nullable=False)
    balanceBeforePaise = Column(BigInteger, nullable=False)
    balanceAfterPaise = Column(BigInteger, nullable=False)
    referenceId = Column(String, nullable=True)
    description = Column(String, nullable=False)
    createdAt = Column(DateTime(timezone=True), default=get_utc_now, nullable=False, index=True)

    user = relationship("User", back_populates="walletTransactions")


class Referral(Base):
    __tablename__ = "Referral"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    referrerId = Column(String, ForeignKey("User.id", ondelete="CASCADE"), nullable=False, index=True)
    referredUserId = Column(String, ForeignKey("User.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    rewardPaise = Column(BigInteger, default=200, nullable=False)
    status = Column(String, default="COMPLETED", nullable=False)
    createdAt = Column(DateTime(timezone=True), default=get_utc_now, nullable=False)


class AdminAction(Base):
    __tablename__ = "AdminAction"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    adminTelegramId = Column(String, nullable=False, index=True)
    action = Column(String, nullable=False, index=True)
    targetUserId = Column(String, nullable=True)
    action_metadata = Column("metadata", Text, nullable=True)
    createdAt = Column(DateTime(timezone=True), default=get_utc_now, nullable=False)


class SystemSetting(Base):
    __tablename__ = "SystemSetting"

    key = Column(String, primary_key=True)
    value = Column(String, nullable=False)
    description = Column(String, nullable=True)
    updatedAt = Column(DateTime(timezone=True), default=get_utc_now, onupdate=get_utc_now, nullable=False)
