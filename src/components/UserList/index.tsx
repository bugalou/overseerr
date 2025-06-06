import Alert from '@app/components/Common/Alert';
import Badge from '@app/components/Common/Badge';
import Button from '@app/components/Common/Button';
import Header from '@app/components/Common/Header';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import Modal from '@app/components/Common/Modal';
import PageTitle from '@app/components/Common/PageTitle';
import SensitiveInput from '@app/components/Common/SensitiveInput';
import Table from '@app/components/Common/Table';
import BulkEditModal from '@app/components/UserList/BulkEditModal';
import PlexImportModal from '@app/components/UserList/PlexImportModal';
import useSettings from '@app/hooks/useSettings';
import { useUpdateQueryParams } from '@app/hooks/useUpdateQueryParams';
import type { User } from '@app/hooks/useUser';
import { Permission, UserType, useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import { Transition } from '@headlessui/react';
import {
  BarsArrowDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  InboxArrowDownIcon,
  PencilIcon,
  UserPlusIcon,
} from '@heroicons/react/24/solid';
import type { UserResultsResponse } from '@server/interfaces/api/userInterfaces';
import { hasPermission } from '@server/lib/permissions';
import axios from 'axios';
import { Field, Form, Formik } from 'formik';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import useSWR from 'swr';
import * as Yup from 'yup';

const messages = defineMessages({
  users: 'Users',
  userlist: 'User List',
  importfromplex: 'Import Plex Users',
  user: 'User',
  totalrequests: 'Requests',
  accounttype: 'Type',
  role: 'Role',
  created: 'Joined',
  bulkedit: 'Bulk Edit',
  owner: 'Owner',
  admin: 'Admin',
  plexuser: 'Plex User',
  deleteuser: 'Delete User',
  userdeleted: 'User deleted successfully!',
  userdeleteerror: 'Something went wrong while deleting the user.',
  deleteconfirm:
    'Are you sure you want to delete this user? All of their request data will be permanently removed.',
  localuser: 'Local User',
  createlocaluser: 'Create Local User',
  creating: 'Creating…',
  create: 'Create',
  validationpasswordminchars:
    'Password is too short; should be a minimum of 8 characters',
  usercreatedfailed: 'Something went wrong while creating the user.',
  usercreatedfailedexisting:
    'The provided email address is already in use by another user.',
  usercreatedsuccess: 'User created successfully!',
  displayName: 'Display Name',
  email: 'Email Address',
  password: 'Password',
  passwordinfodescription:
    'Configure an application URL and enable email notifications to allow automatic password generation.',
  autogeneratepassword: 'Automatically Generate Password',
  autogeneratepasswordTip: 'Email a server-generated password to the user',
  validationEmail: 'You must provide a valid email address',
  sortCreated: 'Join Date',
  sortDisplayName: 'Display Name',
  sortRequests: 'Request Count',
  localLoginDisabled:
    'The <strong>Enable Local Sign-In</strong> setting is currently disabled.',
});

type Sort = 'created' | 'updated' | 'requests' | 'displayname';

const UserList = () => {
  const intl = useIntl();
  const router = useRouter();
  const settings = useSettings();
  const { addToast } = useToasts();
  const { user: currentUser, hasPermission: currentHasPermission } = useUser();
  const [currentSort, setCurrentSort] = useState<Sort>('displayname');
  const [currentPageSize, setCurrentPageSize] = useState<number>(10);

  const page = router.query.page ? Number(router.query.page) : 1;
  const pageIndex = page - 1;
  const updateQueryParams = useUpdateQueryParams({ page: page.toString() });

  const {
    data,
    error,
    mutate: revalidate,
  } = useSWR<UserResultsResponse>(
    `/api/v1/user?take=${currentPageSize}&skip=${
      pageIndex * currentPageSize
    }&sort=${currentSort}`
  );

  const [isDeleting, setDeleting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    user?: User;
  }>({
    isOpen: false,
  });
  const [createModal, setCreateModal] = useState<{
    isOpen: boolean;
  }>({
    isOpen: false,
  });
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);

  useEffect(() => {
    const filterString = window.localStorage.getItem('ul-filter-settings');

    if (filterString) {
      const filterSettings = JSON.parse(filterString);

      setCurrentSort(filterSettings.currentSort);
      setCurrentPageSize(filterSettings.currentPageSize);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      'ul-filter-settings',
      JSON.stringify({
        currentSort,
        currentPageSize,
      })
    );
  }, [currentSort, currentPageSize]);

  const isUserPermsEditable = (userId: number) =>
    userId !== 1 && userId !== currentUser?.id;
  const isAllUsersSelected = () => {
    return (
      selectedUsers.length ===
      data?.results.filter((user) => user.id !== currentUser?.id).length
    );
  };
  const isUserSelected = (userId: number) => selectedUsers.includes(userId);
  const toggleAllUsers = () => {
    if (
      data &&
      selectedUsers.length >= 0 &&
      selectedUsers.length < data?.results.length - 1
    ) {
      setSelectedUsers(
        data.results
          .filter((user) => isUserPermsEditable(user.id))
          .map((u) => u.id)
      );
    } else {
      setSelectedUsers([]);
    }
  };
  const toggleUser = (userId: number) => {
    if (selectedUsers.includes(userId)) {
      setSelectedUsers((users) => users.filter((u) => u !== userId));
    } else {
      setSelectedUsers((users) => [...users, userId]);
    }
  };

  const deleteUser = async () => {
    setDeleting(true);

    try {
      await axios.delete(`/api/v1/user/${deleteModal.user?.id}`);

      addToast(intl.formatMessage(messages.userdeleted), {
        autoDismiss: true,
        appearance: 'success',
      });
      setDeleteModal({ isOpen: false, user: deleteModal.user });
    } catch (e) {
      addToast(intl.formatMessage(messages.userdeleteerror), {
        autoDismiss: true,
        appearance: 'error',
      });
    } finally {
      setDeleting(false);
      revalidate();
    }
  };

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  const CreateUserSchema = Yup.object().shape({
    email: Yup.string()
      .required(intl.formatMessage(messages.validationEmail))
      .email(intl.formatMessage(messages.validationEmail)),
    password: Yup.lazy((value) =>
      !value
        ? Yup.string()
        : Yup.string().min(
            8,
            intl.formatMessage(messages.validationpasswordminchars)
          )
    ),
  });

  if (!data) {
    return <LoadingSpinner />;
  }

  const hasNextPage = data.pageInfo.pages > pageIndex + 1;
  const hasPrevPage = pageIndex > 0;

  const passwordGenerationEnabled =
    settings.currentSettings.applicationUrl &&
    settings.currentSettings.emailEnabled;

  return (
    <>
      <PageTitle title={intl.formatMessage(messages.users)} />
      <Transition
        as="div"
        enter="transition-opacity duration-300"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition-opacity duration-300"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
        show={deleteModal.isOpen}
      >
        <Modal
          onOk={() => deleteUser()}
          okText={
            isDeleting
              ? intl.formatMessage(globalMessages.deleting)
              : intl.formatMessage(globalMessages.delete)
          }
          okDisabled={isDeleting}
          okButtonType="danger"
          onCancel={() =>
            setDeleteModal({ isOpen: false, user: deleteModal.user })
          }
          title={intl.formatMessage(messages.deleteuser)}
          subTitle={deleteModal.user?.displayName}
        >
          {intl.formatMessage(messages.deleteconfirm)}
        </Modal>
      </Transition>

      <Transition
        as="div"
        enter="transition-opacity duration-300"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition-opacity duration-300"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
        show={createModal.isOpen}
      >
        <Formik
          initialValues={{
            displayName: '',
            email: '',
            password: '',
            genpassword: false,
          }}
          validationSchema={CreateUserSchema}
          onSubmit={async (values) => {
            try {
              await axios.post('/api/v1/user', {
                username: values.displayName,
                email: values.email,
                password: values.genpassword ? null : values.password,
              });
              addToast(intl.formatMessage(messages.usercreatedsuccess), {
                appearance: 'success',
                autoDismiss: true,
              });
              setCreateModal({ isOpen: false });
            } catch (e) {
              addToast(
                intl.formatMessage(
                  e.response.data.errors?.includes('USER_EXISTS')
                    ? messages.usercreatedfailedexisting
                    : messages.usercreatedfailed
                ),
                {
                  appearance: 'error',
                  autoDismiss: true,
                }
              );
            } finally {
              revalidate();
            }
          }}
        >
          {({
            errors,
            touched,
            isSubmitting,
            values,
            isValid,
            setFieldValue,
            handleSubmit,
          }) => {
            return (
              <Modal
                title={intl.formatMessage(messages.createlocaluser)}
                onOk={() => handleSubmit()}
                okText={
                  isSubmitting
                    ? intl.formatMessage(messages.creating)
                    : intl.formatMessage(messages.create)
                }
                okDisabled={isSubmitting || !isValid}
                okButtonType="primary"
                onCancel={() => setCreateModal({ isOpen: false })}
              >
                {!settings.currentSettings.localLogin && (
                  <Alert
                    title={intl.formatMessage(messages.localLoginDisabled, {
                      strong: (msg: React.ReactNode) => (
                        <strong className="font-semibold text-white">
                          {msg}
                        </strong>
                      ),
                    })}
                    type="warning"
                  />
                )}
                {currentHasPermission(Permission.ADMIN) &&
                  !passwordGenerationEnabled && (
                    <Alert
                      title={intl.formatMessage(
                        messages.passwordinfodescription
                      )}
                      type="info"
                    />
                  )}
                <Form className="section">
                  <div className="form-row">
                    <label htmlFor="displayName" className="text-label">
                      {intl.formatMessage(messages.displayName)}
                    </label>
                    <div className="form-input-area">
                      <div className="form-input-field">
                        <Field
                          id="displayName"
                          name="displayName"
                          type="text"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="form-row">
                    <label htmlFor="email" className="text-label">
                      {intl.formatMessage(messages.email)}
                      <span className="label-required">*</span>
                    </label>
                    <div className="form-input-area">
                      <div className="form-input-field">
                        <Field
                          id="email"
                          name="email"
                          type="text"
                          inputMode="email"
                          autoComplete="off"
                          data-1pignore="true"
                          data-lpignore="true"
                          data-bwignore="true"
                        />
                      </div>
                      {errors.email &&
                        touched.email &&
                        typeof errors.email === 'string' && (
                          <div className="error">{errors.email}</div>
                        )}
                    </div>
                  </div>
                  <div
                    className={`form-row ${
                      passwordGenerationEnabled ? '' : 'opacity-50'
                    }`}
                  >
                    <label htmlFor="genpassword" className="checkbox-label">
                      {intl.formatMessage(messages.autogeneratepassword)}
                      <span className="label-tip">
                        {intl.formatMessage(messages.autogeneratepasswordTip)}
                      </span>
                    </label>
                    <div className="form-input-area">
                      <Field
                        type="checkbox"
                        id="genpassword"
                        name="genpassword"
                        disabled={!passwordGenerationEnabled}
                        onClick={() => setFieldValue('password', '')}
                      />
                    </div>
                  </div>
                  <div
                    className={`form-row ${
                      values.genpassword ? 'opacity-50' : ''
                    }`}
                  >
                    <label htmlFor="password" className="text-label">
                      {intl.formatMessage(messages.password)}
                      {!values.genpassword && (
                        <span className="label-required">*</span>
                      )}
                    </label>
                    <div className="form-input-area">
                      <div className="form-input-field">
                        <SensitiveInput
                          as="field"
                          id="password"
                          name="password"
                          type="password"
                          autoComplete="new-password"
                          disabled={values.genpassword}
                        />
                      </div>
                      {errors.password &&
                        touched.password &&
                        typeof errors.password === 'string' && (
                          <div className="error">{errors.password}</div>
                        )}
                    </div>
                  </div>
                </Form>
              </Modal>
            );
          }}
        </Formik>
      </Transition>

      <Transition
        as="div"
        enter="transition-opacity duration-300"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition-opacity duration-300"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
        show={showBulkEditModal}
      >
        <BulkEditModal
          onCancel={() => setShowBulkEditModal(false)}
          onComplete={() => {
            setShowBulkEditModal(false);
            revalidate();
          }}
          selectedUserIds={selectedUsers}
          users={data.results}
        />
      </Transition>

      <Transition
        as="div"
        enter="transition-opacity duration-300"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition-opacity duration-300"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
        show={showImportModal}
      >
        <PlexImportModal
          onCancel={() => setShowImportModal(false)}
          onComplete={() => {
            setShowImportModal(false);
            revalidate();
          }}
        />
      </Transition>

      <div className="flex flex-col justify-between lg:flex-row lg:items-end">
        <Header>{intl.formatMessage(messages.userlist)}</Header>
        <div className="mt-2 flex flex-grow flex-col lg:flex-grow-0 lg:flex-row">
          <div className="mb-2 flex flex-grow flex-col justify-between sm:flex-row lg:mb-0 lg:flex-grow-0">
            <Button
              className="mb-2 flex-grow sm:mb-0 sm:mr-2"
              buttonType="primary"
              onClick={() => setCreateModal({ isOpen: true })}
            >
              <UserPlusIcon />
              <span>{intl.formatMessage(messages.createlocaluser)}</span>
            </Button>
            <Button
              className="flex-grow lg:mr-2"
              buttonType="primary"
              onClick={() => setShowImportModal(true)}
            >
              <InboxArrowDownIcon />
              <span>{intl.formatMessage(messages.importfromplex)}</span>
            </Button>
          </div>
          <div className="mb-2 flex flex-grow lg:mb-0 lg:flex-grow-0">
            <span className="inline-flex cursor-default items-center rounded-l-md border border-r-0 border-gray-500 bg-gray-800 px-3 text-sm text-gray-100">
              <BarsArrowDownIcon className="h-6 w-6" />
            </span>
            <select
              id="sort"
              name="sort"
              onChange={(e) => {
                setCurrentSort(e.target.value as Sort);
                router.push(router.pathname);
              }}
              value={currentSort}
              className="rounded-r-only"
            >
              <option value="created">
                {intl.formatMessage(messages.sortCreated)}
              </option>
              <option value="requests">
                {intl.formatMessage(messages.sortRequests)}
              </option>
              <option value="displayname">
                {intl.formatMessage(messages.sortDisplayName)}
              </option>
            </select>
          </div>
        </div>
      </div>
      <Table>
        <thead>
          <tr>
            <Table.TH>
              {(data.results ?? []).length > 1 && (
                <input
                  type="checkbox"
                  id="selectAll"
                  name="selectAll"
                  checked={isAllUsersSelected()}
                  onChange={() => {
                    toggleAllUsers();
                  }}
                />
              )}
            </Table.TH>
            <Table.TH>{intl.formatMessage(messages.user)}</Table.TH>
            <Table.TH>{intl.formatMessage(messages.totalrequests)}</Table.TH>
            <Table.TH>{intl.formatMessage(messages.accounttype)}</Table.TH>
            <Table.TH>{intl.formatMessage(messages.role)}</Table.TH>
            <Table.TH>{intl.formatMessage(messages.created)}</Table.TH>
            <Table.TH className="text-right">
              {(data.results ?? []).length > 1 && (
                <Button
                  buttonType="warning"
                  onClick={() => setShowBulkEditModal(true)}
                  disabled={selectedUsers.length === 0}
                >
                  <PencilIcon />
                  <span>{intl.formatMessage(messages.bulkedit)}</span>
                </Button>
              )}
            </Table.TH>
          </tr>
        </thead>
        <Table.TBody>
          {data?.results.map((user) => (
            <tr key={`user-list-${user.id}`} data-testid="user-list-row">
              <Table.TD>
                {isUserPermsEditable(user.id) && (
                  <input
                    type="checkbox"
                    id={`user-list-select-${user.id}`}
                    name={`user-list-select-${user.id}`}
                    checked={isUserSelected(user.id)}
                    onChange={() => {
                      toggleUser(user.id);
                    }}
                  />
                )}
              </Table.TD>
              <Table.TD>
                <div className="flex items-center">
                  <Link href={`/users/${user.id}`}>
                    <a className="h-10 w-10 flex-shrink-0">
                      <img
                        className="h-10 w-10 rounded-full object-cover"
                        src={user.avatar}
                        alt=""
                      />
                    </a>
                  </Link>
                  <div className="ml-4">
                    <Link href={`/users/${user.id}`}>
                      <a
                        className="text-base font-bold leading-5 transition duration-300 hover:underline"
                        data-testid="user-list-username-link"
                      >
                        {user.displayName}
                      </a>
                    </Link>
                    {user.displayName.toLowerCase() !== user.email && (
                      <div className="text-sm leading-5 text-gray-300">
                        {user.email}
                      </div>
                    )}
                  </div>
                </div>
              </Table.TD>
              <Table.TD>
                {user.id === currentUser?.id ||
                currentHasPermission(
                  [Permission.MANAGE_REQUESTS, Permission.REQUEST_VIEW],
                  { type: 'or' }
                ) ? (
                  <Link href={`/users/${user.id}/requests`}>
                    <a className="text-sm leading-5 transition duration-300 hover:underline">
                      {user.requestCount}
                    </a>
                  </Link>
                ) : (
                  user.requestCount
                )}
              </Table.TD>
              <Table.TD>
                {user.userType === UserType.PLEX ? (
                  <Badge badgeType="warning">
                    {intl.formatMessage(messages.plexuser)}
                  </Badge>
                ) : (
                  <Badge badgeType="default">
                    {intl.formatMessage(messages.localuser)}
                  </Badge>
                )}
              </Table.TD>
              <Table.TD>
                {user.id === 1
                  ? intl.formatMessage(messages.owner)
                  : hasPermission(Permission.ADMIN, user.permissions)
                  ? intl.formatMessage(messages.admin)
                  : intl.formatMessage(messages.user)}
              </Table.TD>
              <Table.TD>
                {intl.formatDate(user.createdAt, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </Table.TD>
              <Table.TD alignText="right">
                <Button
                  buttonType="warning"
                  disabled={user.id === 1 && currentUser?.id !== 1}
                  className="mr-2"
                  onClick={() =>
                    router.push(
                      '/users/[userId]/settings',
                      `/users/${user.id}/settings`
                    )
                  }
                >
                  {intl.formatMessage(globalMessages.edit)}
                </Button>
                <Button
                  buttonType="danger"
                  disabled={
                    user.id === 1 ||
                    (currentUser?.id !== 1 &&
                      hasPermission(Permission.ADMIN, user.permissions))
                  }
                  onClick={() => setDeleteModal({ isOpen: true, user })}
                >
                  {intl.formatMessage(globalMessages.delete)}
                </Button>
              </Table.TD>
            </tr>
          ))}
          <tr className="bg-gray-700">
            <Table.TD colSpan={8} noPadding>
              <nav
                className="flex w-screen flex-col items-center space-x-4 space-y-3 px-6 py-3 sm:flex-row sm:space-y-0 lg:w-full"
                aria-label="Pagination"
              >
                <div className="hidden lg:flex lg:flex-1">
                  <p className="text-sm">
                    {data.results.length > 0 &&
                      intl.formatMessage(globalMessages.showingresults, {
                        from: pageIndex * currentPageSize + 1,
                        to:
                          data.results.length < currentPageSize
                            ? pageIndex * currentPageSize + data.results.length
                            : (pageIndex + 1) * currentPageSize,
                        total: data.pageInfo.results,
                        strong: (msg: React.ReactNode) => (
                          <span className="font-medium">{msg}</span>
                        ),
                      })}
                  </p>
                </div>
                <div className="flex justify-center sm:flex-1 sm:justify-start lg:justify-center">
                  <span className="-mt-3 items-center text-sm sm:-ml-4 sm:mt-0 lg:ml-0">
                    {intl.formatMessage(globalMessages.resultsperpage, {
                      pageSize: (
                        <select
                          id="pageSize"
                          name="pageSize"
                          onChange={(e) => {
                            setCurrentPageSize(Number(e.target.value));
                            router
                              .push(router.pathname)
                              .then(() => window.scrollTo(0, 0));
                          }}
                          value={currentPageSize}
                          className="short inline"
                        >
                          <option value="5">5</option>
                          <option value="10">10</option>
                          <option value="25">25</option>
                          <option value="50">50</option>
                          <option value="100">100</option>
                        </select>
                      ),
                    })}
                  </span>
                </div>
                <div className="flex flex-auto justify-center space-x-2 sm:flex-1 sm:justify-end">
                  <Button
                    disabled={!hasPrevPage}
                    onClick={() =>
                      updateQueryParams('page', (page - 1).toString())
                    }
                  >
                    <ChevronLeftIcon />
                    <span>{intl.formatMessage(globalMessages.previous)}</span>
                  </Button>
                  <Button
                    disabled={!hasNextPage}
                    onClick={() =>
                      updateQueryParams('page', (page + 1).toString())
                    }
                  >
                    <span>{intl.formatMessage(globalMessages.next)}</span>
                    <ChevronRightIcon />
                  </Button>
                </div>
              </nav>
            </Table.TD>
          </tr>
        </Table.TBody>
      </Table>
    </>
  );
};

export default UserList;
