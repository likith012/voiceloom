const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";

export type JobState =
  | "PENDING"
  | "SYNTHESIZING"
  | "ALIGNING"
  | "READY"
  | "FAILED";

export interface CreateJobResponse {
  jobId: string;
}

export interface JobStatus {
  id: string;
  state: JobState;
  error?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Manifest {
  audioUrl: string;
  timingsUrl: string;
  script: string; // UI script with <Character> tags
}

export async function createJob(script: string): Promise<CreateJobResponse> {
  // Extract engine roles if present in the doc; empty array is allowed (server validates).
  const roles = detectRoles(script);
  const res = await fetch(`${API_BASE}/v1/tts/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ script, roles })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getStatus(jobId: string): Promise<JobStatus> {
  const res = await fetch(`${API_BASE}/v1/tts/jobs/${jobId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getManifest(jobId: string): Promise<Manifest> {
  const res = await fetch(`${API_BASE}/v1/tts/jobs/${jobId}/manifest`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function detectRoles(doc: string): string[] {
  const roles = new Set<string>();
  // Look for [Role] in SCRIPT (if present) or whole doc.
  const scriptMatch = doc.split(/^SCRIPT:\s*$/im).pop() ?? doc;
  const re = /\[([^\]]+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(scriptMatch))) {
    const role = m[1].trim();
    if (role) roles.add(role);
  }
  return [...roles];
}
