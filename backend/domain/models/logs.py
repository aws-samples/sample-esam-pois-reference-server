# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""Log event models for CloudWatch Logs."""

from typing import Optional
from pydantic import BaseModel, Field


class LogEvent(BaseModel):
    """Log event from CloudWatch Logs."""

    timestamp: str
    level: str
    message: str
    channel_id: Optional[str] = Field(None, alias="channelId")
    command_type: Optional[int] = Field(None, alias="commandType")
    action: Optional[str] = None
    rule_id: Optional[str] = Field(None, alias="ruleId")
    processing_time_ms: Optional[float] = Field(None, alias="processingTimeMs")
    correlation_id: Optional[str] = Field(None, alias="correlationId")
    xml: Optional[str] = None
    scte35_binary: Optional[str] = Field(None, alias="scte35Binary")
    error: Optional[str] = None
    # External actions fields
    actions_count: Optional[int] = Field(None, alias="actionsCount")
    actions_succeeded: Optional[int] = Field(None, alias="actionsSucceeded")
    actions_failed: Optional[int] = Field(None, alias="actionsFailed")
    dry_run: Optional[bool] = Field(None, alias="dryRun")
    # Rule evaluation fields
    matched: Optional[bool] = None
    matched_rule_id: Optional[str] = Field(None, alias="matchedRuleId")
    channel_name: Optional[str] = Field(None, alias="channelName")
    details: Optional[str] = None
    # Unified audit logging fields
    source: Optional[str] = None
    performed_by: Optional[str] = Field(None, alias="performedBy")
    target_id: Optional[str] = Field(None, alias="targetId")
    target_type: Optional[str] = Field(None, alias="targetType")
    request_data: Optional[dict] = Field(None, alias="requestData")

    class Config:
        populate_by_name = True
