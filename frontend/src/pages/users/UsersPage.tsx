// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { useState } from 'react';
import {
  useGetUsersQuery,
  useCreateUserMutation,
  useDisableUserMutation,
  useEnableUserMutation,
  useResetPasswordMutation,
  useChangeUserGroupMutation,
  useDeleteUserMutation,
  CognitoUser,
} from '../../store/api/usersApi';
import { UserPlus, Users, ShieldCheck, ShieldOff, KeyRound, ArrowUpDown, Trash2, Eye, EyeOff } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import LoadingState from '../../components/common/LoadingState';
import ErrorAlert from '../../components/common/ErrorAlert';
import IconButton from '../../components/common/IconButton';
import Modal from '../../components/common/Modal';
import Toggle from '../../components/common/Toggle';
import ConfirmModal from '../../components/common/ConfirmModal';
import DataTable, { Column } from '../../components/common/DataTable';
import EmptyState from '../../components/common/EmptyState';
import { useAppSelector } from '../../store';

export default function UsersPage() {
  const { data: users, isLoading, error } = useGetUsersQuery();
  const currentUserEmail = useAppSelector((state) => state.auth.user?.email);
  const [createUser, { isLoading: isCreating }] = useCreateUserMutation();
  const [disableUser] = useDisableUserMutation();
  const [enableUser] = useEnableUserMutation();
  const [resetPassword, { isLoading: isResetting }] = useResetPasswordMutation();
  const [changeUserGroup] = useChangeUserGroupMutation();
  const [deleteUser, { isLoading: isDeleting }] = useDeleteUserMutation();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [resetModal, setResetModal] = useState<string | null>(null);
  const [deleteModal, setDeleteModal] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [resetPw, setResetPw] = useState('');

  // Inline messages
  const [inlineMsg, setInlineMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  // Create form state
  const [formEmail, setFormEmail] = useState('');
  const [formName, setFormName] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formGroup, setFormGroup] = useState<'admin' | 'user'>('user');
  const [formSendInvite, setFormSendInvite] = useState(true);
  const [showCreatePw, setShowCreatePw] = useState(false);
  const [showResetPw, setShowResetPw] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    try {
      await createUser({
        email: formEmail, name: formName, group: formGroup,
        sendInvitation: formSendInvite,
        ...(formSendInvite ? {} : { temporaryPassword: formPassword }),
      }).unwrap();
      setInlineMsg({
        text: formSendInvite
          ? `User created - invitation email sent to ${formEmail}`
          : 'User created successfully',
        type: 'success',
      });
      setShowCreateForm(false);
      setFormEmail(''); setFormName(''); setFormPassword(''); setFormGroup('user'); setFormSendInvite(true);
    } catch (err: any) {
      setCreateError(err?.data?.error || 'Failed to create user');
    }
  };

  const handleToggleEnabled = async (username: string, currentlyEnabled: boolean) => {
    setInlineMsg(null);
    try {
      if (currentlyEnabled) { await disableUser(username).unwrap(); setInlineMsg({ text: `${username} disabled`, type: 'success' }); }
      else { await enableUser(username).unwrap(); setInlineMsg({ text: `${username} enabled`, type: 'success' }); }
    } catch (err: any) {
      setInlineMsg({ text: err?.data?.error || 'Action failed', type: 'error' });
    }
  };

  const handleResetPassword = async () => {
    if (!resetModal || !resetPw) return;
    setResetError(null);
    try {
      await resetPassword({ username: resetModal, temporaryPassword: resetPw }).unwrap();
      setInlineMsg({ text: `Password reset for ${resetModal}`, type: 'success' });
      setResetModal(null); setResetPw('');
    } catch (err: any) {
      setResetError(err?.data?.error || 'Failed to reset password');
    }
  };

  const handleChangeGroup = async (username: string, currentGroup: string) => {
    setInlineMsg(null);
    const newGroup = currentGroup === 'admin' ? 'user' : 'admin';
    try {
      await changeUserGroup({ username, group: newGroup as 'admin' | 'user' }).unwrap();
      setInlineMsg({ text: `${username} changed to ${newGroup}`, type: 'success' });
    } catch (err: any) {
      setInlineMsg({ text: err?.data?.error || 'Failed to change group', type: 'error' });
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteModal) return;
    setDeleteError(null);
    try {
      await deleteUser(deleteModal).unwrap();
      setInlineMsg({ text: `${deleteModal} deleted`, type: 'success' });
      setDeleteModal(null);
    } catch (err: any) {
      setDeleteError(err?.data?.error || 'Failed to delete user');
    }
  };

  const columns: Column<CognitoUser>[] = [
    { key: 'email', header: 'Email', render: (u) => <span className="font-medium text-gray-900">{u.email}</span> },
    { key: 'name', header: 'Name', render: (u) => <span className="text-gray-700">{u.name}</span> },
    { key: 'group', header: 'Group', align: 'center', render: (u) => (
      <Badge variant={u.groups.includes('admin') ? 'info' : 'default'}>{u.groups.includes('admin') ? 'Admin' : 'User'}</Badge>
    )},
    { key: 'status', header: 'Status', align: 'center', render: (u) => (
      <Badge variant={u.enabled ? 'success' : 'danger'}>{u.enabled ? 'Enabled' : 'Disabled'}</Badge>
    )},
    { key: 'account', header: 'Account', align: 'center', render: (u) => (
      <Badge variant={u.status === 'CONFIRMED' ? 'success' : 'warning'}>{u.status === 'FORCE_CHANGE_PASSWORD' ? 'Password Change' : u.status}</Badge>
    )},
    { key: 'actions', header: 'Actions', align: 'right', render: (u) => {
      // Mirror the backend guards so the UI never offers a call that will be
      // rejected: you cannot act on your own account (another admin must),
      // and the last enabled admin cannot be disabled, demoted or deleted -
      // create or promote another admin first.
      const isSelf = u.email === currentUserEmail;
      const enabledAdmins = (users || []).filter(
        (x) => x.enabled && x.groups.includes('admin')
      ).length;
      const isLastAdmin = u.enabled && u.groups.includes('admin') && enabledAdmins === 1;
      const isProtected = isSelf || isLastAdmin;
      return (
        <div className="flex items-center justify-end gap-1">
          {!isProtected && (
            <IconButton variant={u.enabled ? 'danger' : 'primary'} title={u.enabled ? 'Disable' : 'Enable'} onClick={() => handleToggleEnabled(u.username, u.enabled)}>
              {u.enabled ? <ShieldOff className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
            </IconButton>
          )}
          {!isSelf && (
            <IconButton variant="secondary" title="Reset password" onClick={() => { setResetModal(u.username); setResetError(null); }}>
              <KeyRound className="h-4 w-4" />
            </IconButton>
          )}
          {!isProtected && (
            <IconButton variant="ghost" title={u.groups.includes('admin') ? 'Demote to user' : 'Promote to admin'} onClick={() => handleChangeGroup(u.username, u.groups.includes('admin') ? 'admin' : 'user')}>
              <ArrowUpDown className="h-4 w-4" />
            </IconButton>
          )}
          {!isProtected && (
            <IconButton variant="danger" title="Delete" onClick={() => setDeleteModal(u.username)}>
              <Trash2 className="h-4 w-4" />
            </IconButton>
          )}
          {isProtected && (
            <span className="text-xs text-gray-400 pl-1" title={isSelf ? 'You cannot disable, demote or delete your own account' : 'The only admin cannot be disabled, demoted or deleted. Create or promote another admin first.'}>
              {isSelf ? 'You' : 'Only admin'}
            </span>
          )}
        </div>
      );
    }},
  ];

  if (isLoading) return <LoadingState message="Loading users..." />;
  if (error) return <ErrorAlert message="Failed to load users" />;

  return (
    <div>
      <PageHeader
        title="User Management"
        subtitle="Manage Cognito user accounts and group assignments"
        action={
          <Button variant="primary" onClick={() => setShowCreateForm(!showCreateForm)}>
            <UserPlus className="h-4 w-4 mr-2" /> Create User
          </Button>
        }
      />

      {/* Inline success/error message */}
      {inlineMsg && (
        <div className={`mb-4 p-3 rounded-lg flex items-center justify-between ${
          inlineMsg.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
        }`}>
          <p className={`text-sm ${inlineMsg.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>{inlineMsg.text}</p>
          <button onClick={() => setInlineMsg(null)} className="text-xs text-gray-400 hover:text-gray-600">Dismiss</button>
        </div>
      )}

      {/* Create User Form */}
      {showCreateForm && (
        <Card className="mb-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Create New User</h3>
          {createError && <ErrorAlert message={createError} onClose={() => setCreateError(null)} />}
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input label="Email" type="email" required placeholder="user@example.com" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} />
            <Input label="Full Name" required placeholder="John Doe" value={formName} onChange={(e) => setFormName(e.target.value)} />
            <Select label="Group" required value={formGroup} onChange={(e) => setFormGroup(e.target.value as 'admin' | 'user')} options={[{ value: 'user', label: 'User' }, { value: 'admin', label: 'Admin' }]} />
            <div className="md:col-span-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <Toggle
                label="Send invitation email"
                description="Cognito generates a temporary password and emails the user a sign-in invitation with the dashboard link"
                checked={formSendInvite}
                onChange={(e) => setFormSendInvite(e.target.checked)}
              />
              {!formSendInvite && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-200">
                  <div className="relative">
                    <Input label="Temporary Password" type={showCreatePw ? 'text' : 'password'} required placeholder="Min 8 characters" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} helperText="8+ characters with uppercase, lowercase, number, and special character" />
                    <button type="button" className="absolute right-3 top-[34px] text-gray-400 hover:text-gray-600" onClick={() => setShowCreatePw(!showCreatePw)}>
                      {showCreatePw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 md:self-center">
                    No email is sent in this mode - share the temporary password with the user yourself. They will be asked to set a permanent password on first sign-in.
                  </p>
                </div>
              )}
            </div>
            <div className="md:col-span-3 flex gap-3 justify-end">
              <Button variant="ghost" type="button" onClick={() => setShowCreateForm(false)}>Cancel</Button>
              <Button variant="primary" type="submit" isLoading={isCreating}>Create User</Button>
            </div>
          </form>
        </Card>
      )}

      {/* Reset Password Modal */}
      <Modal isOpen={!!resetModal} onClose={() => { setResetModal(null); setResetPw(''); setResetError(null); }}>
        <div className="p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Reset Password</h3>
          <p className="text-sm text-gray-500 mb-4">Set a new temporary password for <span className="font-medium text-gray-700">{resetModal}</span></p>
          {resetError && <ErrorAlert message={resetError} onClose={() => setResetError(null)} />}
          <div className="relative">
            <Input label="New Temporary Password" type={showResetPw ? 'text' : 'password'} required placeholder="Min 8 characters" value={resetPw} onChange={(e) => setResetPw(e.target.value)} helperText="Must contain: 8+ characters, uppercase, lowercase, number, and special character" />
            <button type="button" className="absolute right-3 top-[34px] text-gray-400 hover:text-gray-600" onClick={() => setShowResetPw(!showResetPw)}>
              {showResetPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <div className="flex gap-3 justify-end mt-4">
            <Button variant="ghost" onClick={() => { setResetModal(null); setResetPw(''); setResetError(null); }}>Cancel</Button>
            <Button variant="primary" onClick={handleResetPassword} disabled={!resetPw} isLoading={isResetting}>Reset</Button>
          </div>
        </div>
      </Modal>

      {/* Delete User Modal */}
      <ConfirmModal
        isOpen={!!deleteModal}
        onClose={() => { setDeleteModal(null); setDeleteError(null); }}
        onConfirm={handleDeleteUser}
        title="Delete User"
        message={<>Are you sure you want to permanently delete <span className="font-medium text-gray-900">{deleteModal}</span>?<br /><span className="text-xs text-red-500">This action cannot be undone.</span></>}
        confirmText="Delete" cancelText="Cancel" type="error" isLoading={isDeleting} error={deleteError}
      />

      {/* Users Table */}
      <Card padding="none">
        <DataTable columns={columns} data={users || []} rowKey={(u) => u.username}
          emptyState={<EmptyState variant="inline" icon={<Users className="h-8 w-8 text-gray-300" />} title="No users found" />}
        />
      </Card>
    </div>
  );
}
