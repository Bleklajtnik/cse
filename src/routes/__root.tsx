import { createRootRoute, Outlet } from '@tanstack/react-router'
import LandingMenu from '../components/landingMenu/LandingMenu'

export const Route = createRootRoute({
  component: () => (
    <>
      <LandingMenu/>
      <Outlet />
    </>
  ),
})