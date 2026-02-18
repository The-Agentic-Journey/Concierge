function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: parseInt(process.env.PORT || "8080"),
  authToken: required("AUTH_TOKEN"),

  scalebox: {
    apiUrl: required("SCALEBOX_API_URL"),
    apiToken: required("SCALEBOX_API_TOKEN"),
    template: process.env.SCALEBOX_TEMPLATE || "agentic-0-authenticated",
    host: required("SCALEBOX_HOST"),
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
