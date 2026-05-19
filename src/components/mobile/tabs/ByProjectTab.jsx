import PersonalTodoListTable from '../../views/personal-todo/PersonalTodoListTable'

export default function ByProjectTab({ projects, tasks, milestones }) {
  return (
    <PersonalTodoListTable
      projects={projects}
      tasks={tasks}
      milestones={milestones}
    />
  )
}
