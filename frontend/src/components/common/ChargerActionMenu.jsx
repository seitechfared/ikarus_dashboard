import StationActionMenu from './StationActionMenu'

const EditIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M12.2094 13.519L9.56982 13.8967L9.9467 11.2565L16.7347 4.46855C17.0347 4.16851 17.4417 4 17.866 4C18.2903 4 18.6973 4.16851 18.9973 4.46855C19.2974 4.7686 19.4659 5.17556 19.4659 5.59989C19.4659 6.02422 19.2974 6.43117 18.9973 6.73121L12.2094 13.519Z"
      stroke="#011309"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M16.7994 13.6001V18.9332C16.7994 19.2161 16.687 19.4874 16.487 19.6874C16.287 19.8875 16.0157 19.9999 15.7328 19.9999H5.06662C4.78374 19.9999 4.51244 19.8875 4.31241 19.6874C4.11238 19.4874 4 19.2161 4 18.9332V8.26705C4 7.98416 4.11238 7.71286 4.31241 7.51283C4.51244 7.3128 4.78374 7.20042 5.06662 7.20042H10.3997"
      stroke="#011309"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const RemoteActionsIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <g clipPath="url(#remote-actions-clip)">
      <path
        d="M12.0693 16.0441C13.7871 15.7008 15.1725 14.2981 15.5158 12.5803C15.8591 14.2981 17.2443 15.7008 18.9623 16.0441M18.9623 16.0462C17.2443 16.3895 15.8587 17.7923 15.5154 19.51C15.1721 17.7923 13.7871 16.3895 12.0693 16.0462"
        stroke="#011309"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.3937 16.9923C10.162 17.6136 9.56842 18.0315 8.90548 18.0315H8.16835C7.50539 18.0315 6.91181 17.6136 6.68007 16.9923L6.2142 15.6903C5.66193 15.4664 5.14897 15.1676 4.68943 14.8046L3.34008 15.0363C2.68604 15.1511 2.03247 14.8431 1.69505 14.2666L1.32439 13.6273C0.986981 13.0509 1.05056 12.3317 1.47536 11.8337L2.36378 10.7862C2.32435 10.5037 2.30441 10.2143 2.30441 9.91957V9.90878C2.30441 9.60767 2.32484 9.31079 2.3655 9.01957L1.47592 7.97203C1.05111 7.47403 0.98754 6.75484 1.32495 6.17839L1.69561 5.53906C2.03302 4.96261 2.68659 4.65461 3.34064 4.76939L4.7098 5.00245C5.16353 4.64653 5.65938 4.35371 6.18615 4.13767L6.68029 2.80306C6.91202 2.18179 7.50561 1.76395 8.16856 1.76395H8.90569C9.56863 1.76395 10.1622 2.18179 10.3939 2.80306L10.8883 4.13878C11.4149 4.35477 11.9099 4.64844 12.3646 5.00434L13.7358 4.77068C14.3898 4.6559 15.0434 4.9639 15.3808 5.54035L15.7515 6.17968C16.0889 6.75613 16.0253 7.47533 15.6005 7.97332L14.7073 9.02524C14.7481 9.31705 14.7685 9.59435 14.7685 9.91478C14.7685 10.2103 14.749 10.5005 14.7087 10.7845"
        stroke="#011309"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5.47046 9.90687C5.47046 11.5229 6.79244 12.8562 8.41383 12.8562C10.0299 12.8562 11.3632 11.5343 11.3632 9.9091C11.3632 8.293 10.0412 6.97095 8.41383 6.97095C6.7977 6.97095 5.47046 8.29292 5.47046 9.90904V9.90687Z"
        stroke="#011309"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
    <defs>
      <clipPath id="remote-actions-clip">
        <rect width="20" height="20" fill="white" />
      </clipPath>
    </defs>
  </svg>
)

const LogsIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M9.1665 15.2083C9.1665 16.5984 9.7184 17.9323 10.7035 18.9175C11.6886 19.9026 13.0226 20.4545 14.4127 20.4545C15.8028 20.4545 17.1367 19.9026 18.1219 18.9175C19.107 17.9323 19.6589 16.5984 19.6589 15.2083C19.6589 13.8182 19.107 12.4843 18.1219 11.4991C17.1367 10.514 15.8028 9.96216 14.4127 9.96216C13.0226 9.96216 11.6886 10.514 10.7035 11.4991C9.7184 12.4843 9.1665 13.8182 9.1665 15.2083Z"
      stroke="#011309"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M17.0552 15.208L14.4126 15.2079V12.5654"
      stroke="#011309"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M6.66634 17.7086H1.66634C1.29815 17.7086 0.94582 17.5624 0.687215 17.3038C0.428611 17.0452 0.282349 16.6928 0.282349 16.3246V1.66699C0.282349 1.2988 0.428611 0.94647 0.687215 0.687864C0.94582 0.429258 1.29815 0.282997 1.66634 0.282997H10.873C11.241 0.283067 11.5933 0.429225 11.8518 0.687612L14.2321 3.06786C14.4905 3.32639 14.6366 3.67864 14.6367 4.04668V6.66699"
      stroke="#011309"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const DeleteIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M4 6.286h16M13.714 4h-3.428a1.286 1.286 0 0 0-1.286 1.143V6.286h6.572V5.143A1.143 1.143 0 0 0 13.714 4Z"
      stroke="#ED4A4A"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M10.286 16V10.286M13.714 16V10.286" stroke="#ED4A4A" strokeWidth="1.5" strokeLinecap="round" />
    <path
      d="M17.23 18.952a1.2 1.2 0 0 1-1.138 1.048H7.909a1.2 1.2 0 0 1-1.138-1.048L5.714 6.286h12.571l-1.055 12.666Z"
      stroke="#ED4A4A"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

function ChargerActionMenu({ onAction }) {
  const actions = [
    { key: 'edit', label: 'Edit', icon: EditIcon, onClick: () => onAction?.('edit') },
    {
      key: 'remote',
      label: 'Remote Actions',
      icon: RemoteActionsIcon,
      onClick: () => onAction?.('remote_actions'),
    },
    {
      key: 'logs',
      label: 'Charger Logs',
      icon: LogsIcon,
      onClick: () => onAction?.('logs'),
    },
    {
      key: 'delete',
      label: 'Delete',
      icon: DeleteIcon,
      onClick: () => onAction?.('delete'),
      variant: 'danger',
    },
  ]

  return <StationActionMenu actions={actions} />
}

export default ChargerActionMenu
