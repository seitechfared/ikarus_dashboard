import { Outlet, useOutletContext } from 'react-router-dom'

function SettingsLayout() {
  const parentContext = useOutletContext() || {}
  return <Outlet context={parentContext} />
}

export default SettingsLayout
