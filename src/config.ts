function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function extractHost(url: string): string {
  return new URL(url).hostname;
}

const scaleboxApiUrl = required("SCALEBOX_API_URL");

export const config = {
  port: parseInt(process.env.PORT || "8080"),
  authToken: required("AUTH_TOKEN"),

  scalebox: {
    apiUrl: scaleboxApiUrl,
    apiToken: required("SCALEBOX_API_TOKEN"),
    template: process.env.SCALEBOX_TEMPLATE || "agentic-0-authenticated",
    host: process.env.SCALEBOX_HOST || extractHost(scaleboxApiUrl),
  },

  ssh: {
    user: process.env.SSH_USER || "user",
  },

  knowledgeRepo: {
    url: required("KNOWLEDGE_REPO_URL"),
    branch: process.env.KNOWLEDGE_REPO_BRANCH || "main",
  },

  execution: {
    timeoutMs: parseInt(process.env.EXECUTION_TIMEOUT_MS || "1200000"),
  },
};
