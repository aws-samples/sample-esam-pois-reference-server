# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""Channel and rule data models using Pydantic."""

from enum import Enum
from typing import List, Optional, Union, Any
from pydantic import BaseModel, Field, field_validator


class ConditionOperator(str, Enum):
    """Comparison operators for rule conditions."""

    EQ = "eq"
    NE = "ne"
    GT = "gt"
    LT = "lt"
    GTE = "gte"
    LTE = "lte"
    RANGE = "range"
    IN = "in"
    NOT_IN = "notIn"


class ConditionTarget(str, Enum):
    """Fields that can be used in rule conditions."""

    COMMAND_TYPE = "commandType"
    SEGMENTATION_TYPE_ID = "segmentationTypeId"
    DURATION = "duration"
    PTS_ADJUSTMENT = "ptsAdjustment"
    TIER = "tier"
    UPID_TYPE = "upidType"
    UPID_VALUE = "upidValue"
    EVENT_ID = "eventId"
    DESCRIPTOR_COUNT = "descriptorCount"
    OUT_OF_NETWORK = "outOfNetwork"
    ZONE_IDENTITY = "zoneIdentity"


class Condition(BaseModel):
    """Condition for rule matching."""

    target: ConditionTarget = Field(..., alias="field")
    operator: ConditionOperator
    value: Union[int, str, List[int], List[str]]

    class Config:
        populate_by_name = True
        use_enum_values = True


class ModificationTarget(str, Enum):
    """Fields that can be modified in SCTE-35 signals."""

    PTS_ADJUSTMENT = "ptsAdjustment"
    BREAK_DURATION = "breakDuration"
    SEGMENTATION_DURATION = "segmentationDuration"
    SEGMENTATION_TYPE_ID = "segmentationTypeId"
    WEB_DELIVERY_ALLOWED = "webDeliveryAllowed"
    NO_REGIONAL_BLACKOUT = "noRegionalBlackout"
    ARCHIVE_ALLOWED = "archiveAllowed"
    DEVICE_RESTRICTIONS = "deviceRestrictions"
    COMMAND_TYPE = "commandType"
    UPID_TYPE = "upidType"
    UPID_VALUE = "upidValue"
    ADD_DESCRIPTOR = "addDescriptor"
    REMOVE_DESCRIPTOR = "removeDescriptor"


class ModificationOperation(str, Enum):
    """Operations that can be performed on fields."""

    SET = "set"
    ADD = "add"
    REMOVE = "remove"
    INCREMENT = "increment"
    DECREMENT = "decrement"
    MULTIPLY = "multiply"


class Modification(BaseModel):
    """Modification to apply to SCTE-35 signal."""

    target: ModificationTarget
    operation: ModificationOperation
    value: Optional[Union[int, bool, str]] = None

    class Config:
        use_enum_values = True


class Rule(BaseModel):
    """Rule configuration for SCTE-35 signal processing."""

    rule_id: str = Field(..., alias="ruleId")
    name: str
    priority: int = 0
    enabled: bool = True
    conditions: List[Condition]
    action: str  # 'delete', 'noop', or 'replace'
    modifications: List[Modification] = Field(default_factory=list)
    external_actions: List[Any] = Field(default_factory=list, alias="externalActions")
    description: Optional[str] = None
    alt_content_identity: Optional[str] = Field(None, alias="altContentIdentity")
    alt_content_zone_identity: Optional[str] = Field(
        None, alias="altContentZoneIdentity"
    )

    @field_validator("action")
    @classmethod
    def validate_action(cls, v: str) -> str:
        """Validate action is one of the allowed values."""
        if v not in ["delete", "noop", "replace"]:
            raise ValueError(
                f"Action must be 'delete', 'noop', or 'replace', got '{v}'"
            )
        return v

    @field_validator("conditions")
    @classmethod
    def validate_conditions(cls, v: List[Condition]) -> List[Condition]:
        """Validate that at least one condition exists."""
        if not v:
            raise ValueError("Rule must have at least one condition")
        return v

    class Config:
        populate_by_name = True
        # Ensure all fields are serialized, including empty lists
        exclude_none = False


class AuthConfig(BaseModel):
    """Authentication configuration for ESAM endpoint Basic Auth."""

    auth_enabled: bool = Field(False, alias="authEnabled")
    username: Optional[str] = None
    ssm_parameter_path: Optional[str] = Field(None, alias="ssmParameterPath")

    class Config:
        populate_by_name = True


class Channel(BaseModel):
    """Channel configuration with SCTE-35 processing rules."""

    channel_id: str = Field(..., alias="channelId")
    name: str
    description: Optional[str] = None
    enabled: bool = True
    default_action: str = Field(..., alias="defaultAction")
    stateful_mode: bool = Field(False, alias="statefulMode")
    descriptor_priority: Optional[str] = Field(None, alias="descriptorPriority")
    auto_add_descriptors: bool = Field(False, alias="autoAddDescriptors")
    esam_endpoint: Optional[str] = Field(None, alias="esamEndpoint")
    actions_dry_run: bool = Field(False, alias="actionsDryRun")
    actions_enabled: bool = Field(True, alias="actionsEnabled")
    auth_config: AuthConfig = Field(default_factory=AuthConfig, alias="authConfig")
    rules: List[Rule] = Field(default_factory=list)
    created_at: str = Field(..., alias="createdAt")
    updated_at: str = Field(..., alias="updatedAt")
    created_by: Optional[str] = Field(None, alias="createdBy")
    updated_by: Optional[str] = Field(None, alias="updatedBy")

    @field_validator("default_action")
    @classmethod
    def validate_default_action(cls, v: str) -> str:
        """Validate default action is one of the allowed values."""
        if v not in ["delete", "noop", "replace"]:
            raise ValueError(
                f"Default action must be 'delete', 'noop', or 'replace', got '{v}'"
            )
        return v

    @field_validator("channel_id")
    @classmethod
    def validate_channel_id(cls, v: str) -> str:
        """Validate channel ID is non-empty."""
        if not v or not v.strip():
            raise ValueError("Channel ID must be a non-empty string")
        return v

    class Config:
        populate_by_name = True


class ChannelState(BaseModel):
    """Channel state for stateful mode processing."""

    channel_id: str = Field(..., alias="channelId")
    in_break: bool = Field(..., alias="inBreak")
    break_start_time: Optional[str] = Field(None, alias="breakStartTime")
    break_event_id: Optional[int] = Field(None, alias="breakEventId")
    break_expiry_time: Optional[int] = Field(None, alias="breakExpiryTime")
    last_processed_time: str = Field(..., alias="lastProcessedTime")

    class Config:
        populate_by_name = True


class ProcessingOptions(BaseModel):
    """Options for signal processing."""

    log_level: str = "INFO"
    include_debug_info: bool = False

    class Config:
        use_enum_values = True
