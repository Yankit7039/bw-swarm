/** @type {import('@tomehq/core').TomeConfig} */
export default {
  name: "Boring Workflows",
  theme: {
    preset: "amber",
    mode: "auto",
    // Neutral sans + monospace: readable at length, standard for technical docs
    fonts: {
      heading: "Inter",
      body: "Inter",
      code: "JetBrains Mono",
    },
  },
  navigation: [
    {
      group: "Overview",
      pages: ["index"],
    },
    {
      group: "Concepts",
      pages: [
        "concepts/architecture",
        "concepts/data-flow",
        "concepts/redis-queue",
        "concepts/warm-pool",
        "concepts/follow-up-lifecycle",
        "concepts/event-system",
        "concepts/repo-layout",
        "concepts/glossary",
      ],
    },
    {
      group: "Tutorials",
      pages: [
        "tutorials/local-dev",
        "tutorials/kind-quickstart",
        "tutorials/aws-quickstart",
      ],
    },
    {
      group: "Guides",
      pages: [
        "guides/workflow-yaml",
        "guides/adapters",
        "guides/templates",
        "guides/templates-catalog",
        "guides/deployment",
      ],
    },
    {
      group: "Reference",
      pages: [
        "reference/runtime-api",
        "reference/admin-api",
        "reference/services",
        "reference/environment-variables",
      ],
    },
  ],
  // socialLinks: [
  //   { platform: "github", url: "https://github.com/your-org/your-repo" },
  //   { platform: "twitter", url: "https://x.com/your-handle" },
  // ],
};
