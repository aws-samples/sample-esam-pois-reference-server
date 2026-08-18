# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""Repository for ProcessStatusNotification acknowledgement records."""

import logging
import time
from dataclasses import dataclass

import boto3

logger = logging.getLogger(__name__)

# Default TTL: 7 days
DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60


@dataclass
class AckRecord:
    """Acknowledgement record from ProcessStatusNotification."""

    channel_id: str
    acquisition_point_identity: str
    acquisition_signal_id: str
    class_code: int
    detail_code: int
    note: str
    timestamp: str  # ISO 8601
    ttl: int  # epoch seconds for DynamoDB TTL


class AckRepository:
    """DynamoDB repository for PSN acknowledgement records."""

    def __init__(self, table_name: str):
        self._dynamodb = boto3.resource("dynamodb")
        self._table = self._dynamodb.Table(table_name)

    def store_ack(self, record: AckRecord) -> None:
        """
        Store an acknowledgement record.

        PK = channelId, SK = ACK#{timestamp}#{acquisitionSignalID}
        """
        sk = f"ACK#{record.timestamp}#{record.acquisition_signal_id}"

        item = {
            "channelId": record.channel_id,
            "SK": sk,
            "acquisitionPointIdentity": record.acquisition_point_identity,
            "acquisitionSignalID": record.acquisition_signal_id,
            "classCode": record.class_code,
            "detailCode": record.detail_code,
            "note": record.note,
            "timestamp": record.timestamp,
            "ttl": record.ttl,
            "recordType": "ack",
        }

        self._table.put_item(Item=item)
        logger.info(
            "Stored ack record",
            extra={
                "channelId": record.channel_id,
                "acquisitionSignalID": record.acquisition_signal_id,
                "classCode": record.class_code,
            },
        )


def create_ack_record(
    channel_id: str,
    acquisition_point_identity: str,
    acquisition_signal_id: str,
    class_code: int,
    detail_code: int,
    note: str,
    timestamp: str,
    ttl_seconds: int = DEFAULT_TTL_SECONDS,
) -> AckRecord:
    """Create an AckRecord with computed TTL."""
    ttl = int(time.time()) + ttl_seconds
    return AckRecord(
        channel_id=channel_id,
        acquisition_point_identity=acquisition_point_identity,
        acquisition_signal_id=acquisition_signal_id,
        class_code=class_code,
        detail_code=detail_code,
        note=note,
        timestamp=timestamp,
        ttl=ttl,
    )
