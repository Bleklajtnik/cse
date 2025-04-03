import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/companies')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/companies"!</div>
}
