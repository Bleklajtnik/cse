import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/method')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/method"!</div>
}
