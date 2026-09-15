import { fetchAgents } from "@/lib/admin/people";
import AdminCard from "@/components/admin/AdminCard";
import AgentForm from "@/components/admin/AgentForm";
import Badge from "@/components/ui/Badge";
import { createAgent, updateAgent, toggleAgentStatus } from "@/app/admin/(dashboard)/agents/actions";

export const dynamic = "force-dynamic";

export default async function AdminAgentsPage({
  searchParams,
}: {
  searchParams: { edit?: string };
}) {
  const agents = await fetchAgents();
  const editing = searchParams.edit ? agents.find((a) => a.id === searchParams.edit) : undefined;

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Agents</h1>
      <p className="mt-1 text-sm text-ink-faint">
        Private — agent contact and commission details. Never shown on the public website. {agents.length} agents.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.4fr]">
        <AdminCard title={editing ? `Edit ${editing.name}` : "Add Agent"}>
          {editing ? (
            <AgentForm action={updateAgent.bind(null, editing.id)} initial={editing} submitLabel="Save Changes" />
          ) : (
            <AgentForm action={createAgent} submitLabel="Add Agent" />
          )}
        </AdminCard>

        <AdminCard title="All Agents">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-ink-faint">
                <tr>
                  <th className="py-2 pr-3 font-medium">Name</th>
                  <th className="py-2 pr-3 font-medium">Agency</th>
                  <th className="py-2 pr-3 font-medium">Contact</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {agents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-ink-faint">
                      No agents yet.
                    </td>
                  </tr>
                ) : (
                  agents.map((agent) => (
                    <tr key={agent.id}>
                      <td className="py-2 pr-3 font-medium text-ink">{agent.name}</td>
                      <td className="py-2 pr-3 text-ink-soft">{agent.agency_name || "—"}</td>
                      <td className="py-2 pr-3 text-ink-soft">
                        {[agent.phone, agent.email].filter(Boolean).join(" · ") || "—"}
                      </td>
                      <td className="py-2 pr-3">
                        <Badge tone={agent.status === "ACTIVE" ? "moss" : "neutral"}>{agent.status}</Badge>
                      </td>
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-3 text-xs">
                          <a href={`/admin/agents?edit=${agent.id}`} className="font-medium text-moss-700 hover:underline">
                            Edit
                          </a>
                          <form
                            action={toggleAgentStatus.bind(
                              null,
                              agent.id,
                              agent.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"
                            )}
                          >
                            <button type="submit" className="font-medium text-ink-faint hover:text-ink">
                              {agent.status === "ACTIVE" ? "Deactivate" : "Activate"}
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </AdminCard>
      </div>
    </div>
  );
}
