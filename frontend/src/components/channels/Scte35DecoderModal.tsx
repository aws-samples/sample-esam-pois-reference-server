// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { useState, useEffect } from 'react';
import { X, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { decodeScte35, Scte35Decoded } from '../../utils/scte35-decoder';
import Button from '../common/Button';
import Badge from '../common/Badge';

interface Scte35DecoderModalProps {
  isOpen: boolean;
  onClose: () => void;
  xml: string;
  type: 'SPE' | 'SPN';
}

interface Scte35Data {
  binaryData?: string;
  decoded?: Scte35Decoded;
  error?: string;
}

/** Returns true if value is defined, not null, and not empty string */
function hasValue(value: unknown): boolean {
  if (value === undefined || value === null || value === '' || value === 'N/A') return false;
  if (typeof value === 'number' && value === 0) return false;
  if (typeof value === 'string' && value === '0') return false;
  return true;
}

export default function Scte35DecoderModal({ isOpen, onClose, xml, type }: Scte35DecoderModalProps) {
  const [scte35Data, setScte35Data] = useState<Scte35Data>({});
  const [rawExpanded, setRawExpanded] = useState(false);
  const [infoExpanded, setInfoExpanded] = useState(false);
  const [jsonExpanded, setJsonExpanded] = useState(false);

  useEffect(() => {
    if (isOpen && xml) {
      decodeScte35Data();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- decodeScte35Data is stable per (isOpen, xml)
  }, [isOpen, xml]);

  const decodeScte35Data = () => {
    try {
      const binaryDataMatch = xml.match(/<sig:BinaryData[^>]*>([^<]+)<\/sig:BinaryData>/);

      if (!binaryDataMatch) {
        setScte35Data({ error: 'No SCTE-35 binary data found in XML' });
          return;
      }

      const binaryData = binaryDataMatch[1];
      const decoded = decodeScte35(binaryData);

      setScte35Data({ binaryData, decoded });
    } catch (error) {
      setScte35Data({
        error: `Failed to decode SCTE-35 data: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  };

  const extractXmlField = (fieldName: string): string | null => {
    const regex = new RegExp(`${fieldName}="([^"]+)"`);
    const match = xml.match(regex);
    return match ? match[1] : null;
  };

  if (!isOpen) return null;

  const decoded = scte35Data.decoded;
  const hasMultipleDescriptors = decoded && decoded.descriptors.length > 1;

  // Extract XML metadata fields
  const acquisitionPoint = extractXmlField('acquisitionPointIdentity');
  const signalId = extractXmlField('acquisitionSignalID');
  const acquisitionTime = extractXmlField('acquisitionTime');
  const utcPoint = extractXmlField('utcPoint');
  const hasSignalInfo = hasValue(acquisitionPoint) || hasValue(signalId) || hasValue(acquisitionTime) || hasValue(utcPoint);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={onClose} />

        <div className="relative bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-slate-200">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">SCTE-35 Decoder</h3>
              <p className="text-sm text-slate-500 mt-0.5">
                {type === 'SPE' ? 'Signal Processing Event' : 'Signal Processing Notification'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {scte35Data.error ? (
              <div className="border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-900">Decode Error</p>
                  <p className="text-sm text-red-700 mt-1">{scte35Data.error}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Signal Info */}
                {hasSignalInfo && (
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm border-b border-slate-100 pb-3">
                    {hasValue(acquisitionPoint) && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500">Acquisition Point:</span>
                        <span className="font-mono text-slate-900">{acquisitionPoint}</span>
                      </div>
                    )}
                    {hasValue(signalId) && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500">Signal ID:</span>
                        <span className="font-mono text-slate-900 break-all">{signalId}</span>
                      </div>
                    )}
                    {hasValue(utcPoint) && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500">UTC:</span>
                        <span className="font-mono text-slate-900">{utcPoint}</span>
                      </div>
                    )}
                    {hasValue(acquisitionTime) && !hasValue(utcPoint) && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500">Time:</span>
                        <span className="font-mono text-slate-900">{acquisitionTime}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* CUE-OUT / CUE-IN Banner */}
                {decoded && decoded.command && decoded.command.out_of_network_indicator !== undefined && (
                  <div className={`ring-1 rounded-xl p-4 ${decoded.command.out_of_network_indicator ? 'ring-amber-300 bg-amber-50' : 'ring-green-300 bg-green-50'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`text-lg font-bold ${decoded.command.out_of_network_indicator ? 'text-amber-800' : 'text-green-800'}`}>
                          {decoded.command.out_of_network_indicator ? 'CUE-OUT' : 'CUE-IN'}
                        </span>
                        <Badge variant="info">
                          {decoded.info_section.splice_command_type_name}
                        </Badge>
                      </div>
                      {decoded.command.break_duration_seconds !== undefined && (
                        <span className="text-sm font-mono text-slate-700">
                          Break: {decoded.command.break_duration_seconds.toFixed(3)}s
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Command Summary */}
                {decoded && decoded.command && (
                  <div className="ring-1 ring-gray-200/60 rounded-xl shadow-sm p-4">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <Badge variant="info">
                        {decoded.info_section.splice_command_type_name}
                      </Badge>
                      {decoded.command.out_of_network_indicator === undefined && decoded.command.time_specified_flag !== undefined && (
                        <Badge variant="default">
                          time_specified: {decoded.command.time_specified_flag ? 'true' : 'false'}
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {decoded.command.break_duration_seconds !== undefined && (
                        <div>
                          <span className="text-xs text-slate-500">Break Duration</span>
                          <p className="text-sm font-mono font-semibold text-slate-900">
                            {decoded.command.break_duration_seconds.toFixed(3)}s
                          </p>
                          <p className="text-[10px] font-mono text-slate-400">
                            {typeof decoded.command.break_duration === 'number' ? decoded.command.break_duration : JSON.stringify(decoded.command.break_duration)} ticks
                          </p>
                        </div>
                      )}
                      {decoded.command.pts_time !== undefined && (
                        <div>
                          <span className="text-xs text-slate-500">PTS Time</span>
                          <p className="text-sm font-mono text-slate-900">
                            {decoded.command.pts_time_seconds?.toFixed(3)}s
                          </p>
                          <p className="text-[10px] font-mono text-slate-400">
                            {typeof decoded.command.pts_time === 'number' ? decoded.command.pts_time : JSON.stringify(decoded.command.pts_time)} ticks
                          </p>
                        </div>
                      )}
                      {decoded.command.splice_event_id !== undefined && (
                        <div>
                          <span className="text-xs text-slate-500">Splice Event ID</span>
                          <p className="text-sm font-mono text-slate-900">
                            {decoded.command.splice_event_id}
                          </p>
                        </div>
                      )}
                      {decoded.info_section.pts_adjustment !== undefined && decoded.info_section.pts_adjustment !== 0 && (
                        <div>
                          <span className="text-xs text-slate-500">PTS Adjustment</span>
                          <p className="text-sm font-mono text-slate-900">
                            {(decoded.info_section.pts_adjustment / 90000).toFixed(3)}s
                          </p>
                          <p className="text-[10px] font-mono text-slate-400">
                            {decoded.info_section.pts_adjustment} ticks
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Time Signal (no command fields) */}
                {decoded && !decoded.command && (
                  <div className="ring-1 ring-gray-200/60 rounded-xl shadow-sm p-4">
                    <Badge variant="info">
                      {decoded.info_section.splice_command_type_name}
                    </Badge>
                  </div>
                )}

                {/* Multiple Descriptors Note */}
                {hasMultipleDescriptors && (
                  <p className="text-xs text-slate-500 flex items-center gap-1.5">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />
                    {decoded!.descriptors.length} segmentation descriptors. First descriptor is used by default unless priority is configured.
                  </p>
                )}

                {/* Segmentation Descriptors */}
                {decoded && decoded.descriptors.length > 0 && (
                  <div className="space-y-2">
                    {decoded.descriptors.map((desc, idx) => (
                      <DescriptorCard key={idx} descriptor={desc} index={idx} total={decoded.descriptors.length} />
                    ))}
                  </div>
                )}

                {/* Info Section (collapsible) */}
                {decoded && (
                  <div className="ring-1 ring-gray-200/60 rounded-xl shadow-sm overflow-hidden">
                    <button
                      onClick={() => setInfoExpanded(!infoExpanded)}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      {infoExpanded ? (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      )}
                      Info Section
                    </button>
                    {infoExpanded && (
                      <div className="border-t border-slate-100 px-4 py-3">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          <div>
                            <span className="text-xs text-slate-500">table_id</span>
                            <p className="text-sm font-mono text-slate-900">
                              0x{decoded.info_section.table_id.toString(16).toUpperCase()}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs text-slate-500">tier</span>
                            <p className="text-sm font-mono text-slate-900">
                              0x{decoded.info_section.tier.toString(16).toUpperCase()}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs text-slate-500">protocol_version</span>
                            <p className="text-sm font-mono text-slate-900">
                              {decoded.info_section.protocol_version}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs text-slate-500">section_length</span>
                            <p className="text-sm font-mono text-slate-900">
                              {decoded.info_section.section_length}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs text-slate-500">splice_command_length</span>
                            <p className="text-sm font-mono text-slate-900">
                              {decoded.info_section.splice_command_length}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs text-slate-500">encrypted_packet</span>
                            <p className="text-sm font-mono text-slate-900">
                              {decoded.info_section.encrypted_packet ? 'true' : 'false'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Raw Base64 Data */}
                {scte35Data.binaryData && (
                  <div className="ring-1 ring-gray-200/60 rounded-xl shadow-sm overflow-hidden">
                    <button
                      onClick={() => setRawExpanded(!rawExpanded)}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      {rawExpanded ? (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      )}
                      Raw Base64 Data
                    </button>
                    {rawExpanded && (
                      <div className="border-t border-slate-200 bg-slate-50 p-4">
                        <pre className="text-xs font-mono text-slate-700 whitespace-pre-wrap break-all">
                          {scte35Data.binaryData}
                        </pre>
                      </div>
                    )}
                  </div>
                )}

                {/* JSON (collapsible) */}
                {decoded && (
                  <div className="ring-1 ring-gray-200/60 rounded-xl shadow-sm overflow-hidden">
                    <button
                      onClick={() => setJsonExpanded(!jsonExpanded)}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      {jsonExpanded ? (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      )}
                      JSON
                    </button>
                    {jsonExpanded && (
                      <div className="border-t border-slate-200 bg-slate-50 p-4">
                        <pre className="text-xs font-mono text-slate-700 whitespace-pre-wrap break-all max-h-80 overflow-y-auto">
                          {JSON.stringify(decoded, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end px-5 py-3 border-t border-slate-200">
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Compact card for a single segmentation descriptor */
function DescriptorCard({
  descriptor: desc,
  index,
  total,
}: {
  descriptor: Scte35Decoded['descriptors'][number];
  index: number;
  total: number;
}) {
  const [expanded, setExpanded] = useState(index === 0);
  const showDeliveryFlags = desc.delivery_not_restricted_flag === false;

  return (
    <div className="ring-1 ring-gray-200/60 rounded-xl shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-400" />
          )}
          {total > 1 && (
            <span className="text-xs font-mono text-slate-400">#{index + 1}</span>
          )}
          <span className="text-sm font-medium text-slate-900">
            {desc.tag === 0x02
              ? (desc.segmentation_type_name && desc.segmentation_type_name !== 'Not Indicated' && desc.segmentation_type_name !== 'Unknown'
                  ? desc.segmentation_type_name
                  : `Segmentation Descriptor (0x${(desc.segmentation_type_id ?? 0).toString(16).toUpperCase().padStart(2, '0')})`)
              : desc.tag === 0x01
                ? 'DTMF Descriptor'
                : desc.tag === 0x00
                  ? 'Avail Descriptor'
                  : `Descriptor (Tag 0x${desc.tag.toString(16).toUpperCase().padStart(2, '0')})`
            }
          </span>
        </div>
        <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
          {desc.tag === 0x02 && desc.segmentation_type_id !== undefined
            ? `0x${desc.segmentation_type_id.toString(16).toUpperCase()}`
            : `tag: 0x${desc.tag.toString(16).toUpperCase().padStart(2, '0')}`
          }
        </span>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-4 py-3">
          {desc.tag !== 0x02 ? (
            // Non-segmentation descriptor
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-xs text-slate-500">Tag</span>
                <p className="text-sm font-mono text-slate-900">0x{desc.tag.toString(16).toUpperCase().padStart(2, '0')}</p>
              </div>
              <div>
                <span className="text-xs text-slate-500">Identifier</span>
                <p className="text-sm font-mono text-slate-900">{desc.identifier}</p>
              </div>
              <div>
                <span className="text-xs text-slate-500">Length</span>
                <p className="text-sm font-mono text-slate-900">{desc.descriptor_length} bytes</p>
              </div>
            </div>
          ) : (
            // Segmentation descriptor
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {hasValue(desc.segmentation_event_id) && (
              <div>
                <span className="text-xs text-slate-500">Event ID</span>
                <p className="text-sm font-mono text-slate-900">{desc.segmentation_event_id}</p>
              </div>
            )}
            {desc.segmentation_duration_seconds !== undefined && (
              <div>
                <span className="text-xs text-slate-500">Duration</span>
                <p className="text-sm font-mono text-slate-900">
                  {desc.segmentation_duration_seconds.toFixed(3)}s
                </p>
              </div>
            )}
            {desc.segment_num !== undefined && (
              <div>
                <span className="text-xs text-slate-500">Segment</span>
                <p className="text-sm font-mono text-slate-900">
                  {desc.segment_num} / {desc.segments_expected}
                </p>
              </div>
            )}
            {hasValue(desc.segmentation_upid) && (
              <div className="col-span-2 sm:col-span-3">
                <span className="text-xs text-slate-500">
                  UPID{hasValue(desc.segmentation_upid_type_name) ? ` (${desc.segmentation_upid_type_name})` : ''}
                </span>
                <p className="text-sm font-mono text-slate-900 break-all mt-0.5 bg-slate-50 px-2 py-1 rounded border border-slate-100">
                  {desc.segmentation_upid}
                </p>
              </div>
            )}
          </div>

          {/* Delivery flags only when restrictions exist */}
          {showDeliveryFlags && (
            <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-100">
              {desc.web_delivery_allowed_flag !== undefined && (
                <Badge variant={desc.web_delivery_allowed_flag ? 'success' : 'default'}>
                  Web: {desc.web_delivery_allowed_flag ? 'Allowed' : 'Restricted'}
                </Badge>
              )}
              {desc.no_regional_blackout_flag !== undefined && (
                <Badge variant={desc.no_regional_blackout_flag ? 'success' : 'default'}>
                  Blackout: {desc.no_regional_blackout_flag ? 'None' : 'Regional'}
                </Badge>
              )}
              {desc.archive_allowed_flag !== undefined && (
                <Badge variant={desc.archive_allowed_flag ? 'success' : 'default'}>
                  Archive: {desc.archive_allowed_flag ? 'Allowed' : 'Restricted'}
                </Badge>
              )}
            </div>
          )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
