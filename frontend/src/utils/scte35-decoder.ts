// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * SCTE-35 Decoder Utility
 * Uses scte35 library from Comcast for robust parsing
 */

import { SCTE35 } from 'scte35';

export interface Scte35Decoded {
  info_section: {
    table_id: number;
    section_syntax_indicator: boolean;
    private_indicator: boolean;
    section_length: number;
    protocol_version: number;
    encrypted_packet: boolean;
    encryption_algorithm: number;
    pts_adjustment: number;
    cw_index: number;
    tier: number;
    splice_command_length: number;
    splice_command_type: number;
    splice_command_type_name: string;
  };
  command?: {
    splice_event_id?: number;
    splice_event_cancel_indicator?: boolean;
    out_of_network_indicator?: boolean;
    program_splice_flag?: boolean;
    duration_flag?: boolean;
    splice_immediate_flag?: boolean;
    time_specified_flag?: boolean;
    pts_time?: number;
    pts_time_seconds?: number;
    break_duration?: number;
    break_duration_seconds?: number;
    break_auto_return?: boolean;
    unique_program_id?: number;
    avail_num?: number;
    avail_expected?: number;
  };
  descriptors: Array<{
    tag: number;
    descriptor_length: number;
    identifier: string;
    segmentation_event_id?: string;
    segmentation_event_cancel_indicator?: boolean;
    program_segmentation_flag?: boolean;
    segmentation_duration_flag?: boolean;
    delivery_not_restricted_flag?: boolean;
    web_delivery_allowed_flag?: boolean;
    no_regional_blackout_flag?: boolean;
    archive_allowed_flag?: boolean;
    device_restrictions?: number;
    segmentation_upid_type?: number;
    segmentation_upid_type_name?: string;
    segmentation_upid_length?: number;
    segmentation_upid?: string;
    segmentation_type_id?: number;
    segmentation_type_name?: string;
    segment_num?: number;
    segments_expected?: number;
    sub_segment_num?: number;
    sub_segments_expected?: number;
    segmentation_duration?: number;
    segmentation_duration_seconds?: number;
  }>;
}

const SPLICE_COMMAND_TYPES: Record<number, string> = {
  0x00: 'splice_null',
  0x04: 'splice_schedule',
  0x05: 'splice_insert',
  0x06: 'time_signal',
  0x07: 'bandwidth_reservation',
  0xff: 'private_command',
};

const SEGMENTATION_TYPE_IDS: Record<number, string> = {
  0x00: 'Not Indicated',
  0x01: 'Content Identification',
  0x10: 'Program Start',
  0x11: 'Program End',
  0x12: 'Program Early Termination',
  0x13: 'Program Breakaway',
  0x14: 'Program Resumption',
  0x15: 'Program Runover Planned',
  0x16: 'Program Runover Unplanned',
  0x17: 'Program Overlap Start',
  0x18: 'Program Blackout Override',
  0x19: 'Program Start – In Progress',
  0x20: 'Chapter Start',
  0x21: 'Chapter End',
  0x22: 'Break Start',
  0x23: 'Break End',
  0x24: 'Opening Credit Start',
  0x25: 'Opening Credit End',
  0x26: 'Closing Credit Start',
  0x27: 'Closing Credit End',
  0x30: 'Provider Advertisement Start',
  0x31: 'Provider Advertisement End',
  0x32: 'Distributor Advertisement Start',
  0x33: 'Distributor Advertisement End',
  0x34: 'Provider Placement Opportunity Start',
  0x35: 'Provider Placement Opportunity End',
  0x36: 'Distributor Placement Opportunity Start',
  0x37: 'Distributor Placement Opportunity End',
  0x38: 'Provider Overlay Placement Opportunity Start',
  0x39: 'Provider Overlay Placement Opportunity End',
  0x3A: 'Distributor Overlay Placement Opportunity Start',
  0x3B: 'Distributor Overlay Placement Opportunity End',
  0x40: 'Unscheduled Event Start',
  0x41: 'Unscheduled Event End',
  0x50: 'Network Start',
  0x51: 'Network End',
};

const UPID_TYPES: Record<number, string> = {
  0x00: 'Not Used',
  0x01: 'User Defined',
  0x02: 'ISCI',
  0x03: 'Ad-ID',
  0x04: 'UMID',
  0x05: 'ISAN',
  0x06: 'ISAN (V-ISAN)',
  0x07: 'TID',
  0x08: 'TI',
  0x09: 'ADI',
  0x0A: 'EIDR',
  0x0B: 'ATSC Content Identifier',
  0x0C: 'MPU()',
  0x0D: 'MID()',
  0x0E: 'ADS Information',
  0x0F: 'URI',
};

export function decodeScte35(base64Data: string): Scte35Decoded {
  try {
    // Use Comcast scte35 library for parsing.
    // The library's TypeScript typings do not accurately model the parsed
    // runtime shape (e.g. `sectionSyntaxIndicator` is misspelled in the .d.ts
    // and command-specific fields are missing from the SpliceCommand union),
    // so the result is treated as an untyped record and mapped defensively.
    const parser = new SCTE35();
    const parsed = parser.parseFromB64(base64Data) as any;
    
    // Map to our interface format
    const result: Scte35Decoded = {
      info_section: {
        table_id: parsed.tableId || 0xFC,
        section_syntax_indicator: parsed.sectionSyntaxIndicator || false,
        private_indicator: parsed.privateIndicator || false,
        section_length: parsed.sectionLength || 0,
        protocol_version: parsed.protocolVersion || 0,
        encrypted_packet: parsed.encryptedPacket || false,
        encryption_algorithm: parsed.encryptionAlgorithm || 0,
        pts_adjustment: parsed.ptsAdjustment || 0,
        cw_index: parsed.cwIndex || 0,
        tier: parsed.tier || 0xFFF,
        splice_command_length: parsed.spliceCommandLength || 0,
        splice_command_type: parsed.spliceCommandType || 0,
        splice_command_type_name: SPLICE_COMMAND_TYPES[parsed.spliceCommandType || 0] || 'unknown',
      },
      descriptors: [],
    };

    // Parse command
    if (parsed.spliceCommandType === 6 && parsed.spliceCommand) {
      // time_signal format: spliceCommand is {specified: true, pts: number}
      const ptsTime = parsed.spliceCommand.pts;
      result.command = {
        pts_time: ptsTime,
        pts_time_seconds: ptsTime ? ptsTime / 90000 : undefined,
        time_specified_flag: parsed.spliceCommand.specified,
      };
    } else if (parsed.spliceCommand) {
      // splice_insert format
      const ptsTime = parsed.spliceCommand.ptsTime || parsed.spliceCommand.spliceTime?.pts;
      const breakDur = parsed.spliceCommand.breakDuration;
      const breakDurationTicks = typeof breakDur === 'object' && breakDur !== null ? breakDur.duration : breakDur;
      result.command = {
        splice_event_id: parsed.spliceCommand.spliceEventId,
        splice_event_cancel_indicator: parsed.spliceCommand.spliceEventCancelIndicator,
        out_of_network_indicator: parsed.spliceCommand.outOfNetworkIndicator,
        program_splice_flag: parsed.spliceCommand.programSpliceFlag,
        duration_flag: parsed.spliceCommand.durationFlag,
        splice_immediate_flag: parsed.spliceCommand.spliceImmediateFlag,
        time_specified_flag: parsed.spliceCommand.timeSpecifiedFlag,
        pts_time: ptsTime,
        pts_time_seconds: ptsTime ? ptsTime / 90000 : undefined,
        break_duration: breakDurationTicks,
        break_duration_seconds: breakDurationTicks ? breakDurationTicks / 90000 : undefined,
        break_auto_return: typeof breakDur === 'object' && breakDur !== null ? breakDur.autoReturn : parsed.spliceCommand.autoReturn,
        unique_program_id: parsed.spliceCommand.uniqueProgramId,
        avail_num: parsed.spliceCommand.availNum,
        avail_expected: parsed.spliceCommand.availsExpected,
      };
    }

    // Parse descriptors
    if (parsed.descriptors && Array.isArray(parsed.descriptors)) {
      result.descriptors = parsed.descriptors.map((desc: any) => ({
        tag: desc.spliceDescriptorTag || 0x02,
        descriptor_length: desc.descriptorLength || 0,
        identifier: desc.identifier || 'CUEI',
        segmentation_event_id: desc.segmentationEventId?.toString(16).toUpperCase(),
        segmentation_event_cancel_indicator: desc.segmentationEventCancelIndicator,
        program_segmentation_flag: desc.programSegmentationFlag,
        segmentation_duration_flag: desc.segmentationDurationFlag,
        delivery_not_restricted_flag: desc.deliveryNotRestrictedFlag,
        web_delivery_allowed_flag: desc.webDeliveryAllowedFlag,
        no_regional_blackout_flag: desc.noRegionalBlackoutFlag,
        archive_allowed_flag: desc.archiveAllowedFlag,
        device_restrictions: desc.deviceRestrictions,
        segmentation_upid_type: desc.segmentationUpidType,
        segmentation_upid_type_name: UPID_TYPES[desc.segmentationUpidType || 0] || 'Unknown',
        segmentation_upid_length: desc.segmentationUpidLength,
        segmentation_upid: typeof desc.segmentationUpid === 'object' && desc.segmentationUpid !== null
          ? Object.values(desc.segmentationUpid).map((b: any) => String.fromCharCode(b)).join('')
          : desc.segmentationUpid,
        segmentation_type_id: desc.segmentationTypeId,
        segmentation_type_name: SEGMENTATION_TYPE_IDS[desc.segmentationTypeId || 0] || 'Unknown',
        segment_num: desc.segmentNum,
        segments_expected: desc.segmentsExpected,
        sub_segment_num: desc.subSegmentNum,
        sub_segments_expected: desc.subSegmentsExpected,
        segmentation_duration: desc.segmentationDuration,
        segmentation_duration_seconds: desc.segmentationDuration ? desc.segmentationDuration / 90000 : undefined,
      }));
    }

    return result;
  } catch (error) {
    console.error('SCTE-35 decode error:', error);
    throw new Error(`Failed to decode SCTE-35: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
