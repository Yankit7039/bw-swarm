/** @type {import('@tomehq/core').TomeConfig} */
export default {
  name: "SWARM",
  theme: {
    preset: "amber",
    mode: "auto",
  },
  navigation: [
    {
      group: "Overview",
      pages: ["index", "architecture", "concepts"],
    },
    {
      group: "Getting Started",
      pages: ["quickstart-local", "aws-deployment"],
    },
    {
      group: "Workflows",
      pages: ["workflows-overview", "yaml-reference", "stages-and-steps", "followup-lifecycle"],
    },
    {
      group: "Templates",
      pages: ["templates-overview", "building-templates"],
    },
    {
      group: "Services",
      pages: ["service-runtime", "service-adapter", "service-admin-api", "service-swarm-core"],
    },
    {
      group: "Adapter Reference",
      pages: ["adapters"],
    },
    {
      group: "Infrastructure",
      pages: ["infrastructure", "database-schema"],
    },
  ],
};
