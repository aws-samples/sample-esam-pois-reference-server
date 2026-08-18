// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useGetChannelsQuery, useDeleteChannelMutation } from '../../store/api/channelsApi';
import { useAppSelector } from '../../store';
import { Radio, Eye, Edit, Trash2, Plus } from 'lucide-react';
import ConfirmModal from '../common/ConfirmModal';
import Button from '../common/Button';
import IconButton from '../common/IconButton';
import Badge from '../common/Badge';
import PageHeader from '../common/PageHeader';
import LoadingState from '../common/LoadingState';
import ErrorAlert from '../common/ErrorAlert';
import EmptyState from '../common/EmptyState';
import Pagination from '../common/Pagination';

export default function ChannelList() {
  const { data: channels, isLoading, error } = useGetChannelsQuery();
  const [deleteChannel, { isLoading: isDeleting }] = useDeleteChannelMutation();
  const { user } = useAppSelector((state) => state.auth);
  const isAdmin = user?.groups?.includes('admin');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    channelId: string;
    channelName: string;
  }>({
    isOpen: false,
    channelId: '',
    channelName: '',
  });

  const handleDeleteClick = (channelId: string, channelName: string) => {
    setDeleteModal({ isOpen: true, channelId, channelName });
  };

  const handleConfirmDelete = async () => {
    try {
      await deleteChannel(deleteModal.channelId).unwrap();
      setDeleteModal({ isOpen: false, channelId: '', channelName: '' });
    } catch (error) {
      console.error('Failed to delete channel:', error);
    }
  };

  if (isLoading) {
    return <LoadingState message="Loading channels..." />;
  }

  if (error) {
    return <ErrorAlert message={`Error loading channels: ${(error as Error).message}`} />;
  }

  const totalPages = Math.ceil((channels?.length || 0) / itemsPerPage);
  const paginatedChannels =
    channels?.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage) || [];

  return (
    <div>
      <PageHeader
        title="Channels"
        subtitle="Manage your SCTE-35 signal processing channels"
        action={
          isAdmin ? (
            <Link to="/channels/new">
              <Button variant="primary" size="md">
                <Plus className="h-4 w-4 mr-1.5" />
                New Channel
              </Button>
            </Link>
          ) : undefined
        }
      />

      {channels && channels.length === 0 ? (
        <EmptyState
          icon={<Radio className="h-10 w-10 text-slate-300" />}
          title="No channels configured"
          description="Create your first channel to start processing SCTE-35 signals"
          action={
            isAdmin ? (
              <Link to="/channels/new">
                <Button variant="primary" size="sm">
                  <Plus className="h-4 w-4 mr-1.5" />
                  Create Channel
                </Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-slate-100 bg-slate-50/50">
              <div className="col-span-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
                Channel
              </div>
              <div className="col-span-2 text-xs font-medium text-slate-500 uppercase tracking-wider text-center">
                Action
              </div>
              <div className="col-span-2 text-xs font-medium text-slate-500 uppercase tracking-wider text-center">
                Mode
              </div>
              <div className="col-span-1 text-xs font-medium text-slate-500 uppercase tracking-wider text-center">
                Rules
              </div>
              <div className="col-span-2 text-xs font-medium text-slate-500 uppercase tracking-wider text-center">
                Status
              </div>
              <div className="col-span-1" />
            </div>

            {/* Rows */}
            {paginatedChannels.map((channel) => (
              <div
                key={channel.channelId}
                className="grid grid-cols-12 gap-4 px-6 py-4 items-center border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50 transition-colors"
              >
                {/* Channel Name */}
                <div className="col-span-4">
                  <Link
                    to={`/channels/${channel.channelId}`}
                    className="text-sm font-medium text-slate-900 hover:text-indigo-600 transition-colors truncate block"
                  >
                    {channel.name}
                  </Link>
                  <span className="text-xs text-slate-400 truncate block mt-0.5">
                    {channel.channelId}
                  </span>
                </div>

                {/* Default Action */}
                <div className="col-span-2 text-center">
                  <Badge variant={channel.defaultAction === 'delete' ? 'danger' : channel.defaultAction === 'replace' ? 'warning' : 'success'}>
                    {channel.defaultAction}
                  </Badge>
                </div>

                {/* Mode */}
                <div className="col-span-2 text-center">
                  <span className="text-sm text-slate-600">
                    {channel.statefulMode ? 'Stateful' : 'Stateless'}
                  </span>
                </div>

                {/* Rules Count */}
                <div className="col-span-1 text-center">
                  <span className="text-sm font-medium text-slate-700 tabular-nums">
                    {channel.rules.length}
                  </span>
                </div>

                {/* Status */}
                <div className="col-span-2 text-center">
                  <Badge variant={channel.enabled ? 'success' : 'default'}>
                    {channel.enabled ? 'Active' : 'Inactive'}
                  </Badge>
                </div>

                {/* Actions */}
                <div className="col-span-1 flex items-center justify-end gap-1">
                  <Link to={`/channels/${channel.channelId}`}>
                    <IconButton variant="primary" title="View">
                      <Eye className="h-3.5 w-3.5" />
                    </IconButton>
                  </Link>
                  {isAdmin && (
                    <>
                      <Link to={`/channels/${channel.channelId}/edit`}>
                        <IconButton variant="secondary" title="Edit">
                          <Edit className="h-3.5 w-3.5" />
                        </IconButton>
                      </Link>
                      <IconButton
                        variant="danger"
                        onClick={() => handleDeleteClick(channel.channelId, channel.name)}
                        disabled={isDeleting}
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </IconButton>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {(totalPages > 1 || itemsPerPage) && (
            <div className="mt-4">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                itemsPerPage={itemsPerPage}
                totalItems={channels?.length || 0}
                onItemsPerPageChange={(size) => {
                  setItemsPerPage(size);
                  setCurrentPage(1);
                }}
                itemsPerPageOptions={[5, 10, 20, 50]}
              />
            </div>
          )}
        </>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, channelId: '', channelName: '' })}
        onConfirm={handleConfirmDelete}
        title="Delete Channel"
        message={
          <div>
            <p className="text-slate-600">
              Are you sure you want to delete <strong>{deleteModal.channelName}</strong>?
            </p>
            <p className="mt-1 text-sm text-slate-500">This action cannot be undone.</p>
          </div>
        }
        type="error"
        confirmText="Delete"
        cancelText="Cancel"
        isLoading={isDeleting}
      />
    </div>
  );
}
