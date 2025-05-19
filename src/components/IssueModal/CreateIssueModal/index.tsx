import Button from '@app/components/Common/Button';
import Modal from '@app/components/Common/Modal';
import { issueOptions } from '@app/components/IssueModal/constants';
import useSettings from '@app/hooks/useSettings';
import { Permission, useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import { RadioGroup } from '@headlessui/react';
import { ArrowRightCircleIcon } from '@heroicons/react/24/solid';
import { MediaStatus } from '@server/constants/media';
import { IssueType } from '@server/constants/issue';
import type Issue from '@server/entity/Issue';
import type { MovieDetails } from '@server/models/Movie';
import type { TvDetails } from '@server/models/Tv';
import axios from 'axios';
import { Field, Formik } from 'formik';
import Link from 'next/link';
import { defineMessages, useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import useSWR, { mutate } from 'swr';
import * as Yup from 'yup';

const messages = defineMessages({
  validationMessageRequired: 'You must provide a description',
  whatswrong: "What's wrong?",
  providedetail:
    'Please provide a detailed explanation of the issue you encountered.',
  extras: 'Extras',
  season: 'Season {seasonNumber}',
  episode: 'Episode {episodeNumber}',
  allseasons: 'All Seasons',
  allepisodes: 'All Episodes',
  problemseason: 'Affected Season',
  problemepisode: 'Affected Episode',
  toastSuccessCreate:
    'Issue report for <strong>{title}</strong> submitted successfully!',
  toastFailedCreate: 'Something went wrong while submitting the issue.',
  toastviewissue: 'View Issue',
  reportissue: 'Report an Issue',
  submitissue: 'Submit Issue',
  requestedVideoQuality: 'Requested Video Quality',
  upgradeAudio: 'Upgrade Audio to Surround Sound',
  validationUpgradeRequired: 'You must select a video quality or request an audio upgrade',
});

const isMovie = (movie: MovieDetails | TvDetails): movie is MovieDetails => {
  return (movie as MovieDetails).title !== undefined;
};

const classNames = (...classes: string[]) => {
  return classes.filter(Boolean).join(' ');
};

interface CreateIssueModalProps {
  mediaType: 'movie' | 'tv';
  tmdbId?: number;
  onCancel?: () => void;
}

const CreateIssueModal = ({
  onCancel,
  mediaType,
  tmdbId,
}: CreateIssueModalProps) => {
  const intl = useIntl();
  const settings = useSettings();
  const { hasPermission } = useUser();
  const { addToast } = useToasts();
  const { data, error } = useSWR<MovieDetails | TvDetails>(
    tmdbId ? `/api/v1/${mediaType}/${tmdbId}` : null
  );

  if (!tmdbId) {
    return null;
  }

  const availableSeasons = (data?.mediaInfo?.seasons ?? [])
    .filter(
      (season) =>
        season.status === MediaStatus.AVAILABLE ||
        season.status === MediaStatus.PARTIALLY_AVAILABLE ||
        (settings.currentSettings.series4kEnabled &&
          hasPermission([Permission.REQUEST_4K, Permission.REQUEST_4K_TV], {
            type: 'or',
          }) &&
          (season.status4k === MediaStatus.AVAILABLE ||
            season.status4k === MediaStatus.PARTIALLY_AVAILABLE))
    )
    .map((season) => season.seasonNumber);

  return (
    <Formik
      initialValues={{
        selectedIssue: issueOptions[0],
        message: '',
        problemSeason: availableSeasons.length === 1 ? availableSeasons[0] : 0,
        problemEpisode: 0,
        requestedVideoQuality: '',
        upgradeAudio: false,
      }}
      validationSchema={Yup.object().shape({
        message: Yup.string().when('selectedIssue', {
          is: (issue: { issueType: IssueType }) => issue.issueType === IssueType.UPGRADE_QUALITY,
          then: Yup.string(), // Not required for upgrade quality
          otherwise: Yup.string().required(
            intl.formatMessage(messages.validationMessageRequired)
          ),
        }),
        requestedVideoQuality: Yup.string().when('selectedIssue', {
          is: (issue: { issueType: IssueType }) => issue.issueType === IssueType.UPGRADE_QUALITY,
          then: Yup.string(),
          otherwise: Yup.string().notRequired(),
        }),
        upgradeAudio: Yup.boolean(),
      })}
      validate={(values) => {
        const errors: any = {};
        if (
          values.selectedIssue.issueType === IssueType.UPGRADE_QUALITY &&
          !values.requestedVideoQuality &&
          !values.upgradeAudio
        ) {
          errors.requestedVideoQuality = intl.formatMessage(
            messages.validationUpgradeRequired
          );
        }
        return errors;
      }}
      onSubmit={async (values) => {
        try {
          let message = values.message;
          if (values.selectedIssue.issueType === IssueType.UPGRADE_QUALITY) {
            message = '';
            if (values.requestedVideoQuality) {
              message += `Requested Quality: ${values.requestedVideoQuality}`;
            }
            if (values.upgradeAudio) {
              if (message) message += '; ';
              message += 'Audio upgrade requested';
            }
          }

          const newIssue = await axios.post<Issue>('/api/v1/issue', {
            issueType: values.selectedIssue.issueType,
            message,
            mediaId: data?.mediaInfo?.id,
            problemSeason: values.problemSeason,
            problemEpisode:
              values.problemSeason > 0 ? values.problemEpisode : 0,
          });

          if (data) {
            addToast(
              <>
                <div>
                  {intl.formatMessage(messages.toastSuccessCreate, {
                    title: isMovie(data) ? data.title : data.name,
                    strong: (msg: React.ReactNode) => <strong>{msg}</strong>,
                  })}
                </div>
                <Link href={`/issues/${newIssue.data.id}`}>
                  <Button as="a" className="mt-4">
                    <span>{intl.formatMessage(messages.toastviewissue)}</span>
                    <ArrowRightCircleIcon />
                  </Button>
                </Link>
              </>,
              {
                appearance: 'success',
                autoDismiss: true,
              }
            );

            mutate('/api/v1/issue/count');
          }

          if (onCancel) {
            onCancel();
          }
        } catch (e) {
          addToast(intl.formatMessage(messages.toastFailedCreate), {
            appearance: 'error',
            autoDismiss: true,
          });
        }
      }}
    >
      {({ handleSubmit, values, setFieldValue, errors, touched, handleChange }) => {
        return (
          <Modal
            backgroundClickable
            onCancel={onCancel}
            title={intl.formatMessage(messages.reportissue)}
            subTitle={data && isMovie(data) ? data?.title : data?.name}
            cancelText={intl.formatMessage(globalMessages.close)}
            onOk={() => handleSubmit()}
            okText={intl.formatMessage(messages.submitissue)}
            loading={!data && !error}
            backdrop={`https://image.tmdb.org/t/p/w1920_and_h800_multi_faces/${data?.backdropPath}`}
          >
            {mediaType === 'tv' && data && !isMovie(data) && (
              <>
                <div className="form-row">
                  <label htmlFor="problemSeason" className="text-label">
                    {intl.formatMessage(messages.problemseason)}
                    <span className="label-required">*</span>
                  </label>
                  <div className="form-input-area">
                    <div className="form-input-field">
                      <Field
                        as="select"
                        id="problemSeason"
                        name="problemSeason"
                        disabled={availableSeasons.length === 1}
                      >
                        {availableSeasons.length > 1 && (
                          <option value={0}>
                            {intl.formatMessage(messages.allseasons)}
                          </option>
                        )}
                        {availableSeasons.map((season) => (
                          <option
                            value={season}
                            key={`problem-season-${season}`}
                          >
                            {season === 0
                              ? intl.formatMessage(messages.extras)
                              : intl.formatMessage(messages.season, {
                                  seasonNumber: season,
                                })}
                          </option>
                        ))}
                      </Field>
                    </div>
                  </div>
                </div>
                {values.problemSeason > 0 && (
                  <div className="form-row mb-2">
                    <label htmlFor="problemEpisode" className="text-label">
                      {intl.formatMessage(messages.problemepisode)}
                      <span className="label-required">*</span>
                    </label>
                    <div className="form-input-area">
                      <div className="form-input-field">
                        <Field
                          as="select"
                          id="problemEpisode"
                          name="problemEpisode"
                        >
                          <option value={0}>
                            {intl.formatMessage(messages.allepisodes)}
                          </option>
                          {[
                            ...Array(
                              data.seasons.find(
                                (season) =>
                                  Number(values.problemSeason) ===
                                  season.seasonNumber
                              )?.episodeCount ?? 0
                            ),
                          ].map((i, index) => (
                            <option
                              value={index + 1}
                              key={`problem-episode-${index + 1}`}
                            >
                              {intl.formatMessage(messages.episode, {
                                episodeNumber: index + 1,
                              })}
                            </option>
                          ))}
                        </Field>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
            <RadioGroup
              value={values.selectedIssue}
              onChange={(issue) => setFieldValue('selectedIssue', issue)}
              className="mt-4"
            >
              <RadioGroup.Label className="sr-only">
                Select an Issue
              </RadioGroup.Label>
              <div className="-space-y-px overflow-hidden rounded-md bg-gray-800 bg-opacity-30">
                {issueOptions.map((setting, index) => (
                  <RadioGroup.Option
                    key={`issue-type-${setting.issueType}`}
                    value={setting}
                    className={({ checked }) =>
                      classNames(
                        index === 0 ? 'rounded-tl-md rounded-tr-md' : '',
                        index === issueOptions.length - 1
                          ? 'rounded-bl-md rounded-br-md'
                          : '',
                        checked
                          ? 'z-10 border border-indigo-500 bg-indigo-400 bg-opacity-20'
                          : 'border-gray-500',
                        'relative flex cursor-pointer border p-4 focus:outline-none'
                      )
                    }
                  >
                    {({ active, checked }) => (
                      <>
                        <span
                          className={`${
                            checked
                              ? 'border-transparent bg-indigo-600'
                              : 'border-gray-300 bg-white'
                          } ${
                            active ? 'ring-2 ring-indigo-300 ring-offset-2' : ''
                          } mt-0.5 flex h-4 w-4 cursor-pointer items-center justify-center rounded-full border`}
                          aria-hidden="true"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-white" />
                        </span>
                        <div className="ml-3 flex flex-col">
                          <RadioGroup.Label
                            as="span"
                            className={`block text-sm font-medium ${
                              checked ? 'text-indigo-100' : 'text-gray-100'
                            }`}
                          >
                            {intl.formatMessage(setting.name)}
                          </RadioGroup.Label>
                        </div>
                      </>
                    )}
                  </RadioGroup.Option>
                ))}
              </div>
            </RadioGroup>
            {values.selectedIssue.issueType === IssueType.UPGRADE_QUALITY ? (
              <>
                <div className="form-row">
                  <label htmlFor="requestedVideoQuality" className="text-label">
                    {intl.formatMessage(messages.requestedVideoQuality)}
                  </label>
                  <div className="form-input-area">
                    <select
                      id="requestedVideoQuality"
                      name="requestedVideoQuality"
                      value={values.requestedVideoQuality}
                      onChange={handleChange}
                      className="form-input-field"
                    >
                      <option value="">{/* empty default */}</option>
                      <option value="HD">HD</option>
                      <option value="UHD">UHD</option>
                      <option value="AI Upscale">AI Upscale</option>
                    </select>
                    {errors.requestedVideoQuality &&
                      touched.requestedVideoQuality && (
                        <div className="error">
                          {errors.requestedVideoQuality}
                        </div>
                      )}
                  </div>
                </div>
                <div className="form-row">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="upgradeAudio"
                      checked={values.upgradeAudio}
                      onChange={() =>
                        setFieldValue('upgradeAudio', !values.upgradeAudio)
                      }
                      className="mr-2"
                    />
                    {intl.formatMessage(messages.upgradeAudio)}
                  </label>
                </div>
              </>
            ) : (
              <div className="form-row">
                <label htmlFor="message" className="text-label">
                  {intl.formatMessage(messages.whatswrong)}
                </label>
                <div className="form-input-area">
                  <Field
                    as="textarea"
                    id="message"
                    name="message"
                    className="form-input-field"
                    placeholder={intl.formatMessage(messages.providedetail)}
                  />
                  {errors.message && touched.message && (
                    <div className="error">{errors.message}</div>
                  )}
                </div>
              </div>
            )}
          
          </Modal>
        );
      }}
    </Formik>
  );
};

export default CreateIssueModal;
