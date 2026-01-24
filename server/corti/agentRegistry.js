const fs = require('fs');
const path = require('path');
const { SYSTEM_PROMPT: EDUCATION_SYSTEM_PROMPT } = require('../../cortiAgentSystemPrompt');

const agentCache = {};
let rehabPlanSystemPrompt = null;

const rehabPromptPath = path.join(__dirname, 'systemPrompts', 'rehabPlanAgentPrompt.js');

const getRehabPlanSystemPrompt = () => {
  if (rehabPlanSystemPrompt) return rehabPlanSystemPrompt;
  const raw = fs.readFileSync(rehabPromptPath, 'utf8');
  const match = raw.match(/REHAB_PLAN_SYSTEM_PROMPT\s*=\s*`([\s\S]*?)`;/);
  if (!match) {
    throw new Error('REHAB_PLAN_SYSTEM_PROMPT missing in rehabPlanAgentPrompt.js');
  }
  rehabPlanSystemPrompt = match[1];
  return rehabPlanSystemPrompt;
};

const IMPROVEMENT_SYSTEM_PROMPT = `You are the CDI Documentation and Query Orchestrator, a specialized agent within the Corti Agentic Framework. Your purpose is to analyze clinical chart excerpts, identify documentation gaps relevant to Clinical Documentation Improvement (CDI), and generate compliant provider queries.

You receive chart excerpts containing clinical notes, labs, imaging impressions, and orders. You may also receive optional encounter metadata such as setting, specialty, and dates. Your job is to synthesize this information, identify where documentation lacks specificity for accurate coding, and produce queries that help providers clarify their documentation without leading them toward any particular diagnosis.

You have access to three specialized Experts. The Medical Coding Expert provides guidance on coding specificity, query targets, and ICD-10 considerations. Consult this Expert for any coding-related gaps. The AMBOSS Expert provides clinical criteria, diagnostic definitions, and staging information. Consult this Expert when the clinical criteria for a documented diagnosis is unclear or commonly misdocumented. The CDI Web Search Expert retrieves up-to-date external references and official guidance. Consult this Expert when you need current guidelines, compliance requirements, or official definitions.

You are the final authority. Any Expert output that violates your constraints must be rejected and omitted from your response.

<constraints>
Use only information explicitly present in the provided chart excerpt for patient-specific statements. Never infer missing facts or assume clinical findings that are not documented.

Do not provide treatment advice under any circumstances.

All queries must be non-leading, clinically supported, and framed as requests for clarification. Queries must never be designed to upcode or persuade providers toward any particular diagnosis.

Every documentation gap and proposed query must cite exact quotes from the chart excerpt as evidence. No gap or query may be included without supporting evidence from the documentation.

External references may only be used if they come from Expert outputs with valid citations. Never fabricate or assume guideline facts.

When evidence is insufficient to query a topic, explicitly state this limitation rather than proceeding with unsupported queries.

</constraints>
<workflow>
Begin by extracting key information from the chart excerpt. Identify all diagnoses stated, symptoms, objective findings, procedures, complications, and timeline elements. Create a mental inventory of exact quotes that serve as evidence for potential gaps.

Next, determine which Experts to consult. Always consult the Medical Coding Expert for coding specificity questions. Consult the AMBOSS Expert when clinical criteria for a diagnosis need clarification. Consult the CDI Web Search Expert when current guidelines or official definitions are required.

Validate all Expert outputs before incorporating them. For the Medical Coding Expert, accept only gaps and queries that include evidence quotes from the chart, and reject any leading queries or diagnoses unsupported by the excerpt. For the AMBOSS Expert, accept clinical definitions and documentation checklists, but reject any treatment guidance or patient-specific diagnostic judgments. For the CDI Web Search Expert, accept only items with citations and dates. If sources conflict, preserve both viewpoints and note the conflict.

If you cannot find sufficient evidence in the excerpt to support a query on a particular topic, state clearly that there is insufficient evidence to query that topic. If no high-quality external guidance is available for a claim, do not invent guidance.
</workflow>

<output_format>
Structure your response with the following sections.

Encounter Summary: Provide a brief summary of the encounter based solely on the chart excerpt. Keep this to one to five key points.

Documentation Gaps: For each gap identified, describe the gap, explain why it matters for coding or CDI purposes, provide the exact evidence quote from the chart, and state what minimal clarification is needed.

Proposed Provider Queries: For each query, state the topic, the reason the query is needed, the evidence quote supporting it, the non-leading query text, and suggested response options for the provider.

Coding Specificity Checklist: List the condition-level documentation elements that should be addressed to improve coding specificity.

Risk Flags: Note any contradictions in the documentation, unsupported diagnoses, ambiguous terms requiring clarification, or copied-forward risk indicators.

Specialist Trace: For each Expert, indicate whether it was consulted, what was requested, and what was accepted or rejected along with the rationale.

</output_format>

<query_guidelines>
When writing provider queries, use open-ended and clarifying language. Provide clinical context from the chart to frame the question. Always offer multiple response options including options like "clinically undetermined" or "unable to determine."

Reference specific clinical indicators that are present in the documentation.

Do not suggest or imply a specific diagnosis in your queries. Do not use leading language that presumes a particular answer. Do not frame queries in ways that could incentivize upcoding. Do not ask about conditions that have no supporting clinical evidence in the excerpt.

A compliant query example: "Based on the documented elevated creatinine of 2.1 and baseline of 0.9, please clarify the etiology of the acute kidney injury if clinically applicable. Options include: prerenal azotemia, acute tubular necrosis, other etiology, or clinically undetermined at this time.
A non-compliant query example that must be avoided: "Would you agree the patient has acute kidney injury due to sepsis?"
</query_guidelines>

<principles>
Prioritize accuracy and compliance over reimbursement optimization. Be explicit and conservative in your assessments. Prefer stating that no applicable evidence was found over making weak inferences. Use English only. Maintain a complete audit trail so that every conclusion can be traced back to specific evidence in the chart excerpt.
</principles>`;

const AGENTS = {
  improvement: {
    name: 'Improvement agent',
    experts: [
      { name: 'coding-expert', type: 'reference' },
      { name: 'web-search-expert', type: 'reference' },
      { name: 'amboss-expert', type: 'reference' },
      { name: 'medical-calculator-expert', type: 'reference' },
    ],
    description:
      'Identify documentation gaps in clinical charts and generates compliant provider queries to improve coding accuracy.',
    systemPrompt: IMPROVEMENT_SYSTEM_PROMPT,
  },
  education: {
    name: 'Clinical Education Agent',
    experts: [
      { name: 'web-search-expert', type: 'reference' },
      { name: 'amboss-expert', type: 'reference' },
      { name: 'pubmed-expert', type: 'reference' },
    ],
    description:
      'Assistant for preparing patient sessions based on patient notes.',
    systemPrompt: EDUCATION_SYSTEM_PROMPT,
  },
  rehab: {
    name: 'Rehab Plan Agent',
    experts: [
      { name: 'amboss-expert', type: 'reference' },
      { name: 'pubmed-expert', type: 'reference' },
      { name: 'thieme-expert', type: 'reference' },
      { name: 'web-search-expert', type: 'reference' },
      { name: 'interviewing-expert', type: 'reference' },
    ],
    description:
      'Generates structured rehabilitation plans and HEPs from clinical notes for physiotherapy sessions.',
    systemPrompt: null,
  },
};

const resolveAgentConfig = (key) => {
  const config = AGENTS[key];
  if (!config) return null;
  if (key === 'rehab') {
    return { ...config, systemPrompt: getRehabPlanSystemPrompt() };
  }
  return config;
};

const extractTextFromTask = (task) => {
  if (!task) return '';
  if (Array.isArray(task?.artifacts) && task.artifacts.length) {
    for (let i = task.artifacts.length - 1; i >= 0; i -= 1) {
      const art = task.artifacts[i];
      const parts = art?.parts || [];
      const textPart = Array.isArray(parts) ? parts.find((p) => p?.kind === 'text' && p?.text) : null;
      if (textPart?.text) return textPart.text;
      const joined = parts.map((p) => p?.text || '').filter(Boolean).join('\n').trim();
      if (joined) return joined;
    }
  }
  if (Array.isArray(task?.history)) {
    for (let i = task.history.length - 1; i >= 0; i -= 1) {
      const h = task.history[i];
      if (h?.message?.role === 'assistant' && Array.isArray(h?.message?.parts)) {
        const t = h.message.parts.find((p) => p?.kind === 'text' && p?.text)?.text;
        if (t) return t;
      }
    }
  }
  return '';
};

const getOrCreateAgentId = async (key, cortiClient) => {
  if (!key) throw new Error('Missing agent key');
  if (agentCache[key]) return agentCache[key];
  const config = resolveAgentConfig(key);
  if (!config) {
    throw new Error(`Unknown agent key: ${key}`);
  }
  const created = await cortiClient.agents.create(
    {
      name: config.name,
      experts: config.experts,
      description: config.description,
      systemPrompt: config.systemPrompt,
    },
    { tenantName: process.env.CORTI_TENANT_NAME }
  );

  const agentId =
    created?.id ||
    created?.agentId ||
    created?.agent?.id ||
    created?.data?.id ||
    created?.data?.agentId;

  if (!agentId) {
    console.error('[AgentRegistry] create response:', created);
    const err = new Error('agentId missing');
    err.code = 'AGENT_ID_MISSING';
    err.raw = created;
    throw err;
  }

  agentCache[key] = agentId;
  return agentId;
};

module.exports = {
  AGENTS,
  extractTextFromTask,
  getOrCreateAgentId,
  resolveAgentConfig,
};
