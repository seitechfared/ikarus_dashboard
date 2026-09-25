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
      d="M12.209 13.519 9.569 13.897l.377-2.64 6.788-6.788A1.87 1.87 0 0 1 17.866 4c.49 0 .961.195 1.308.542.347.347.542.819.542 1.309 0 .49-.195.961-.542 1.308l-6.888 6.36Z"
      stroke="#011309"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M16.799 13.6v5.333c0 .283-.112.554-.312.754-.2.2-.471.312-.754.312H5.067a1.067 1.067 0 0 1-1.067-1.067v-9.666c0-.283.112-.554.312-.754.2-.2.471-.312.754-.312h5.333"
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
    <g clipPath="url(#connector-remote-actions)">
      <path
        d="M12.069 16.044c1.718-.343 3.103-1.746 3.446-3.464.343 1.718 1.728 3.12 3.446 3.464m-.001.002c-1.718.343-3.103 1.745-3.446 3.463-.343-1.718-1.728-3.12-3.446-3.463"
        stroke="#011309"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.394 16.992c-.232.621-.825 1.039-1.488 1.039h-.737c-.663 0-1.256-.418-1.488-1.039l-.466-1.302a5.28 5.28 0 0 1-1.524-.886l-1.349.232c-.654.115-1.308-.193-1.645-.77l-.371-.639c-.337-.576-.274-1.296.151-1.794l.888-1.048a7.243 7.243 0 0 1-.061-.867v-.01c0-.301.021-.598.061-.889l-.89-1.047a1.539 1.539 0 0 1-.15-1.794l.371-.639a1.31 1.31 0 0 1 1.645-.77l1.37.233c.454-.356.95-.649 1.476-.865l.494-1.335c.231-.621.825-1.039 1.487-1.039h.737c.663 0 1.256.418 1.488 1.039l.494 1.335c.526.216 1.021.509 1.476.865l1.37-.233c.654-.115 1.308.193 1.645.77l.371.639c.337.576.273 1.296-.152 1.794l-.893 1.052c.04.292.061.569.061.89 0 .3-.02.59-.06.874"
        stroke="#011309"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5.47 9.907c0 1.616 1.322 2.95 2.944 2.95 1.616 0 2.95-1.322 2.95-2.948 0-1.616-1.322-2.938-2.95-2.938-1.616 0-2.943 1.322-2.943 2.938Z"
        stroke="#011309"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
    <defs>
      <clipPath id="connector-remote-actions">
        <rect width="20" height="20" fill="white" />
      </clipPath>
    </defs>
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

function ConnectorActionMenu({ onAction }) {
  const actions = [
    { key: 'edit', label: 'Edit', icon: EditIcon, onClick: () => onAction?.('edit') },
    {
      key: 'remote',
      label: 'Remote Actions',
      icon: RemoteActionsIcon,
      onClick: () => onAction?.('remote_actions'),
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

export default ConnectorActionMenu
